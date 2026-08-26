import { SlidingDoor } from './SlidingDoor'
import { SwingDoor } from './SwingDoor'
import { LShapeDoor } from './LShapeDoor'
import { AbsDoor } from './AbsDoor'
import type { DoorSpec, PatternGrid } from './types'
import { mirrorPattern } from './PanelMesh'
import { PATTERNS, PRODUCTS, type ColorId, type GlassId, type PatternId, type ProductId } from '../generated/cards'

interface Props {
  productId: ProductId
  widthM: number
  colorId: ColorId
  glassId: GlassId
  patternId: PatternId
  /** 패널별 오버라이드 (null/미지정 = patternId 균일) — 수렴 PATTERN-V2 */
  panelPatternIds?: (PatternId | null)[]
  handleLengthM: number
  quality: 'high' | 'lite'
  t: number
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
export function specFrom(productId: ProductId, widthM: number): DoorSpec {
  const p = PRODUCTS[productId] as (typeof PRODUCTS)[ProductId] & { panelWidthFr?: readonly number[]; fixedPanels?: readonly number[] }
  const [wMin, wMax] = p.widthRangeM
  return {
    width: Math.min(wMax, Math.max(wMin, widthM)),
    height: p.maxHeightM,
    frameDepth: p.frameDepthM,
    stileWidth: p.stileWidthM,
    stileDepth: p.stileDepthM,
    panels: p.panels,
    overlap: 0.06,
    louver: p.motion === 'louver_sliding' ? { barW: 0.03, gap: 0.035 } : undefined,
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
export function DoorModel({ productId, widthM, patternId, panelPatternIds, ...rest }: Props) {
  const p = PRODUCTS[productId]
  const spec = specFrom(productId, widthM)
  const patterns = resolvePanelPatterns(productId, spec, patternId, panelPatternIds)
  switch (p.motion) {
    case 'swing_bi_directional':
      return <SwingDoor spec={spec} patterns={patterns} {...rest} />
    case 'sliding_multi_panel_corner':
      return <LShapeDoor spec={spec} patterns={patterns} {...rest} />
    case 'abs_hinged':
      return <AbsDoor spec={spec} patterns={patterns} {...rest} />
    case 'sliding_multi_panel':
    case 'sliding_single_panel':
    default:
      return <SlidingDoor spec={spec} patterns={patterns} {...rest} />
  }
}
