import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCENE_PROPS, resolveProp, propAabb, overlaps, roomBounds, doorSweep, hiddenByDoorSweep,
  propHiddenByDoorSweep, doorAngle, WALL_PARAMS, type Aabb,
} from './props.data.ts'
import { DEFAULTS } from '../configurator/shareSchema.ts'
import { PRODUCTS } from '../generated/cards.ts'

/**
 * 충돌 게이트 — 방이 파라메트릭이라(`WALL_PARAMS`+`doorW`+`anchor`) 프리셋으로 구조를 바꾸면
 * 소품이 따라 움직인다. 따라오다 **벽을 뚫거나 서로 겹치는 걸** 사람이 손으로 검산해 왔고,
 * 그래서 신발 두 켤레가 0.014m 간격으로 포개진 채 배포됐다. 그 검산을 기계로 옮긴다.
 *
 * 프레임 게이트(`frame.test.ts`)와 축이 다르다 — 저건 "보이나", 이건 "물리적으로 성립하나".
 */

const clampWidth = (id: keyof typeof PRODUCTS, w: number) => {
  const [lo, hi] = PRODUCTS[id].widthRangeM
  return Math.min(hi, Math.max(lo, w))
}
const DOOR_W = clampWidth(DEFAULTS.productId, DEFAULTS.widthM)

const boxed = (openCorner: boolean) =>
  SCENE_PROPS.map((p) => ({ p, aabb: propAabb(p, DOOR_W, openCorner) }))
    .filter((r): r is { p: typeof r.p; aabb: Aabb } => r.aabb !== null)

const fmt = (a: Aabb) =>
  `x[${a.minX.toFixed(2)},${a.maxX.toFixed(2)}] y[${a.minY.toFixed(2)},${a.maxY.toFixed(2)}] z[${a.minZ.toFixed(2)},${a.maxZ.toFixed(2)}]`

test('모든 소품에 바운딩 박스가 있다 — 없으면 충돌 검사에서 조용히 빠진다', () => {
  const missing = SCENE_PROPS.filter((p) => !p.box).map((p) => p.id)
  assert.equal(
    missing.length, 0,
    `box 없는 소품 ${missing.length}건 — 충돌 검사가 이들을 건너뛴다: ${missing.join(', ')}`,
  )
})

test('소품이 벽을 뚫지 않는다 (현관·거실 경계)', () => {
  for (const openCorner of [false, true]) {
    const b = roomBounds(DOOR_W, WALL_PARAMS, openCorner)
    const bad: string[] = []
    for (const { p, aabb } of boxed(openCorner)) {
      // 소속 판정은 원점 z로 — 개구부에 걸친 소품(문틀 부속)은 없다
      const at = resolveProp(p, DOOR_W, openCorner).position
      const r = at[2] < 0 ? b.vest : b.living
      // 벽 두께 절반(50mm)까지는 관통이 아니라 **매립**이다 — 액자·월패드·창·후크는
      // 벽면에 박혀야 정상이고, 바닥 소품이 벽에 5cm 붙는 것도 사고가 아니다.
      // 그보다 깊으면 진짜 관통이다.
      const T = 0.06
      const out: string[] = []
      if (aabb.minX < r.minX - T) out.push(`좌측벽 ${(r.minX - aabb.minX).toFixed(3)}m 관통`)
      if (aabb.maxX > r.maxX + T) out.push(`우측 경계 ${(aabb.maxX - r.maxX).toFixed(3)}m 초과`)
      if (at[2] < 0 && aabb.minZ < r.minZ - T) out.push(`뒷벽 ${(r.minZ - aabb.minZ).toFixed(3)}m 관통`)
      if (aabb.maxY > r.maxY + T) out.push(`천장 ${(aabb.maxY - r.maxY).toFixed(3)}m 관통`)
      if (out.length) bad.push(`  ${p.id} — ${out.join(' · ')}  ${fmt(aabb)}`)
    }
    assert.equal(bad.length, 0, `[openCorner=${openCorner}] 벽 관통 ${bad.length}건\n${bad.join('\n')}`)
  }
})

