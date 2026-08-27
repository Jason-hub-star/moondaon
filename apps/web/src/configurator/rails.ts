// 확장자를 붙여야 `node --test`가 이 파일을 번들러 없이 그대로 실행할 수 있다 (three/JSX 의존 0)
import { PRODUCTS, RAILS } from '../generated/cards.ts'
import type { RailId, ProductId } from '../generated/cards.ts'

/** 제품이 운영하는 하부레일 목록. 빈 배열이면 레일 개념이 없는 제품(스윙·ABS 여닫이) */
export function railsOf(productId: ProductId): RailId[] {
  return (((PRODUCTS[productId] as { railIds?: readonly string[] }).railIds ?? []) as RailId[]).slice()
}

export function railAllowed(productId: ProductId, railId: RailId): boolean {
  return railsOf(productId).includes(railId)
}

/**
 * 실제로 렌더에 쓰일 레일 id. 제품이 허용하지 않는 값이 들어오면 그 제품의 첫 레일로 떨어뜨린다 —
 * 공유 링크가 원슬 레일(25×5)을 3연동에 실어 보내도 카드 밖 값이 화면에 남지 않게 한다.
 * 레일이 없는 제품은 null.
 */
export function effectiveRail(productId: ProductId, railId: RailId): RailId | null {
  const allowed = railsOf(productId)
  if (!allowed.length) return null
  return allowed.includes(railId) ? railId : allowed[0]
}

/** 문턱 높이 (m). 무레일은 0, 레일이 없는 제품은 undefined */
export function railHeightOf(productId: ProductId, railId: RailId): number | undefined {
  const id = effectiveRail(productId, railId)
  return id === null ? undefined : RAILS[id].heightMm / 1000
}
