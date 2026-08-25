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
}

/** 문짝 분할 그리드 — 고시형/디바이딩 (R1-07). 좌표는 문짝 로컬 0~1 정규화 */
export interface PatternGrid {
  vLines: number[]
  hLines: number[]
  /** 랩핑MDF(막힘) 셀 — [row, col]. 없으면 전면 유리(오픈형) */
  solidCells: [number, number][]
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

