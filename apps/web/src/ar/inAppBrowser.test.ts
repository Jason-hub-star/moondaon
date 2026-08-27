import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectInApp, escapeUrl, escapeHint, isIOSUA } from './inAppBrowser.ts'

/** 카카오 공식 문서(developers.kakao.com/docs/ko/kakaologin/utilize)에 실린 UA 예시 그대로 */
const UA = {
  kakaoIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 KAKAOTALK/10.8.2 (INAPP)',
  kakaoAOS: 'Mozilla/5.0 (Linux; Android 14; SM-S908N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.134 Mobile Safari/537.36 KAKAOTALK/10.8.3 (INAPP)',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.5.0',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 331.0.0.37.90',
  naver: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 1000; 12.9.2)',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/468.0.0.42.107]',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeAOS: 'Mozilla/5.0 (Linux; Android 14; SM-S908N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.134 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
}

test('1. 카카오톡 인앱은 iOS·안드로이드 양쪽 UA에서 잡힌다', () => {
  assert.equal(detectInApp(UA.kakaoIOS), 'kakao')
  assert.equal(detectInApp(UA.kakaoAOS), 'kakao')
})

test('2. 다른 인앱브라우저도 각각의 종류로 잡힌다', () => {
  assert.equal(detectInApp(UA.line), 'line')
  assert.equal(detectInApp(UA.instagram), 'instagram')
  assert.equal(detectInApp(UA.naver), 'naver')
  assert.equal(detectInApp(UA.facebook), 'facebook')
})

test('3. 일반 브라우저는 null — AR을 막지 않는다 (오탐이 곧 기능 차단이다)', () => {
  for (const ua of [UA.safari, UA.chromeAOS, UA.desktop]) {
    assert.equal(detectInApp(ua), null, `오탐: ${ua}`)
  }
})

test('4. iOS 판정은 인앱 여부와 독립이다 (카톡 iOS는 둘 다 참)', () => {
  assert.equal(isIOSUA(UA.kakaoIOS), true)
  assert.equal(isIOSUA(UA.kakaoAOS), false)
  assert.equal(isIOSUA(UA.safari), true)
})

test('5. 카카오 탈출 URL은 원본을 통째로 인코딩해 실는다 (해시의 구성이 살아야 한다)', () => {
  const src = 'https://moondaon-showroom.vercel.app/#p=slide-3s&c=P02&w=2.4'
  const out = escapeUrl('kakao', src)
  assert.ok(out, '카카오는 자동 탈출 URL이 있어야 한다')
  assert.ok(out.startsWith('kakaotalk://web/openExternal?url='))
  assert.equal(decodeURIComponent(out.split('url=')[1]), src)
})

test('6. 라인 탈출은 쿼리를 붙이되 해시를 잃지 않는다', () => {
  const out = escapeUrl('line', 'https://x.app/#p=slide-3s&w=2.4')
  assert.equal(out, 'https://x.app/?openExternalBrowser=1#p=slide-3s&w=2.4')
})

test('7. 자동 탈출 수단이 없는 앱은 null을 돌려 안내로 폴백시킨다', () => {
  for (const kind of ['instagram', 'naver', 'facebook', 'other'] as const) {
    assert.equal(escapeUrl(kind, 'https://x.app/'), null, `${kind}가 탈출 URL을 만들었다`)
    assert.ok(escapeHint(kind).length > 0, `${kind} 안내 문구가 비었다`)
  }
})
