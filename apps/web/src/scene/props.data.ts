/**
 * 씬 배치 SSOT — 소품 목록·벽 파라미터·기본 카메라.
 *
 * three/JSX 의존이 0이라 `node --test`가 그대로 import 한다(→ `frame.test.ts` 프레임 게이트).
 * 렌더러(RENDERERS)·재질·편집기 UI는 `sceneProps.tsx`가 갖는다 — 여기엔 숫자만 둔다.
 *
 * 좌표 조절: dev 서버에서 `?edit=1` → 소품 클릭 → 기즈모로 이동 → `/__scene-save`가
 * 아래 `<scene-props>` / `<wall-params>` 마커 구간을 재작성한다(vite.config.ts).
 */

/** 소품 종류 — `sceneProps.tsx`의 RENDERERS가 이 union을 exhaustive 하게 구현한다(양방향 강제) */
export type PropType =
  | 'shoeCabinet' | 'fireDoor' | 'doorMat' | 'umbrellaStand' | 'slipper'
  | 'shoesDark' | 'shoesLight' | 'coatHook'
  | 'rug' | 'windowSheer' | 'floorLamp' | 'wallpad' | 'lightSwitch'
  | 'artTall' | 'artWide' | 'monstera' | 'sofa'

/** anchor: 문폭(doorW)에 따라오는 소품용 — x에 앵커 오프셋이 더해진다 */
export type PropAnchor = 'abs' | 'doorL' | 'doorR'
export interface PropOverride {
  position?: [number, number, number]
  rotation?: [number, number, number]
  hidden?: boolean
}
export interface SceneProp {
  id: string
  type: PropType
  anchor?: PropAnchor
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  /**
   * 프레임 게이트 면제 — **의도적으로** 원점이 화면 밖인 소품에만 단다. 사유를 값으로 남긴다.
   * `cutoff` 프레임 가장자리 근경물 — 원점은 밖이지만 지오메트리가 안으로 뻗어 실제로 보인다
   * `light`  화면엔 안 나오고 빛·분위기만 담당한다 (등기구가 프레임 밖, 광원만 유효)

   * 안 달면 원점이 화면 안이어야 한다 — 새 소품이 밖으로 새는 걸 계속 잡기 위한 기본값이다
   */
  offFrame?: 'cutoff' | 'light'
  /**
   * 가림 게이트 면제 — 원점 한 점으로 재기엔 **폭이 큰** 물체.
   * 방화문(1.06m)은 원점이 개구부 밖으로 나가도 좌측 절반이 유리 너머로 보인다.
   * `offFrame`과 별개 축이다: 저건 '프레임 밖', 이건 '한 점 근사가 안 맞음'.
   */
  wide?: true
  /**
   * 충돌 검사용 바운딩 박스 — `w`·`d`는 원점 중심 XZ 발자국, `y`는 원점 기준 [아래, 위].
   * 렌더러의 지오메트리 치수에서 손으로 옮긴 값이다(데이터 층은 three를 모른다).
   * **없으면 충돌 검사에서 제외된다** — 새 소품에 붙이는 걸 잊으면 조용히 빠지므로,
   * `collision.test.ts`가 "box 없는 소품 수"를 같이 보고한다.
   * 회전(`rotation[1]`)은 게이트가 회전 AABB로 환산하므로 여기엔 반영하지 않는다.
   */
  box?: { w: number; d: number; y: [number, number] }
  /** 바닥 마감(매트·러그) — 위에 다른 소품이 올라가는 게 정상이라 겹침 검사에서 뺀다 */
  flat?: true
  /**
   * 붙박이 구조물(신발장·방화문) — **문 궤적으로 숨기지 않는다.**
   * 옮길 수 있는 소품은 문이 지나갈 자리에서 치우는 게 현실이지만, 붙박이는 문 때문에
   * 사라지지 않는다. 여는 방향을 현관 쪽으로 돌렸더니 신발장이 증발했다(2026-08-28).
   */
  fixture?: true
  /** 씬 모드별 배치 오버라이드 — 개방형 코너(ㄱ자)는 벽이 달라져 소품 자리도 달라진다 */
  modes?: { openCorner?: PropOverride }
}

