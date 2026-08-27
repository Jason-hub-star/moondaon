// 확장자를 붙여야 `node --test`가 이 파일을 번들러 없이 그대로 실행할 수 있다 (three/JSX 의존 0)
import { GLASSES, PRODUCTS } from '../generated/cards.ts'
import type { GlassId, ProductId } from '../generated/cards.ts'

/**
 * 5T 강화유리 규칙 (팜플렛 전 유리 페이지 공통):
 *   "상단의 유리를 포함한 유리로 제작 가능하며, 5T강화유리 옵션은 별도 (망입은 강화불가)"
 *   "양개도어 주문시 강화유리 기본적용"
 *
 * ponytail: 강화 가능 여부를 별도 필드로 두지 않고 `mesh`에서 파생한다 — 팜플렛이 금지한 것은
 * 망입 하나뿐이라 필드를 새로 만들면 같은 사실이 두 곳에 살게 된다. 한계: 망입이 아닌데 강화가
 * 안 되는 유리(굴곡·모루 성형 유리 등)가 확인되면 그때 유리 카드에 `temperable`을 신설한다.
 * 그 확인은 `glasses/*.md`의 confirmWith에 올려 두었다.
 */
export function temperable(glassId: GlassId): boolean {
  return !GLASSES[glassId].mesh
}

/** 양개도어는 주문 시 강화유리가 기본 적용된다 — 고객이 끌 수 없다 */
export function temperedLocked(productId: ProductId): boolean {
  return (PRODUCTS[productId] as { temperedDefault?: boolean }).temperedDefault === true
}

/**
 * 실제로 적용될 강화 여부. 고른 값을 그대로 믿지 않는다 —
 * 양개는 항상 참, 망입은 항상 거짓(둘이 겹치는 조합은 카드 게이트가 막는다).
 */
export function effectiveTempered(productId: ProductId, glassId: GlassId, tempered: boolean): boolean {
  if (temperedLocked(productId)) return true
  if (!temperable(glassId)) return false
  return tempered
}

/** 토글이 잠긴 이유. 잠기지 않았으면 null */
export function temperedLockReason(productId: ProductId, glassId: GlassId): string | null {
  if (temperedLocked(productId)) return '양개도어는 주문 시 강화유리가 기본 적용됩니다'
  if (!temperable(glassId)) return '망입유리(철망)는 강화 처리가 불가능합니다'
  return null
}