test('소품끼리 겹치지 않는다 (매트·러그는 위에 올라가는 게 정상이라 제외)', () => {
  for (const openCorner of [false, true]) {
    const items = boxed(openCorner).filter(({ p }) => !p.flat)
    const bad: string[] = []
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (!overlaps(items[i].aabb, items[j].aabb)) continue
        const ov = Math.min(items[i].aabb.maxX, items[j].aabb.maxX) - Math.max(items[i].aabb.minX, items[j].aabb.minX)
        bad.push(`  ${items[i].p.id} ↔ ${items[j].p.id} (x축 겹침 ${ov.toFixed(3)}m)`)
      }
    }
    assert.equal(bad.length, 0, `[openCorner=${openCorner}] 소품 겹침 ${bad.length}건\n${bad.join('\n')}`)
  }
})

test('여닫이 제품마다 숨김 규칙이 일하되, 씬을 통째로 비우지는 않는다', () => {
  const hinged = (Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]).filter((id) => {
    const m = PRODUCTS[id].motion
    return m === 'abs_hinged' || m === 'swing_bi_directional'
  })
  assert.ok(hinged.length > 0, '여닫이 제품이 없다 — 카드가 바뀐 것이니 이 테스트를 재검토하라')

  for (const id of hinged) {
    const p = PRODUCTS[id] as (typeof PRODUCTS)[typeof id] & { fixedPanels?: readonly number[] }
    const dw = clampWidth(id, DEFAULTS.widthM)
    const items = boxed(false)
    const perDir = ([1, -1] as const).map((dir) => {
      const sweep = doorSweep(p.motion, p.panels, p.fixedPanels?.length ?? 0, dw, dir)
      const hidden = SCENE_PROPS.filter((q) => propHiddenByDoorSweep(q, dw, false, sweep)).map((q) => q.id)
      // 다 잡으면 씬이 빈다.
      assert.ok(
        hidden.length < items.length / 2,
        `${id}/dir=${dir}: ${items.length}개 중 ${hidden.length}개가 숨는다 — 씬이 비어버린다: ${hidden.join(', ')}`,
      )
      return hidden
    })
    // 아무것도 안 잡으면 규칙이 죽은 것이다. 단 **방향별로** 요구하지 않는다 —
    // 현관 쪽 문짝 반경 안은 배치 3원칙 때문에 원래 비어 있어서 0건이 정상이다.
    assert.ok(perDir.flat().length > 0, `${id}: 양방향 어디서도 숨는 소품이 0건 — 규칙이 죽었다`)
  }
})

test('붙박이(신발장·방화문)는 문 방향을 어느 쪽으로 돌려도 사라지지 않는다', () => {
  const fixtures = SCENE_PROPS.filter((p) => p.fixture)
  assert.ok(fixtures.length > 0, 'fixture 표시된 소품이 없다 — 표식이 사라졌다')
  for (const dir of [1, -1] as const) {
    for (const motion of ['abs_hinged', 'swing_bi_directional']) {
      const sweep = doorSweep(motion, 1, 0, 1.25, dir)
      for (const f of fixtures) {
        assert.equal(
          propHiddenByDoorSweep(f, 1.25, false, sweep), false,
          `${f.id}이 ${motion}/dir=${dir}에서 숨는다 — 붙박이는 문 때문에 사라지지 않는다`,
        )
      }
    }
  }
})

test('여는 방향을 바꾸면 궤적도 반대편으로 간다 — 붙박이 신발장은 한쪽에서만 걸린다', () => {
  const living = doorSweep('swing_bi_directional', 1, 0, 1.25, 1)
  const vest = doorSweep('swing_bi_directional', 1, 0, 1.25, -1)
  assert.deepEqual(living.sides, [1], 'dir=+1은 거실(+z)만 검사해야 한다')
  assert.deepEqual(vest.sides, [-1], 'dir=-1은 현관(-z)만 검사해야 한다')
  // 양쪽을 동시에 잡으면 반대편 붙박이까지 숨는다 — 2026-08-28에 실제로 그랬다
  assert.equal(living.sides.length, 1, '한 번에 한 방향으로만 열린다')

  const inLiving: Aabb = { minX: 0, maxX: 0.2, minY: 0, maxY: 0.1, minZ: 0.3, maxZ: 0.5 }
  const inVest: Aabb = { minX: 0, maxX: 0.2, minY: 0, maxY: 0.1, minZ: -0.5, maxZ: -0.3 }
  assert.equal(hiddenByDoorSweep(inLiving, living), true)
  assert.equal(hiddenByDoorSweep(inLiving, vest), false, '현관 쪽으로 여는데 거실 소품이 숨으면 안 된다')
  assert.equal(hiddenByDoorSweep(inVest, vest), true)
  assert.equal(hiddenByDoorSweep(inVest, living), false, '거실 쪽으로 여는데 현관 소품이 숨으면 안 된다')
})