/*
 * 배치 근거(KKARTdoor 실측 + 에디터 실배치 2026-08-26 — 아래 블록은 저장 시 재작성되므로 주석은 여기에):
 * - 현관 바닥 소품 y=-0.045: Entryway v3 타일 단차(step)와 동기
 * - 현관 반폭 VEST=doorW/2+vestMargin — 벽 추종 소품은 doorL/doorR 앵커로 표현
 * - shoe-cabinet: 좌측벽 붙박이(깊이 0.35 → 중심 x=-doorW/2-0.055). ㄱ자 리턴은 우측만 침범, 스윙은 +z로 열림
 * - fire-door: 뒷벽 중앙 — 거실→중문→현관문 시선축(복도형 70%)
 * - 현관 소품 배치 3원칙 (2026-08-27 주인님 지적으로 확립):
 *   ① 문짝 x범위(-0.53~0.57) 앞을 막지 않는다 — 우산꽂이가 문에서 0.11m 앞에 서 있었다
 *   ② 같은 종류끼리 겹치지 않는다 — 신발 두 켤레가 0.014m 간격(폭 0.24m)으로 포개져 있었다
 *   ③ 그러면서 개구부 시선(passesOpening)을 통과해야 한다 — 셋을 동시에 만족하는 띠가 좁다
 */
// <scene-props>
export const SCENE_PROPS: SceneProp[] = [
  {
    id: 'shoe-cabinet',
    box: { w: 0.78, d: 0.36, y: [0.09, 2.75] },
    fixture: true,
    type: 'shoeCabinet',
    anchor: 'doorL',
    position: [
      -0.175,
      -0.28,
      -1.06
    ],
    rotation: [
      0,
      1.571,
      0
    ]
  },
  {
    id: 'fire-door',
    box: { w: 1.06, d: 0.06, y: [0, 2.16] },
    fixture: true,
    type: 'fireDoor',
    wide: true,
    position: [
      0.02,
      -0.045,
      -1.83
    ],
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'door-mat',
    box: { w: 0.85, d: 0.55, y: [0, 0.01] },
    flat: true,
    type: 'doorMat',
    position: [
      0.04,
      -0.041,
      -1.46
    ],
    modes: {
      openCorner: {
        position: [
          -0.18,
          -0.041,
          -1.47
        ]
      }
    },
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'umbrella-stand',
    box: { w: 0.16, d: 0.16, y: [0, 0.75] },
    type: 'umbrellaStand',
    anchor: 'doorL',
    position: [
      0.045,
      -0.045,
      -1.62
    ],
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'shoes-a',
    box: { w: 0.26, d: 0.32, y: [0, 0.11] },
    type: 'shoesDark',
    position: [
      -0.30,
      -0.045,
      -1.52
    ],
    rotation: [
      0,
      0.32,
      0
    ]
  },
  {
    id: 'shoes-b',
    box: { w: 0.26, d: 0.32, y: [0, 0.11] },
    type: 'shoesLight',
    position: [
      0.12,
      -0.045,
      -1.38
    ],
    rotation: [
      0,
      -0.18,
      0
    ]
  },
  {
    id: 'coat-hook',
    box: { w: 0.36, d: 0.14, y: [-0.5, 0.36] },
    type: 'coatHook',
    position: [
      -0.82,
      1.45,
      -1.86
    ],
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'slipper-l',
    box: { w: 0.11, d: 0.28, y: [0, 0.09] },
    type: 'slipper',
    position: [
      0.32,
      0,
      0.62
    ],
    rotation: [
      0,
      0.25,
      0
    ]
  },
  {
    id: 'slipper-r',
    box: { w: 0.11, d: 0.28, y: [0, 0.09] },
    type: 'slipper',
    position: [
      0.5,
      0,
      0.66
    ],
    rotation: [
      0,
      0.1,
      0
    ]
  },
  {
    id: 'rug',
    box: { w: 1.9, d: 1.3, y: [0, 0.01] },
    flat: true,
    type: 'rug',
    position: [
      0.03,
      0.006,
      0.79
    ],
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'window',
    box: { w: 0.9, d: 0.05, y: [-0.68, 0.68] },
    type: 'windowSheer',
    position: [
      -2.44,
      1.55,
      0.8
    ],
    rotation: [
      0,
      1.571,
      0
    ]
  },
  {
    id: 'floor-lamp',
    box: { w: 0.34, d: 0.34, y: [0, 1.58] },
    type: 'floorLamp',
    offFrame: 'light',
    position: [
      -1.78,
      0,
      2.94
    ],
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'wallpad',
    box: { w: 0.13, d: 0.03, y: [-0.1, 0.1] },
    type: 'wallpad',
    anchor: 'doorL',
    position: [
      -0.32,
      1.3,
      0.09
    ],
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'light-switch',
    box: { w: 0.09, d: 0.02, y: [-0.06, 0.06] },
    type: 'lightSwitch',
    anchor: 'doorL',
    position: [
      -0.17,
      1.28,
      0.087
    ]
  },
  {
    id: 'art-l',
    box: { w: 0.36, d: 0.03, y: [-0.23, 0.23] },
    type: 'artTall',
    position: [
      -1.5625,
      1.55,
      0.09
    ]
  },
  {
    id: 'art-r',
    box: { w: 0.34, d: 0.03, y: [-0.13, 0.13] },
    type: 'artWide',
    position: [
      1.5625,
      1.42,
      0.09
    ],
    modes: {
      openCorner: {
        hidden: true
      }
    }
  },
  {
    id: 'monstera',
    box: { w: 0.75, d: 0.75, y: [0, 1.15] },
    type: 'monstera',
    offFrame: 'cutoff',
    anchor: 'doorL',
    position: [
      2.605,
      0,
      0.48
    ],
    scale: 0.85,
    rotation: [
      0,
      1.344,
      0
    ]
  },
  {
    id: 'sofa',
    box: { w: 0.82, d: 1.1, y: [0, 0.9] },
    type: 'sofa',
    offFrame: 'cutoff',
    position: [
      -1.9,
      0,
      1.95
    ],
    rotation: [
      0,
      0,
      0
    ]
  }
]
// </scene-props>

