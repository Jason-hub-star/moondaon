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
  /** 씬 모드별 배치 오버라이드 — 개방형 코너(ㄱ자)는 벽이 달라져 소품 자리도 달라진다 */
  modes?: { openCorner?: PropOverride }
}

/*
 * 배치 근거(KKARTdoor 실측 + 에디터 실배치 2026-08-26 — 아래 블록은 저장 시 재작성되므로 주석은 여기에):
 * - 현관 바닥 소품 y=-0.045: Entryway v3 타일 단차(step)와 동기
 * - 현관 반폭 VEST=doorW/2+vestMargin — 벽 추종 소품은 doorL/doorR 앵커로 표현
 * - shoe-cabinet: 좌측벽 붙박이(깊이 0.35 → 중심 x=-doorW/2-0.055). ㄱ자 리턴은 우측만 침범, 스윙은 +z로 열림
 * - fire-door: 뒷벽 중앙 — 거실→중문→현관문 시선축(복도형 70%)
 */
// <scene-props>
export const SCENE_PROPS: SceneProp[] = [
  {
    id: 'shoe-cabinet',
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
    type: 'fireDoor',
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
    type: 'umbrellaStand',
    anchor: 'doorL',
    position: [
      1.375,
      -0.045,
      -1.72
    ],
    rotation: [
      0,
      0,
      0
    ]
  },
  {
    id: 'shoes-a',
    type: 'shoesDark',
    position: [
      -0.17,
      -0.05,
      -1.5
    ],
    rotation: [
      0,
      0.32,
      0
    ]
  },
  {
    id: 'shoes-b',
    type: 'shoesLight',
    position: [
      0.24,
      -0.03,
      -1.49
    ],
    rotation: [
      0,
      -0.18,
      0
    ]
  },
  {
    id: 'coat-hook',
    type: 'coatHook',
    position: [
      0.77,
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
    type: 'artTall',
    position: [
      -1.5625,
      1.55,
      0.09
    ]
  },
  {
    id: 'art-r',
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
/** SlidingDoor 문틀 세로폭 — Entryway의 JAMB와 같은 값 */
const CORNER_JAMB = 0.04
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
  // 사실상 무제한 — 방이 5m라 20m면 한참 밖이다. `Infinity` 대신 유한값을 쓰는 건
  // 로컬에서 둘 다 동작함을 확인한 뒤의 보수적 선택일 뿐이다(Infinity가 원인은 아니었다)
  minDistance: 0.8,
  maxDistance: 20,
  /** 이 거리 이상 벗어나면 '시점 초기화' 버튼을 띄운다 */
  resetHintDistance: 0.25,
}
