import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SCENE_PROPS, resolveProp, frameNdc, inFrame, inRemovedCornerWall, CAMERA,
} from './props.data.ts'
import { DEFAULTS } from '../configurator/shareSchema.ts'
import { PRODUCTS } from '../generated/cards.ts'

/**
 * 프레임 게이트 (SCENE-PLAN P-E) — 소품이 기본 카메라 화면 안에 있는가.
 *
 * P-C에서 "포근함 핵심"으로 만든 소품 다수가 기본 프레임 밖이라 0픽셀 기여 중이었다.
 * 만들었는지가 아니라 **보이는지**를 재는 게이트가 없어서 P-C 게이트를 통과했다 — 그 구멍을 막는다.
 *
 * 판정은 카메라 절두체 투영(ndc)으로 한다. 각도 프록시(총 30°)를 쓰던 시절 창을 31.6°로
 * 떨어뜨렸는데 실제로는 화면 안(ndc −0.82)이었다 — 구면 각도는 직사각 절두체를 못 그린다.
 * 의도적으로 밖에 두는 소품은 데이터에 `offFrame` 사유를 달아 면제한다.
 */

/** 기본 문폭 — DoorModel.specFrom과 같은 클램프(JSX라 import 불가해 식만 복제) */
const p = PRODUCTS[DEFAULTS.productId]
const [wMin, wMax] = p.widthRangeM
const DOOR_W = Math.min(wMax, Math.max(wMin, DEFAULTS.widthM))

function measure(openCorner: boolean) {
  return SCENE_PROPS
    .map((sp) => ({ prop: sp, ...resolveProp(sp, DOOR_W, openCorner) }))
    .filter((r) => !r.hidden)
    .map((r) => ({ id: r.prop.id, offFrame: r.prop.offFrame, ndc: frameNdc(r.position), ok: inFrame(r.position) }))
    .sort((a, b) => Math.max(Math.abs(b.ndc.x), Math.abs(b.ndc.y)) - Math.max(Math.abs(a.ndc.x), Math.abs(a.ndc.y)))
}

test('기본 문폭이 카드 범위 안에서 결정된다', () => {
  assert.ok(DOOR_W >= wMin && DOOR_W <= wMax, `DOOR_W ${DOOR_W} 가 [${wMin}, ${wMax}] 밖`)
})

test('offFrame 사유가 없는 소품은 전부 기본 카메라 화면 안에 있다', () => {
  for (const openCorner of [false, true]) {
    const rows = measure(openCorner)
    const over = rows.filter((r) => !r.ok && !r.offFrame)
    const report = rows
      .map((r) => `  ${r.ok ? 'ok  ' : r.offFrame ? `면제(${r.offFrame})` : 'FAIL'} ndc ${r.ndc.x.toFixed(2).padStart(6)} ${r.ndc.y.toFixed(2).padStart(6)}  ${r.id}`)
      .join('\n')
    assert.equal(
      over.length, 0,
      `[openCorner=${openCorner}] 프레임 밖 ${over.length}건 — 화면에 안 보이는데 사유도 없다.\n` +
      `의도한 거라면 그 소품에 offFrame: 'cutoff' | 'light' 를 달아 사유를 남긴다.\n` +
      `카메라 ${JSON.stringify(CAMERA.position)} → ${JSON.stringify(CAMERA.target)}, doorW=${DOOR_W}\n${report}`,
    )
  }
})

test("offFrame 면제는 실제로 밖일 때만 유효하다 — 화면 안인데 면제면 낡은 표시다", () => {
  const stale = measure(false).filter((r) => r.offFrame && r.ok)
  assert.equal(
    stale.length, 0,
    `화면 안인데 offFrame이 붙어 있다(지워야 한다): ${stale.map((r) => r.id).join(', ')}`,
  )
})

test('ㄱ자(개방형): 사라진 벽에 걸린 소품은 숨고, 다른 중문에선 전부 복귀한다', () => {
  const at = (openCorner: boolean) =>
    SCENE_PROPS.map((p) => ({ id: p.id, ...resolveProp(p, DOOR_W, openCorner) }))

  const stuck = at(true)
    .filter((r) => !r.hidden)
    .filter((r) => inRemovedCornerWall(r.position[0], r.position[2], DOOR_W))
  assert.equal(
    stuck.length, 0,
    `ㄱ자에서 부스 가벽(x>${(DOOR_W / 2 + 0.04).toFixed(3)})을 뚫거나 사라진 벽에 뜬 소품:\n` +
    stuck.map((r) => `  ${r.id} x=${r.position[0].toFixed(2)} z=${r.position[2].toFixed(2)}`).join('\n'),
  )

  // 복귀 — 일반 중문에서는 자동 숨김이 하나도 걸리면 안 된다
  const gone = at(false).filter((r) => r.hidden)
  assert.equal(gone.length, 0, `일반 중문인데 숨은 소품: ${gone.map((r) => r.id).join(', ')}`)

  // 규칙이 실제로 일하고 있는가 — ㄱ자에서 숨는 게 0이면 게이트가 죽은 것과 같다
  assert.ok(at(true).some((r) => r.hidden), 'ㄱ자에서 숨는 소품이 0건 — 규칙이 아무것도 안 잡고 있다')
})

test('카메라 SSOT — 뒤에서 앞을 본다(문이 -z 쪽)', () => {
  assert.ok(CAMERA.position[2] > CAMERA.target[2], '카메라가 타깃보다 +z에 있어야 문을 정면에서 본다')
  assert.ok(CAMERA.position[1] > 1 && CAMERA.position[1] < 2, '눈높이(1~2m) 밖이면 아파트 시점이 아니다')
})