/* ── ㄱ자(개방형) 자동 숨김 ─────────────────────────────────────────────────
 * ㄱ자를 고르면 벽 두 장이 사라진다 — ① 전실 우측벽(x=VEST) ② 개구 우측 벽판(z≈0, x>doorW/2).
 * 그 자리에 기대 있던 소품은 갈 곳이 없다: 새로 서는 부스 가벽(x=boothIn~boothIn+0.08)을
 * 뚫거나, 벽이 없어진 허공에 뜬다.
 *
 * 소품 id를 하나하나 지정하지 않고 **좌표로 판정**한다 — `?edit=1`로 소품을 옮기면 id 목록은
 * 바로 낡지만 규칙은 따라오기 때문이다. 다른 중문을 고르면 조건 자체가 꺼져 전부 복귀한다.
 */
/** 개구 벽판(두께 0.15)의 앞면 + 벽걸이 소품 두께 여유 */
const CORNER_Z_MAX = 0.2

/** ㄱ자에서 사라지는 벽에 걸려 있(었)는 자리인가 */
export function inRemovedCornerWall(x: number, z: number, doorW: number): boolean {
  return x > doorW / 2 + CORNER_JAMB && z < CORNER_Z_MAX
}

export function resolveProp(p: SceneProp, doorW: number, openCorner: boolean) {
  const o = openCorner ? p.modes?.openCorner : undefined
  const base = o?.position ?? p.position
  const dx = p.anchor === 'doorL' ? -doorW / 2 : p.anchor === 'doorR' ? doorW / 2 : 0
  const position = [base[0] + dx, base[1], base[2]] as [number, number, number]
  // 명시 오버라이드가 규칙을 이긴다 — `hidden: false`로 예외를 둘 수 있는 탈출구
  const auto = openCorner && inRemovedCornerWall(position[0], position[2], doorW)
  return {
    position,
    rotation: (o?.rotation ?? p.rotation ?? [0, 0, 0]) as [number, number, number],
    hidden: o?.hidden ?? auto,
  }
}

/* ── 벽(구조) 파라미터 — 실측 기반 기본값, ?edit=1 슬라이더로 조절·저장 ── */
// <wall-params>
export const WALL_PARAMS = { vestMargin: 0.42, vestDepth: 1.935, wallH: 2.645, step: 0.06 }
// </wall-params>
export type WallParams = typeof WALL_PARAMS
/** 실측 근거 한계 — 슬라이더 범위이자 setWallParams 클램프 */
export const WALL_LIMITS: Record<keyof WallParams, [number, number]> = {
  vestMargin: [0.15, 0.6], vestDepth: [1.2, 2.2], wallH: [2.3, 2.9], step: [0, 0.08],
}

