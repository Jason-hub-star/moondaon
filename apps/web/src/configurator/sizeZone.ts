// 확장자를 붙여야 `node --test`가 이 파일을 번들러 없이 그대로 실행할 수 있다 (three/JSX 의존 0)
import { PRODUCTS } from '../generated/cards.ts'
import type { ProductId } from '../generated/cards.ts'

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * 팜플렛 "구간별 사이즈" 라벨. 구간표가 없는 제품(스윙·원슬·ABS)은 null —
 * 표가 있는 제품마다 구간이 다르므로(3연동 1200~2000 / 간살 1000~1500) 카드에서 읽는다.
 *
 * 어느 구간에도 안 걸리는 폭이 나올 수 있다: 간살 팜플렛은 A 1000~1100 다음이 B 1201~1300이라
 * 1101~1200이 비어 있다. 인쇄 누락인지 실제 미운영인지 확인 전이라 표를 그대로 두고,
 * 걸치지 않는 폭은 "구간 밖"으로 정직하게 말한다.
 */
export function sizeZoneOf(productId: ProductId, widthM: number): string | null {
  const zones = (PRODUCTS[productId] as { sizeZonesMm?: readonly (readonly [number, number])[] }).sizeZonesMm
  if (!zones?.length) return null
  const mm = Math.round(widthM * 1000)
  const i = zones.findIndex(([lo, hi]) => mm >= lo && mm <= hi)
  if (i < 0) return `구간 밖 (${mm}mm)`
  return `${LABELS[i]}구간 (${zones[i][0]}~${zones[i][1]})`
}
