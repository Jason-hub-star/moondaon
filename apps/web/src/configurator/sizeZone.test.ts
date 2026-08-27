import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sizeZoneOf } from './sizeZone.ts'
import { PRODUCTS } from '../generated/cards.ts'
import type { ProductId } from '../generated/cards.ts'

const ALL = Object.keys(PRODUCTS) as ProductId[]
const zonesOf = (p: ProductId) => (PRODUCTS[p] as { sizeZonesMm?: readonly (readonly [number, number])[] }).sizeZonesMm

test('Z1. 구간표가 없는 제품은 null — UI가 라벨을 안 그린다', () => {
  for (const p of ALL) if (!zonesOf(p)) assert.equal(sizeZoneOf(p, 1.3), null, p)
})

test('Z2. 3연동과 간살은 서로 다른 표를 쓴다 (같은 폭에서 다른 답)', () => {
  assert.equal(sizeZoneOf('slim-3track-19', 1.3), 'A구간 (1200~1400)')
  assert.equal(sizeZoneOf('louver', 1.05), 'A구간 (1000~1100)')
  assert.equal(sizeZoneOf('louver', 1.45), 'D구간 (1401~1500)')
})

test('Z3. 팜플렛 간살 표의 1101~1200 공백은 감추지 않는다', () => {
  assert.equal(sizeZoneOf('louver', 1.15), '구간 밖 (1150mm)')
})

test('Z4. 구간 경계값이 정확히 걸린다 (하한·상한 포함)', () => {
  for (const p of ALL) {
    const z = zonesOf(p); if (!z) continue
    for (const [lo, hi] of z) {
      assert.ok(sizeZoneOf(p, lo / 1000)?.includes(`${lo}~${hi}`), `${p} 하한 ${lo}`)
      assert.ok(sizeZoneOf(p, hi / 1000)?.includes(`${lo}~${hi}`), `${p} 상한 ${hi}`)
    }
  }
})

test('Z5. 슬라이더가 만들 수 있는 폭은 표 범위를 벗어나지 않는다', () => {
  for (const p of ALL) {
    const z = zonesOf(p); if (!z) continue
    const [wMin, wMax] = PRODUCTS[p].widthRangeM
    assert.equal(Math.round(wMin * 1000), z[0][0], `${p} 하한`)
    assert.equal(Math.round(wMax * 1000), z[z.length - 1][1], `${p} 상한`)
  }
})
