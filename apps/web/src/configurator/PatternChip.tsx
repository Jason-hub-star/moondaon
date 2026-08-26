import { GLASSES, HANDLES, PATTERNS, PATTERN_THUMBS, PRODUCTS, PRODUCT_THUMBS, type GlassId, type HandleId, type PatternId, type ProductId } from '../generated/cards'

const chipStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 7px',
  borderRadius: 10, cursor: 'pointer',
  border: active ? '1.5px solid #c5a572' : '1px solid #d9d4ca',
  background: active ? '#f6efe3' : '#fff', color: '#2b2926',
})
const labelStyle: React.CSSProperties = { fontSize: 10, maxWidth: 62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const svgSrc = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** 패턴 선택 칩 — 카드에서 자동 생성된 SVG 미니어처(시각 게이트 겸용) + 이름 */
export function PatternChip({ id, active, onClick }: { id: PatternId; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={PATTERNS[id].name} style={chipStyle(active)}>
      <img src={svgSrc(PATTERN_THUMBS[id])} alt="" style={{ width: 26, height: 44 }} />
      <span style={labelStyle}>{PATTERNS[id].name}</span>
    </button>
  )
}

/** 제품 선택 칩 — motion·패널 구성에서 자동 생성된 개폐 실루엣 + 이름 */
export function ProductChip({ id, active, onClick }: { id: ProductId; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={PRODUCTS[id].name} style={chipStyle(active)}>
      <img src={svgSrc(PRODUCT_THUMBS[id])} alt="" style={{ width: 36, height: 43 }} />
      <span style={{ ...labelStyle, maxWidth: 76 }}>{PRODUCTS[id].name}</span>
    </button>
  )
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** 유리 선택 칩 — tint·불투명도·망입·샤틴을 카드 값 그대로 스와치화 */
export function GlassChip({ id, active, onClick }: { id: GlassId; active: boolean; onClick: () => void }) {
  const g = GLASSES[id]
  const layers: string[] = []
  if (g.mesh) layers.push('repeating-linear-gradient(45deg, rgba(110,105,95,.5) 0 1px, transparent 1px 5px)', 'repeating-linear-gradient(-45deg, rgba(110,105,95,.5) 0 1px, transparent 1px 5px)')
  if (g.roughness > 0.2) layers.push('linear-gradient(rgba(255,255,255,.55), rgba(255,255,255,.55))')
  layers.push(`linear-gradient(${rgba(g.tint, Math.min(0.9, 0.25 + g.opacity * 0.7))}, ${rgba(g.tint, Math.min(0.9, 0.25 + g.opacity * 0.7))})`)
  layers.push('linear-gradient(135deg, #ffffff 0%, #eef0f0 100%)')
  return (
    <button onClick={onClick} title={`${g.name} ${g.thicknessMm}mm`} style={chipStyle(active)}>
      <div style={{ width: 26, height: 36, borderRadius: 3, border: '1px solid #c9cdcb', background: layers.join(', ') }} />
      <span style={labelStyle}>{g.name}</span>
    </button>
  )
}

/** 손잡이 선택 칩 — 길이 비례 막대 */
export function HandleChip({ id, active, onClick }: { id: HandleId; active: boolean; onClick: () => void }) {
  const h = HANDLES[id]
  const barH = 10 + (h.lengthM / 0.9) * 26
  return (
    <button onClick={onClick} title={`${h.name} (${Math.round(h.lengthM * 1000)}mm)`} style={chipStyle(active)}>
      <div style={{ height: 38, display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 5, height: barH, borderRadius: 3, background: '#8f887e', border: '1px solid #6f695f' }} />
      </div>
      <span style={{ ...labelStyle, maxWidth: 84 }}>{h.name}</span>
    </button>
  )
}