test('회전각 부호 규약 — 렌더러와 게이트가 같은 쪽을 가리킨다', () => {
  // three의 Y축 회전은 z' = -x·sinθ다. 자유단이 +z(거실)로 가려면 θ가 음수여야 한다.
  // 이 관계가 깨진 채 배포됐었다: SwingDoor가 +t·MAX·dir이라 기본값에서 현관 쪽으로 열리는데
  // doorSweep은 거실 쪽을 검사했다. 두 렌더러가 doorAngle을 쓰므로 여기서 한 번만 고정한다.
  const tipZ = (dir: 1 | -1) => -Math.sin(doorAngle(1, dir)) // 자유단 z의 부호 (x>0인 자유단 기준)
  assert.ok(tipZ(1) > 0, 'dir=+1이면 문짝이 거실(+z)로 열려야 한다 — doorSweep sides:[+1]과 같은 쪽')
  assert.ok(tipZ(-1) < 0, 'dir=-1이면 문짝이 현관(-z)로 열려야 한다')
  assert.equal(Math.abs(doorAngle(0, 1)), 0, '닫힘(t=0)은 각 0') // -0도 닫힘이다
  assert.ok(Math.abs(doorAngle(1, 1)) < Math.PI / 2, '88° 클램프 — 90°를 넘으면 문짝 끝이 문틀 밖 신발장을 관통한다')
})

test('숨김 규칙이 실제로 일한다 — 문 바로 앞 바닥 소품을 잡는가', () => {
  const sw = doorSweep('swing_bi_directional', 1, 0, 1.25) // 반경 1.25, 양방향
  const front: Aabb = { minX: 0, maxX: 0.2, minY: 0, maxY: 0.1, minZ: 0.3, maxZ: 0.5 }
  const far: Aabb = { minX: 0, maxX: 0.2, minY: 0, maxY: 0.1, minZ: 2.5, maxZ: 2.7 }
  const mat: Aabb = { minX: 0, maxX: 0.2, minY: 0, maxY: 0.01, minZ: 0.3, maxZ: 0.5 }
  assert.equal(hiddenByDoorSweep(front, sw), true, '문 앞 바닥 소품은 숨어야 한다')
  assert.equal(hiddenByDoorSweep(far, sw), false, '멀리 있으면 안 숨는다')
  assert.equal(hiddenByDoorSweep(mat, sw), false, '납작한 건 문이 위로 지난다')
  assert.equal(hiddenByDoorSweep(front, doorSweep('sliding_multi_panel', 3, 0, 1.25)), false, '슬라이딩은 대상 아님')
})

test('충돌 API 자체가 살아 있다 — 겹치는 상자를 실제로 잡는가', () => {
  const a: Aabb = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }
  assert.equal(overlaps(a, { minX: 0.5, maxX: 1.5, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }), true, '겹치는데 못 잡으면 죽은 게이트')
  assert.equal(overlaps(a, { minX: 1.1, maxX: 2, minY: 0, maxY: 1, minZ: 0, maxZ: 1 }), false)
  assert.equal(overlaps(a, { minX: 0, maxX: 1, minY: 2, maxY: 3, minZ: 0, maxZ: 1 }), false, 'y가 다르면 안 겹친다')
  // 회전 AABB — 90° 돌리면 폭과 깊이가 바뀐다
  const rotated = propAabb(
    { id: 't', type: 'rug', position: [0, 0, 0], rotation: [0, Math.PI / 2, 0], box: { w: 2, d: 0.2, y: [0, 1] } },
    DOOR_W, false,
  )!
  assert.ok(Math.abs((rotated.maxZ - rotated.minZ) - 2) < 0.01, '90° 회전 시 폭이 z축으로 가야 한다')
})
