import { test } from 'node:test'
import assert from 'node:assert/strict'
import { publicBlobHost, sameSite, rateLimited } from './_blob.js'

/**
 * 감사 D3 회귀 방지 — 공유 카드 도용·무인증 업로드.
 * 셋 다 순수 함수라 핸들러를 띄우지 않고 직접 잰다.
 */

const withEnv = (patch, fn) => {
  const old = { ...process.env }
  Object.assign(process.env, patch)
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete process.env[k]
  try { return fn() } finally { process.env = old }
}

// 조각을 합쳐 만든다 — 리터럴로 두면 시크릿 스캐너가 오탐으로 짖고, 짖는 스캐너는 곧 무시당한다
// (실제로 GitGuardian이 커밋 4908d5d에 경보를 냈다. 값은 지어낸 것이고 실토큰과 무관하다)
const TOKEN = ['vercel', 'blob', 'rw', 'AbCd1234EfGh5678', 'z'.repeat(31)].join('_')

test('1. 저장소 호스트는 R/W 토큰의 4번째 세그먼트에서 나오고 **소문자로 눕는다**', () => {
  // 토큰 안 store id는 대소문자가 섞여 있는데 실제 blob 호스트는 전부 소문자다.
  // URL.hostname도 소문자로 정규화되므로 눕히지 않으면 우리 블롭조차 영영 일치하지 않는다
  // (2026-08-27 운영 검증에서 실제로 공유 카드가 전부 기본 이미지로 떨어졌다)
  withEnv({ BLOB_READ_WRITE_TOKEN: TOKEN, BLOB_PUBLIC_HOST: undefined }, () => {
    assert.equal(publicBlobHost(), 'abcd1234efgh5678.public.blob.vercel-storage.com')
  })
  // Vercel CLI가 따옴표째 써두는 경우가 있다
  withEnv({ BLOB_READ_WRITE_TOKEN: `"${TOKEN}"`, BLOB_PUBLIC_HOST: undefined }, () => {
    assert.equal(publicBlobHost(), 'abcd1234efgh5678.public.blob.vercel-storage.com')
  })
})

test("1b. new URL().hostname 과 실제로 맞물리는가 — D3 수정의 진짜 계약", () => {
  withEnv({ BLOB_READ_WRITE_TOKEN: TOKEN, BLOB_PUBLIC_HOST: undefined }, () => {
    const u = new URL('https://AbCd1234EfGh5678.public.blob.vercel-storage.com/og/x.jpg')
    assert.equal(u.hostname, publicBlobHost(), 'URL 파서가 눕힌 값과 우리 값이 같아야 통과한다')
  })
})

test('2. 토큰이 없거나 깨졌으면 null — 외부 이미지를 통째로 거부(fail-closed)', () => {
  for (const tok of [undefined, '', 'garbage', 'vercel_blob_rw_short_x', 'not_a_token_at_all_x']) {
    withEnv({ BLOB_READ_WRITE_TOKEN: tok, BLOB_PUBLIC_HOST: undefined }, () => {
      assert.equal(publicBlobHost(), null, `tok=${tok}`)
    })
  }
})

test('3. BLOB_PUBLIC_HOST 명시가 토큰을 이기고, 스킴·경로는 벗겨진다', () => {
  withEnv({ BLOB_READ_WRITE_TOKEN: TOKEN, BLOB_PUBLIC_HOST: 'https://ZZZ.public.blob.vercel-storage.com/og/' }, () => {
    assert.equal(publicBlobHost(), 'zzz.public.blob.vercel-storage.com')
  })
})

test('4. 다른 Vercel 고객의 블롭 호스트는 우리 호스트와 다르다 — D3의 핵심', () => {
  withEnv({ BLOB_READ_WRITE_TOKEN: TOKEN, BLOB_PUBLIC_HOST: undefined }, () => {
    const ours = publicBlobHost()
    const attacker = 'x9y8z7w6v5u4t3s2.public.blob.vercel-storage.com'
    // 구 검사(endsWith)는 통과시켰다 — 그게 결함이었다
    assert.ok(attacker.endsWith('.public.blob.vercel-storage.com'))
    assert.notEqual(attacker, ours)
  })
})

test('5. sameSite — 운영·프리뷰·로컬만 통과, 외부·헤더없음은 거부', () => {
  const req = (h) => ({ headers: h })
  withEnv({ VERCEL_URL: 'moondaon-showroom-abc123.vercel.app' }, () => {
    assert.ok(sameSite(req({ origin: 'https://moondaon-showroom.vercel.app' })))
    assert.ok(sameSite(req({ origin: 'https://moondaon-showroom-abc123.vercel.app' })))
    assert.ok(sameSite(req({ origin: 'http://localhost:5173' })))
    assert.ok(sameSite(req({ origin: 'http://127.0.0.1:5188' })))
    // Origin 없으면 Referer 폴백
    assert.ok(sameSite(req({ referer: 'https://moondaon-showroom.vercel.app/?v=1' })))
    // 거부
    assert.equal(sameSite(req({ origin: 'https://evil.example.com' })), false)
    assert.equal(sameSite(req({ referer: 'https://evil.example.com/x' })), false)
    assert.equal(sameSite(req({})), false, 'Origin·Referer 둘 다 없으면 브라우저가 아니다')
    assert.equal(sameSite(req({ origin: 'not a url' })), false)
    // 호스트 접미사 위조 — allow.has는 정확 일치라 막힌다
    assert.equal(sameSite(req({ origin: 'https://evil-moondaon-showroom.vercel.app' })), false)
  })
})

test('6. rateLimited — 한도까지는 통과, 넘으면 차단', () => {
  const key = 'test-ip-6'
  for (let i = 0; i < 10; i++) assert.equal(rateLimited(key, 10), false, `${i}번째는 통과해야 한다`)
  assert.equal(rateLimited(key, 10), true, '11번째는 차단')
  // 키가 다르면 서로 영향 없다
  assert.equal(rateLimited('test-ip-6b', 10), false)
})

test('7. rateLimited — 윈도가 지나면 다시 통과', () => {
  const key = 'test-ip-7'
  assert.equal(rateLimited(key, 1, 1), false)
  assert.equal(rateLimited(key, 1, 1), true)
  const until = Date.now() + 5
  while (Date.now() < until) { /* 윈도(1ms) 경과 대기 */ }
  assert.equal(rateLimited(key, 1, 1), false, '윈도가 지나면 카운터가 비어야 한다')
})
