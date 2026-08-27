// 1 unit = 1m (전역 규약 — AR 실물 스케일의 전제)
export interface DoorSpec {
  /** 개구부 가로 (m) — 팜플렛 구간 A~D: 1.2~2.0 */
  width: number
  /** 개구부 높이 (m) — 팜플렛 최대높이 H2300 */
  height: number
  /** 문틀 깊이 (m) — 초슬림 3연동 알루미늄 117mm */
  frameDepth: number
  /** 문짝 프레임 단면: 정면폭 19mm × 깊이 32mm */
  stileWidth: number
  stileDepth: number
  panels: number
  /** 패널 겹침폭 (m) */
  overlap: number
  /** 간살 도어 — 세로 간살 (팜플렛: 기본간격 30~40mm) */
  louver?: { barW: number; gap: number }
  /** 하부레일 높이 (m) — 0이면 무레일(레일 메시를 그리지 않는다). 레일이 없는 제품은 undefined */
  railHeight?: number
  /** 패널별 폭 비율 (합 1) — 없으면 균등. 예: 도어+픽스 사이드라이트 [0.72, 0.28] */
  panelWidthFr?: number[]
  /** 고정(비개폐) 패널 인덱스 — 픽스창·ㄱ자 측면 */
  fixedPanels?: number[]
}

/** arc 프리미티브 — 문짝 내부 정규화 좌표, 코너/변 앵커 (수렴 PATTERN-V2) */
export interface PatternArc {
  anchor: 'tl' | 'tr' | 'bl' | 'br' | 'left' | 'right' | 'top' | 'bottom' | 'center'
  /** 앵커 기준 가로/세로 반경 (문짝 내부폭·높이 대비 0~1) */
  rx: number
  ry: number
  fill: 'solid' | 'glass'
  /** true면 보수 영역(코너 사각 − 사분타원) — 라운드탑 코너 등 */
  invert?: boolean
}

/** 문짝 분할 그리드 — 고시형/디바이딩 (R1-07). 좌표는 문짝 로컬 0~1 정규화 */
export interface PatternGrid {
  vLines: number[]
  hLines: number[]
  /** 랩핑MDF(막힘) 셀 — [row, col]. 없으면 전면 유리(오픈형) */
  solidCells: [number, number][]
  /** 아치 rise 비율 (문짝 높이 대비) — 있으면 상단 아치 문짝 (approx, 실측 시 교체) */
  archProfile?: number
  /** 아치 스팬드럴 — 있으면 직사각 문짝 + 아치 유리 + 코너 처리 (없으면 통아치 문짝) */
  spandrel?: 'solid' | 'glass'
  /** arc solid/glass 영역 목록 */
  arcs?: PatternArc[]
}

export interface DoorConfig {
  frameColor: string
  glassId: string
  pattern: PatternGrid
  quality: 'high' | 'lite'
}

export const SLIM_3TRACK: DoorSpec = {
  width: 1.6, // 구간 C (1601~1800 하한 근사)
  height: 2.3,
  frameDepth: 0.117,
  stileWidth: 0.019,
  stileDepth: 0.032,
  panels: 3,
  overlap: 0.06,
}

