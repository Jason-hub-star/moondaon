import { SlidingDoor } from './SlidingDoor'
import { SwingDoor } from './SwingDoor'
import { LShapeDoor } from './LShapeDoor'
import type { DoorSpec, PatternGrid } from './types'
import { PRODUCTS, type ColorId, type GlassId, type ProductId } from '../generated/cards'

interface Props {
  productId: ProductId
  widthM: number
  colorId: ColorId
  glassId: GlassId
  pattern: PatternGrid
  handleLengthM: number
  quality: 'high' | 'lite'
  t: number
}

/** 제품 카드 → DoorSpec (1 unit = 1m) */
export function specFrom(productId: ProductId, widthM: number): DoorSpec {
  const p = PRODUCTS[productId]
  const [wMin, wMax] = p.widthRangeM
  return {
    width: Math.min(wMax, Math.max(wMin, widthM)),
    height: p.maxHeightM,
    frameDepth: p.frameDepthM,
    stileWidth: p.stileWidthM,
    stileDepth: p.stileDepthM,
    panels: p.panels,
    overlap: 0.06,
  }
}

/** 제품 카드 motion → 개폐 컴포넌트 디스패치 */
export function DoorModel({ productId, widthM, ...rest }: Props) {
  const p = PRODUCTS[productId]
  const spec = specFrom(productId, widthM)
  switch (p.motion) {
    case 'swing_bi_directional':
      return <SwingDoor spec={spec} {...rest} />
    case 'sliding_multi_panel_corner':
      return <LShapeDoor spec={spec} {...rest} />
    case 'sliding_multi_panel':
    case 'sliding_single_panel':
    default:
      return <SlidingDoor spec={spec} {...rest} />
  }
}
