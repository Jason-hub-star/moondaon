import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeShare, DEFAULTS } from './shareSchema.ts'

/** 모든 필드가 유효한 정상 v2 링크 */
const ok = { ...DEFAULTS }

test('1. 없는 id는 필드별로 떨어지고 예외를 던지지 않는다', () => {
  for (const key of ['productId', 'colorId', 'glassId', 'patternId', 'handleId', 'railId'] as const) {
    const out = sanitizeShare({ ...ok, [key]: 'no-such-card' })
    assert.equal(out[key], undefined, `${key}가 통과했다`)
    // 오염되지 않은 형제 필드는 살아 있어야 한다
    assert.equal(out.colorId ?? DEFAULTS.colorId, DEFAULTS.colorId)
  }
})

test('1b. 프로토타입 상속 키는 id로 인정하지 않는다', () => {
  for (const evil of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(sanitizeShare({ ...ok, productId: evil }).productId, undefined, `${evil}가 통과했다`)
  }
})

test('2. widthM이 유한한 숫자가 아니면 폐기된다 (NaNmm 경로 차단)', () => {
  for (const bad of ['abc', null, {}, [], NaN, Infinity, -Infinity, true, undefined]) {
    const out = sanitizeShare({ ...ok, widthM: bad })
    assert.equal(out.widthM, undefined, `widthM=${String(bad)}가 통과했다`)
  }
})

test('2b. 범위 밖 widthM은 제품 허용 범위로 갇힌다 (해시에 원본이 남지 않는다)', () => {
  assert.equal(sanitizeShare({ ...ok, widthM: 50 }).widthM, 2)
  assert.equal(sanitizeShare({ ...ok, widthM: -3 }).widthM, 1.2)
})

test('3. 구조가 손상되면 빈 객체 — 전부 기본값으로 뜬다', () => {
  for (const bad of [null, undefined, 42, 'str', [], [1, 2], {}, { v: 3 }, { v: '2' }]) {
    assert.deepEqual(sanitizeShare(bad), {}, `${JSON.stringify(bad)}가 통과했다`)
  }
})

test('4. 정상 v2 링크는 입력 그대로 보존된다', () => {
  assert.deepEqual(sanitizeShare(ok), ok)
})

test('5. v1 링크는 v2로 승격되고 나머지 필드는 그대로다', () => {
  const v1 = { ...DEFAULTS, v: 1, colorId: 'navy', widthM: 1.6 }
  const out = sanitizeShare(v1)
  assert.equal(out.v, 2)
  assert.equal(out.colorId, 'navy')
  assert.equal(out.widthM, 1.6)
})

test('6. 한 필드만 오염되면 그 필드만 잃고 나머지는 남는다', () => {
  const out = sanitizeShare({ ...ok, productId: 'deleted-card', colorId: 'navy', widthM: 1.6 })
  assert.equal(out.productId, undefined)
  assert.equal(out.colorId, 'navy') // 고객이 고른 색은 살아남아야 한다
  assert.equal(out.glassId, DEFAULTS.glassId)
  assert.equal(out.widthM, 1.6)
})

test('7. panelPatterns는 원소별로 검증되고, 배열이 아니면 폐기된다', () => {
  const out = sanitizeShare({ ...ok, panelPatterns: ['open', 'no-such-pattern', null] })
  assert.deepEqual(out.panelPatterns, ['open', null, null])
  for (const bad of ['open', 42, {}, null]) {
    assert.equal(sanitizeShare({ ...ok, panelPatterns: bad }).panelPatterns, undefined)
  }
})

test('8. 감사 리포트 D1의 실제 링크가 앱을 죽이지 않는다', () => {
  const h = 'eyJ2IjoyLCJwcm9kdWN0SWQiOiJcIj48aW1nIHNyYz14PiIsImNvbG9ySWQiOiJ3aGl0ZSIsImdsYXNzSWQiOiJjbGVhciIsInBhdHRlcm5JZCI6Im9wZW4iLCJoYW5kbGVJZCI6ImJhc2ljLWFkaGVzaXZlIiwid2lkdGhNIjoxLjI1fQ'
  const raw = JSON.parse(Buffer.from(h, 'base64url').toString())
  const merged = { ...DEFAULTS, ...sanitizeShare(raw) }
  assert.equal(merged.productId, DEFAULTS.productId) // App.tsx의 PRODUCTS[productId]가 undefined가 될 수 없다
})

test('9. 감사 리포트 D5의 NaN 링크도 마찬가지다', () => {
  const raw = { ...ok, widthM: 'abc' }
  const merged = { ...DEFAULTS, ...sanitizeShare(raw) }
  assert.ok(Number.isFinite(merged.widthM))
})