/* ── 기본 카메라 — App.tsx `<Canvas camera>` · `<OrbitControls target>`의 SSOT ──
 * 여기 말고 다른 곳에 좌표를 적지 않는다. 프레임 게이트가 이 값으로 판정하므로
 * 하드코딩이 남으면 게이트가 실제 화면과 다른 걸 재게 된다.
 */
export const CAMERA: Cam = {
  position: [1.8, 1.5, 3.4] as [number, number, number],
  // target y 1.15 → 0.98 (P-E3): 카메라 높이 1.5m·세로 반각 22.5°에서는 시선축이 5.2°만 내려가
  // **바닥이 카메라로부터 3.3m 밖일 때만 프레임에 든다** — 거실 러그를 어디에 깔아도 안 보이는
  // 기하학적 벽이었다. 천장(구도상 남아돌던 상단)을 내주고 바닥을 얻는다. 문 상단 여유는 2.3° 남는다.
  target: [0, 0.98, 0] as [number, number, number],
  fov: 45,
}

/* ── 프레임 게이트 — 소품이 실제로 화면에 잡히는가 ─────────────────────────
 * 각도 프록시(총 30°·세로 19°)를 쓰다가 창을 31.6°로 떨어뜨렸는데 실제로는 화면 안이었다
 * (ndc −0.82). 구면 각도는 가로 34°·세로 22.5°인 직사각 절두체를 못 그린다 — 프록시를 버리고
 * 카메라 절두체로 직접 투영한다.
 */
/** 판정용 화면비. 데스크톱 실측(1203×683 ≈ 1.76)보다 좁게 잡아 여유를 둔다 — 좁을수록 엄하다 */
export const FRAME_ASPECT = 1.63
/** 가장자리 여유 + 하단 UI 슬라이더가 캔버스의 ~7%를 덮는 몫 */
export const FRAME_NDC = { x: 0.94, top: 0.94, bottom: 0.86 }

export type Cam = { position: [number, number, number]; target: [number, number, number]; fov: number }

/** 카메라 기준 정규화 화면좌표. x·y ∈ [-1,1]이면 화면 안, behind면 카메라 뒤 */
export function frameNdc(p: readonly [number, number, number], cam: Cam = CAMERA, aspect = FRAME_ASPECT) {
  const [cx, cy, cz] = cam.position
  const [tx, ty, tz] = cam.target
  const f: [number, number, number] = [tx - cx, ty - cy, tz - cz]
  const lf = Math.hypot(...f)
  const fw = f.map((v) => v / lf) as [number, number, number]
  // right = forward × up(0,1,0) — 롤 없는 카메라라 이걸로 충분하다
  const r: [number, number, number] = [-fw[2], 0, fw[0]]
  const lr = Math.hypot(...r)
  const rt = r.map((v) => v / lr) as [number, number, number]
  const up: [number, number, number] = [
    rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0],
  ]
  const d: [number, number, number] = [p[0] - cx, p[1] - cy, p[2] - cz]
  const depth = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2]
  const th = Math.tan(((cam.fov / 2) * Math.PI) / 180)
  const x = (d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2]) / (depth * th * aspect)
  const y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / (depth * th)
  return { x, y, behind: depth <= 0 }
}

/** 원점이 화면 안인가 (여유분 적용) */
export function inFrame(p: readonly [number, number, number], cam: Cam = CAMERA, aspect = FRAME_ASPECT): boolean {
  const n = frameNdc(p, cam, aspect)
  return !n.behind && Math.abs(n.x) <= FRAME_NDC.x && n.y <= FRAME_NDC.top && n.y >= -FRAME_NDC.bottom
}

/* ── 충돌 검사 ─────────────────────────────────────────────────────────────
 * 방은 이미 파라메트릭이다(`WALL_PARAMS` + `doorW` + `anchor`). 없던 건 **경계 검사**뿐이라
 * 사람이 손으로 좌표를 계산해 "안 겹치네"를 확인해 왔다 — 신발 두 켤레가 0.014m로
 * 포개진 사고가 그래서 났다. 물리엔진이 아니라 AABB 한 겹으로 충분하다.
 */

/** SlidingDoor 문틀 세로폭 — Entryway의 JAMB와 같은 값 */
const CORNER_JAMB = 0.04

