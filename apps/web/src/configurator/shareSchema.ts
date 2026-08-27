// 확장자를 붙여야 `node --test`가 이 파일을 번들러 없이 그대로 실행할 수 있다 (형제 파일들은 vite 해석에 맡긴다)
import { PRODUCTS, COLORS, GLASSES, PATTERNS, HANDLES } from '../generated/cards.ts'
import type { ColorId, GlassId, PatternId, HandleId, ProductId } from '../generated/cards.ts'

export interface ShareState {
  /** URL 공유 스키마 버전 (수렴: 카드 변경에서 옛 링크 보호. v2: panelPatterns 추가) */
  v: 2
  productId: ProductId
  colorId: ColorId
  glassId: GlassId
  patternId: PatternId
  handleId: HandleId
  /** 개구부 가로 (m) — 팜플렛 구간 A~D */
  widthM: number
  /** 패널별 패턴 오버라이드 (수렴 PATTERN-V2) — null/미지정 = patternId 균일 적용 */
  panelPatterns?: (PatternId | null)[]
}

export const DEFAULTS: ShareState = { v: 2, productId: 'slim-3track-19', colorId: 'white', glassId: 'clear', patternId: 'open', handleId: 'basic-adhesive', widthM: 1.25 } // widthM: KKARTdoor 쇼츠 64편 실측 중앙값 1214mm(2026-08-26)

/** 카드에 실재하는 id인가. hasOwn이라 '__proto__'·'constructor' 같은 상속 키는 통과 못 한다 */
const isCardId = (table: object, v: unknown): v is string => typeof v === 'string' && Object.hasOwn(table, v)

/**
 * 공유 링크로 들어온 값을 카드 실재 여부·수치 유효성으로 거른다.
 *
 * 오염된 필드'만' 떨어뜨리고 나머지는 살린다 — 통째로 버리면 카드 하나 이름이 바뀐 것만으로
 * 고객이 고른 색·유리까지 같이 날아간다. 반환에 없는 필드는 호출부에서 DEFAULTS가 메운다.
 */
export function sanitizeShare(raw: unknown): Partial<ShareState> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  if (o.v !== 1 && o.v !== 2) return {} // v1 링크는 patternId 균일 적용으로 v2와 동일 렌더
  const out: Partial<ShareState> = { v: 2 }

  if (isCardId(PRODUCTS, o.productId)) out.productId = o.productId as ProductId
  if (isCardId(COLORS, o.colorId)) out.colorId = o.colorId as ColorId
  if (isCardId(GLASSES, o.glassId)) out.glassId = o.glassId as GlassId
  if (isCardId(PATTERNS, o.patternId)) out.patternId = o.patternId as PatternId
  if (isCardId(HANDLES, o.handleId)) out.handleId = o.handleId as HandleId

  // 폭은 제품이 정해진 뒤에야 범위를 안다 — 주입된 값이 해시에 그대로 남지 않도록 여기서 가둔다
  if (typeof o.widthM === 'number' && Number.isFinite(o.widthM)) {
    const [lo, hi] = PRODUCTS[out.productId ?? DEFAULTS.productId].widthRangeM
    out.widthM = Math.min(hi, Math.max(lo, o.widthM))
  }

  if (Array.isArray(o.panelPatterns)) {
    out.panelPatterns = o.panelPatterns.map((p) => (isCardId(PATTERNS, p) ? (p as PatternId) : null))
  }
  return out
}
