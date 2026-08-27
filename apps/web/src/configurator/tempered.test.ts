import { test } from 'node:test'
import assert from 'node:assert/strict'
import { temperable, temperedLocked, effectiveTempered, temperedLockReason } from './tempered.ts'
import { GLASSES, PRODUCTS } from '../generated/cards.ts'
import type { GlassId, ProductId } from '../generated/cards.ts'

const GS = Object.keys(GLASSES) as GlassId[]
const PS = Object.keys(PRODUCTS) as ProductId[]

test('T1. 망입유리는 강화 불가 — 나머지는 가능 (팜플렛 "망입은 강화불가")', () => {
  const mesh = GS.filter((g) => GLASSES[g].mesh)
  assert.equal(mesh.length, 3, '망입 3종이 아니다')
  for (const g of GS) assert.equal(temperable(g), !GLASSES[g].mesh, g)
})

test('T2. 망입을 고르면 강화를 켜 둘 수 없다 — 값이 조용히 살아남지 않는다', () => {
  for (const g of GS.filter((x) => GLASSES[x].mesh))
    assert.equal(effectiveTempered('slim-3track-19', g, true), false, g)
})

test('T3. 양개도어는 항상 강화 — 고객이 끌 수 없다', () => {
  const locked = PS.filter(temperedLocked)
  assert.ok(locked.length > 0, '강화 기본 제품이 하나도 없다')
  for (const p of locked) assert.equal(effectiveTempered(p, 'clear', false), true, p)
})

test('T4. 강화 기본 제품에는 망입이 허용되지 않는다 (두 규칙이 부딪히지 않는다)', () => {
  for (const p of PS.filter(temperedLocked)) {
    const allowed = (PRODUCTS[p] as { glassIds?: readonly string[] }).glassIds ?? GS
    for (const g of allowed) assert.equal(GLASSES[g as GlassId].mesh, false, `${p}/${g}`)
  }
})

test('T5. 잠긴 이유는 잠겼을 때만 나온다', () => {
  assert.equal(temperedLockReason('slim-3track-19', 'clear'), null)
  assert.match(temperedLockReason('slim-3track-19', 'steel-mesh')!, /망입/)
  assert.match(temperedLockReason('swing-2s', 'clear')!, /양개/)
})

test('T6. 일반 조합에서는 고른 값이 그대로 산다', () => {
  assert.equal(effectiveTempered('slim-3track-19', 'clear', true), true)
  assert.equal(effectiveTempered('slim-3track-19', 'clear', false), false)
})