export interface Aabb { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

/** 소품의 축정렬 바운딩 박스. 회전(y축)은 회전 AABB로 환산한다. box가 없으면 null */
export function propAabb(p: SceneProp, doorW: number, openCorner: boolean): Aabb | null {
  if (!p.box) return null
  const r = resolveProp(p, doorW, openCorner)
  if (r.hidden) return null
  const { w, d, y } = p.box
  // 회전한 상자를 감싸는 AABB — |w·cosθ| + |d·sinθ|
  const c = Math.abs(Math.cos(r.rotation[1])), sn = Math.abs(Math.sin(r.rotation[1]))
  const W = (w * c + d * sn) / 2, D = (w * sn + d * c) / 2
  return {
    minX: r.position[0] - W, maxX: r.position[0] + W,
    minY: r.position[1] + y[0], maxY: r.position[1] + y[1],
    minZ: r.position[2] - D, maxZ: r.position[2] + D,
  }
}

export const overlaps = (a: Aabb, b: Aabb, eps = 0.005) =>
  a.minX < b.maxX - eps && b.minX < a.maxX - eps &&
  a.minY < b.maxY - eps && b.minY < a.maxY - eps &&
  a.minZ < b.maxZ - eps && b.minZ < a.maxZ - eps

/**
 * 방 경계. 현관(z<0)과 거실(z>0)은 벽이 다르다 —
 * 거실은 우측·뒷벽이 **없어서** 경계가 벽이 아니라 바닥 끝이다(줌아웃하면 드러나는 그 가장자리).
 */
export function roomBounds(doorW: number, wall: WallParams, openCorner: boolean) {
  const VEST = doorW / 2 + wall.vestMargin
  const boothIn = doorW / 2 + CORNER_JAMB
  return {
    /** 현관 — 좌우 전실벽, 뒷벽, 천장. ㄱ자면 우측이 부스 가벽까지 */
    vest: { minX: -VEST + 0.05, maxX: (openCorner ? boothIn : VEST) - 0.05, minZ: -wall.vestDepth + 0.05, maxZ: 0, maxY: wall.wallH },
    /** 거실 — 좌측 측벽만 실재, 나머지는 바닥 끝 */
    living: { minX: -2.45, maxX: 2.5, minZ: 0, maxZ: 3.5, maxY: wall.wallH },
  }
}

/* ── 여닫이 방향 규약 ────────────────────────────────────────────────────────
 * `dir`은 **문짝이 열려 가는 쪽**이다: `+1` 거실(+z, 안여닫이·기본) / `-1` 현관(-z).
 * 좌표계 뜻이지 힌지 좌우(좌수·우수)가 아니다 — 그건 각 렌더러의 `hingeLeft`가 정한다.
 *
 * 회전각 식을 여기 하나만 둔다. 렌더러(`AbsDoor`·`SwingDoor`)와 아래 궤적 게이트가
 * 같은 식을 봐야 "화면은 이쪽으로 열리는데 게이트는 저쪽을 검사"가 안 난다 —
 * 실제로 났었다: `SwingDoor`가 `+t·MAX·dir`이라 기본값에서 현관 쪽으로 열리는데
 * 게이트는 거실 쪽을 검사하고 있었다(2026-08-28 three 변환으로 실측).
 *
 * 부호 근거: three의 Y축 회전은 `z' = -x·sinθ`다. 자유단이 +z로 가려면 θ가 **음수**여야 한다.
 */
export const DOOR_MAX_ANGLE = (88 * Math.PI) / 180 // 90° 초과 시 문짝 끝이 좌측 문틀 밖으로 넘어가 붙박이 신발장을 관통
export const doorAngle = (t: number, dir: 1 | -1) => -t * DOOR_MAX_ANGLE * dir

/**
 * 문짝이 쓸고 가는 영역. **추측이 아니라 렌더 구현에서 읽은 값이다.**
 * - `AbsDoor.tsx`: 피벗 `[-W/2, …]` → **좌측 경첩**, 회전각은 위 `doorAngle`
 * - `SwingDoor.tsx`: `hingeLeft = N===1 || center<0` → **바깥 문틀 경첩**, 회전각 동일
 * - 슬라이딩 7종은 벽을 따라 미끄러지므로 문틀·레일 앞 최소 여유만
 *
 * 경첩 중심으로 재야 한다 — 개구부 선분 전체를 중심으로 잡으면 반원이 아니라 캡슐이 돼
 * 멀쩡한 소품을 문다(실제로 13건을 오탐했다).
 *
 * `sides`는 **여는 쪽 한쪽만**이다. 제품명이 "양방향"이어도 한 번에 한 방향으로만 열리므로,
 * 양쪽을 다 잡으면 반대쪽 붙박이 신발장까지 숨는다(2026-08-28). 붙박이는 문 때문에 사라지지 않는다.
 */
export function doorSweep(motion: string, panels: number, fixedPanels: number, doorW: number, dir: 1 | -1 = 1) {
  const h = doorW / 2
  if (motion === 'abs_hinged') return { hinges: [-h], radius: doorW, sides: [dir] }
  if (motion === 'swing_bi_directional') {
    const leaves = Math.max(1, panels - fixedPanels)
    return { hinges: leaves === 1 ? [-h] : [-h, h], radius: doorW / leaves, sides: [dir] }
  }
  return { hinges: [], radius: 0.12, sides: [1, -1] } // 슬라이딩 — 문틀 깊이(117mm) + 여유
}

/** 점이 문짝 궤적 안인가 */
export function inDoorSweep(x: number, z: number, sweep: ReturnType<typeof doorSweep>): boolean {
  if (!sweep.sides.some((s) => z * s > -0.05)) return false // 문이 안 도는 쪽은 대상 아님
  return sweep.hinges.some((hx) => Math.hypot(x - hx, z) < sweep.radius)
}

/** 문짝 아래 여유(m). 이보다 낮은 것(매트·러그)은 문이 그 위를 지난다 */
export const DOOR_UNDERCUT = 0.03

/**
 * 여닫이를 고르면 문짝이 쓸고 갈 자리의 **바닥 소품을 숨긴다.**
 * ㄱ자에서 사라진 벽에 걸린 소품을 숨기는 것(`inRemovedCornerWall`)과 같은 패턴이다 —
 * 좌표로는 못 푼다: 반경 1.25m 문이 양방향으로 쓸면 **보이는 바닥이 거의 다 궤적 안**이라
 * 소품을 빼면 프레임 밖으로 나가고, 남기면 문이 뚫고 지나간다.
 * 슬라이딩(7종)에선 반경이 0.12m라 사실상 아무것도 안 걸린다.
 */
export function propHiddenByDoorSweep(
  p: SceneProp, doorW: number, openCorner: boolean, sweep: ReturnType<typeof doorSweep>,
): boolean {
  if (p.fixture) return false // 붙박이는 문 때문에 사라지지 않는다
  const box = propAabb(p, doorW, openCorner)
  return box != null && hiddenByDoorSweep(box, sweep)
}

export function hiddenByDoorSweep(box: Aabb, sweep: ReturnType<typeof doorSweep>): boolean {
  if (!sweep.hinges.length) return false          // 슬라이딩 — 대상 아님
  if (box.minY > 0.4) return false                // 벽걸이는 문짝 높이 위
  if (box.maxY - box.minY < DOOR_UNDERCUT) return false // 매트·러그 위로는 문이 지난다
  const corners: [number, number][] = [
    [box.minX, box.minZ], [box.maxX, box.minZ], [box.minX, box.maxZ], [box.maxX, box.maxZ],
  ]
  return corners.some(([x, z]) => inDoorSweep(x, z, sweep))
}

/* ── 가림(occlusion) 게이트 ─────────────────────────────────────────────────
 * 이탈각·절두체는 "화면 안인가"만 잰다. 현관 소품은 그걸 통과하고도 **개구부 벽에 가려**
 * 0픽셀일 수 있다 — 우산꽂이가 실제로 그랬다(2026-08-27).
 * 카메라에서 소품으로 쏜 광선이 개구부(z=0 평면의 문 사각형)를 통과하는지 본다.
 * 얇은 근사다: 원점 한 점만 재므로 방화문처럼 폭이 큰 물체는 일부만 보여도 '가림'으로 나온다
 * — 그런 소품은 `wide: true`로 사유를 남긴다.
 */
export function passesOpening(p: readonly [number, number, number], doorW: number, doorH: number): boolean {
  const [cx, cy, cz] = CAMERA.position
  if (p[2] >= 0) return true // 거실 쪽은 개구부를 지날 일이 없다
  const t = cz / (cz - p[2]) // z=0 평면까지의 보간 비율
  const x = cx + t * (p[0] - cx)
  const y = cy + t * (p[1] - cy)
  return Math.abs(x) <= doorW / 2 && y >= 0 && y <= doorH
}

/* ── 모바일 카메라 ──────────────────────────────────────────────────────────
 * 세로 분할 레이아웃(캔버스 52vh)에서 화면비가 ~0.89로 좁아진다. three의 fov는 **세로**라
 * 화면비가 좁아지면 가로 시야가 그대로 깎인다 — fov45·화면비 0.89의 가로 반각은 20.2°로
 * 데스크톱(1.76에서 36.1°)의 56%다. 그 결과 **문 4모서리가 |ndc| 0.90까지 밀려** 제품이
 * 프레임에 꽉 낀다(소품이 밀려나는 건 그 다음 문제다).
 *
 * 카메라를 뒤로 빼는 해법은 못 쓴다 — 거실 깊이가 3.5m라 카메라가 방 밖으로 나간다.
 * fov만 넓힌다: 54면 문 모서리가 **0.73**으로 내려와 여유가 생긴다(문 화면높이 71%→58%,
 * 여전히 주인공). 62까지 올리면 0.62지만 광각 왜곡이 제품 비례를 흐린다.
 */
export const CAMERA_MOBILE: Cam = { ...CAMERA, fov: 54 }
/** iPhone 390×844 기준 캔버스(390 × 52vh) 화면비 */
export const FRAME_ASPECT_MOBILE = 0.888

/* ── OrbitControls 한계 (감사 D2) ───────────────────────────────────────────
 * `minPolarAngle` 부재로 세로 스와이프 한 번에 시점이 머리 위로 넘어가 문이 사라졌다.
 * 남는 건 **회전 한계뿐이다** — 그게 D2가 실제로 막으려던 것(문 소실)이고, 타깃이 문이라
 * 회전만 잡혀 있으면 제품은 항상 화면 중앙에 남는다.
 *
 * **거리 제한은 풀었다 (2026-08-27 주인님 결정).** 구 상한 4.6m는 기본 3.88m에서 18%밖에
 * 못 나가 줌아웃이 답답했다(줌인은 43%였다). 대가를 알고 푼 것이다 — 멀리 빼고 위로 젖히면
 * 카메라가 천장(2.645) 위로 올라가는데, 천장 면은 아래를 향한 단면이라 그 위에서는 안 보이고,
 * 거실엔 뒷벽·우측벽이 없어 세트 가장자리가 드러난다. 줌아웃을 '제대로' 열려면 그 벽들이 먼저다.
 * 기본 시점은 그대로 둔다(주인님 확인) — 앱을 열었을 때 보이는 구도는 안 바뀐다.
 *
 * 키를 지우지 않고 값만 무제한으로 둔 건 App.tsx가 이 키를 참조하고 있어서다 —
 * 동시에 편집 중인 파일을 건드리지 않으려는 선택이다(2026-08-27 레일 작업과 병행).
 *
 * 팬은 끈다 — 타깃이 문을 벗어나면 회전만으로는 복구가 안 되고, 쇼룸에서 타깃을 옮길 이유도 없다.
 */
export const ORBIT = {
  minPolar: 1.22,           // 69.9° — 더 젖히면 문이 시야에서 빠진다
  maxPolar: Math.PI / 2,    // 90° — 바닥 아래에서 올려다보지 않는다
  // 사실상 무제한 — 방이 5m라 20m면 한참 밖이다.
  // **`Infinity`를 쓰면 안 된다.** dev(비압축)에서는 멀쩡히 돌지만 **운영 빌드에서만 줌이 통째로
  // 죽는다** — 회전은 되고 콘솔 에러도 없어서 더 안 잡힌다. 실측 2026-08-27:
  // 운영 `Infinity` → 휠 이벤트에 프레임 변화 0 / 같은 코드 `20` → 정상. 로컬은 둘 다 정상이라
  // dev에서만 검증하면 못 잡는다. 설정 상수에 무한대를 넣지 말고 큰 유한값을 쓴다.
  minDistance: 0.8,
  maxDistance: 20,
  /** 이 거리 이상 벗어나면 '시점 초기화' 버튼을 띄운다 */
  resetHintDistance: 0.25,
}
