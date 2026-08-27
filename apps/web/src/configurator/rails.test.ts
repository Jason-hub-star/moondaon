import { test } from 'node:test'
import assert from 'node:assert/strict'
import { railsOf, railAllowed, effectiveRail, railHeightOf } from './rails.ts'
import { PRODUCTS, RAILS } from '../generated/cards.ts'
import type { ProductId, RailId } from '../generated/cards.ts'

const ALL = Object.keys(PRODUCTS) as ProductId[]

test('R1. 레일 목록은 실재하는 레일 카드만 가리킨다', () => {
  for (const p of ALL)
    for (const r of railsOf(p))
      assert.ok(Object.hasOwn(RAILS, r), `${p}: 없는 레일 카드 ${r}`)
})

test('R2. 슬라이딩 계열은 레일이 있고, 스윙·ABS 여닫이는 없다', () => {
  const hinged = ALL.filter((p) => ['swing_bi_directional', 'abs_hinged'].includes(PRODUCTS[p].motion))
  const sliding = ALL.filter((p) => !hinged.includes(p))
  for (const p of hinged) assert.equal(railsOf(p).length, 0, `${p}: 힌지 제품에 하부레일이 붙었다`)
  for (const p of sliding) assert.ok(railsOf(p).length > 0, `${p}: 슬라이딩 제품에 하부레일이 없다`)
})

test('R3. 무레일은 팜플렛이 명시한 자동 실내중문에만 붙는다', () => {
  for (const p of ALL)
    if (railsOf(p).includes('none' as RailId))
      assert.equal(p, 'auto-sliding', `${p}: 팜플렛에 없는 무레일 운영`)
})

test('R4. 허용 밖 레일이 주입되면 그 제품의 첫 레일로 떨어진다', () => {
  // 원슬 전용 25×5를 3연동에 실어 보내는 공유 링크
  assert.equal(effectiveRail('slim-3track-19', 'slim-25x5'), 'flat-7')
  assert.equal(railHeightOf('slim-3track-19', 'slim-25x5'), 0.007)
  // 허용된 값은 그대로 통과
  assert.equal(effectiveRail('slim-3track-19', 'raised-20'), 'raised-20')
  assert.equal(railHeightOf('slim-3track-19', 'raised-20'), 0.02)
})

test('R5. 레일이 없는 제품은 높이가 undefined — 0(무레일)과 구분된다', () => {
  assert.equal(effectiveRail('swing-2s', 'flat-7'), null)
  assert.equal(railHeightOf('swing-2s', 'flat-7'), undefined)
  assert.equal(railHeightOf('auto-sliding', 'none'), 0, '무레일은 높이 0으로 렌더된다')
})

test('R6. 문턱 높이는 문짝을 삼키지 않는다 (레일 < 문 높이)', () => {
  for (const p of ALL)
    for (const r of railsOf(p)) {
      const h = railHeightOf(p, r)!
      assert.ok(h >= 0 && h < PRODUCTS[p].maxHeightM, `${p}/${r}: 문턱 ${h}m가 문 높이 밖`)
    }
})

test('R7. railAllowed는 목록과 어긋나지 않는다', () => {
  for (const p of ALL)
    for (const r of Object.keys(RAILS) as RailId[])
      assert.equal(railAllowed(p, r), railsOf(p).includes(r), `${p}/${r}`)
})
