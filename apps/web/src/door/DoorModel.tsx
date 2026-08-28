import { SlidingDoor } from './SlidingDoor'
import { SwingDoor } from './SwingDoor'
import { AbsDoor } from './AbsDoor'
import type { DoorSpec, PatternGrid } from './types'
import { mirrorPattern } from './PanelMesh'
import { railHeightOf } from '../configurator/rails'
import { PATTERNS, PRODUCTS, type ColorId, type GlassId, type PatternId, type RailId, type ProductId } from '../generated/cards'

interface Props {
  productId: ProductId
  widthM: number
  colorId: ColorId
  glassId: GlassId
  patternId: PatternId
  /** 패널별 오버라이드 (null/미지정 = patternId 균일) — 수렴 PATTERN-V2 */
  panelPatternIds?: (PatternId | null)[]
  railId: RailId
  handleLengthM: number
  quality: 'high' | 'lite'
  t: number
  /** 여닫이 여는 방향 — +1 거실(기본) / -1 현관. 슬라이딩 계열에선 무시된다 */
  dir?: 1 | -1
}

/** 패턴 카드(readonly) → 가변 PatternGrid */
export function gridOf(id: PatternId): PatternGrid {
  const p = PATTERNS[id] as unknown as PatternGrid & { arcs?: PatternGrid['arcs'] }
  return {
    vLines: [...p.vLines],
    hLines: [...p.hLines],
    solidCells: p.solidCells.map((c) => [...c] as [number, number]),
    archProfile: p.archProfile,
    spandrel: p.spandrel,
    arcs: p.arcs?.map((a) => ({ ...a })),
  }
}

/** 제품 카드 → DoorSpec (1 unit = 1m) */
export function specFrom(productId: ProductId, widthM: number, railId: RailId): DoorSpec {
  // 카드가 제품마다 다른 필드를 갖는다(리터럴 유니온) — 옵셔널 수치는 여기서 한 번만 넓힌다
  const p = PRODUCTS[productId] as (typeof PRODUCTS)[ProductId] & {
    panelWidthFr?: readonly number[]; fixedPanels?: readonly number[]
    overlapM?: number; louverBarM?: number; louverGapM?: number
    trackPitchM?: number; panelThicknessM?: number
  }
  const [wMin, wMax] = p.widthRangeM
  return {
    railHeight: railHeightOf(productId, railId),
    width: Math.min(wMax, Math.max(wMin, widthM)),
    height: p.maxHeightM,
    frameDepth: p.frameDepthM,
    stileWidth: p.stileWidthM,
    stileDepth: p.stileDepthM,
    panels: p.panels,
    overlap: p.overlapM ?? 0,
    jamb: p.jambM,
    trackPitch: p.trackPitchM ?? 0,
    panelThickness: p.panelThicknessM,
    louver: p.louverBarM != null && p.louverGapM != null ? { barW: p.louverBarM, gap: p.louverGapM } : undefined,
    panelWidthFr: p.panelWidthFr ? [...p.panelWidthFr] : undefined,
    fixedPanels: p.fixedPanels ? [...p.fixedPanels] : undefined,
  }
}

/** 패널별 패턴 해석 — 명시 오버라이드 > 2S 양개 오른짝 자동 미러 > 균일 */
export function resolvePanelPatterns(productId: ProductId, spec: DoorSpec, patternId: PatternId, overrides?: (PatternId | null)[]): PatternGrid[] {
  const motion = PRODUCTS[productId].motion
  const base = gridOf(patternId)
  const fixed = new Set(spec.fixedPanels ?? [])
  return Array.from({ length: spec.panels }, (_, i) => {
    const explicit = overrides?.[i]
    if (explicit && explicit in PATTERNS) return gridOf(explicit)
    if (motion === 'swing_bi_directional' && spec.panels >= 2 && !fixed.has(i) && i >= spec.panels / 2) return mirrorPattern(base)
    return base
  })
}

/** 제품 카드 motion → 개폐 컴포넌트 디스패치 */
export function DoorModel({ productId, widthM, patternId, panelPatternIds, railId, dir = 1, ...rest }: Props) {
  const p = PRODUCTS[productId]
  const spec = specFrom(productId, widthM, railId)
  const patterns = resolvePanelPatterns(productId, spec, patternId, panelPatternIds)
  // dir은 여닫이 두 종에만 넘긴다 — 슬라이딩 컴포넌트는 받지 않는 prop이다
  switch (p.motion) {
    case 'swing_bi_directional':
      return <SwingDoor spec={spec} patterns={patterns} dir={dir} {...rest} />
    case 'sliding_multi_panel_corner':
      // ㄱ의 꺾인 면은 도어 부속이 아니라 전실(부스) 구조물이 만든다 — Entryway openCorner의 가벽·고정유리.
      // 도어 자체는 정면 3연동과 동일해 SlidingDoor를 재사용한다 (구 LShapeDoor의 폭 1/3 측면 픽스는
      // 정면 옆에 좁은 문짝이 하나 더 선 것처럼 보여 제거 — 2026-08-27)
      return <SlidingDoor spec={spec} patterns={patterns} {...rest} />
    case 'abs_hinged':
      return <AbsDoor spec={spec} patterns={patterns} dir={dir} {...rest} />
    case 'automatic_sliding':
      // 자동문은 손잡이가 없다 — 센서 개폐 (실물 관행)
      return <SlidingDoor spec={spec} patterns={patterns} {...rest} handleLengthM={0} />
    case 'sliding_multi_panel':
    case 'sliding_single_panel':
    default:
      return <SlidingDoor spec={spec} patterns={patterns} {...rest} />
  }
}
