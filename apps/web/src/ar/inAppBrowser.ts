/**
 * 인앱브라우저 감지 + 외부 브라우저 탈출 (AR 전용, 순수 함수 — DOM/three 의존 0)
 *
 * 왜 필요한가 — iOS 인앱브라우저는 WKWebView라 `<a rel="ar">` Quick Look이 **실행되지 않는다**.
 * 더 나쁜 건 에러조차 없이 USDZ 바이트가 깨진 글자로 표시된다는 점이다
 * (Facebook·Instagram·WeChat 동일 증상, iOS 15부터의 회귀 — Apple 포럼 690051 미해결).
 * 안드로이드 Chrome WebView는 WebXR이 비활성이라 model-viewer의 첫 모드가 실패한다.
 * 카톡으로 받은 링크가 AR의 주 유입 경로이므로, 감지가 없으면 그 손님은 전부 깨진 화면을 본다.
 */

export type InAppKind = 'kakao' | 'line' | 'instagram' | 'facebook' | 'naver' | 'other'

/** UA 조각 → 종류. 순서가 곧 우선순위 (인스타 UA는 FBAN도 함께 갖는 경우가 있다) */
const SIGNATURES: readonly (readonly [InAppKind, RegExp])[] = [
  ['kakao', /KAKAOTALK/i],
  ['line', /\bLine\//i],
  ['instagram', /Instagram/i],
  ['naver', /NAVER\(inapp|\bNAVER\b/i],
  ['facebook', /\bFBAN\/|\bFBAV\//i],
]

/**
 * UA 문자열 → 인앱브라우저 종류. 일반 브라우저면 null.
 * 카카오 공식 문서 기준 UA 예: `… Mobile/15E148 Safari/604.1 KAKAOTALK/10.8.2 (INAPP)`
 *
 * ponytail: `relList.supports('ar')` 기능 감지는 인앱 WKWebView에서도 true를 돌려주는 사례가
 * 보고돼 단독으로는 못 믿는다. UA 시그니처가 현재 유일하게 신뢰 가능한 판정이다.
 * ceiling — 목록에 없는 인앱은 null이 되어 일반 브라우저로 취급된다(=깨진 화면). 새 앱이
 * 문제되면 SIGNATURES에 한 줄 추가한다.
 */
export function detectInApp(ua: string): InAppKind | null {
  for (const [kind, re] of SIGNATURES) if (re.test(ua)) return kind
  return null
}

export function isIOSUA(ua: string): boolean {
  return /iPad|iPhone|iPod/.test(ua)
}

/**
 * 자동 탈출 URL. **null이면 자동 수단이 없다** — 호출부는 "⋯ → 다른 브라우저로 열기" 안내로 폴백한다.
 *
 * - 카카오: `kakaotalk://web/openExternal` (iOS·Android 공통. 카카오 공식 문서에 없는 비공식
 *   스킴이라 언제든 막힐 수 있다 → 실패해도 안내 배너가 남도록 호출부에서 화면을 지우지 않는다)
 * - 라인: `openExternalBrowser=1` 쿼리 (LINE이 공식 문서화한 방식)
 * - 그 외(인스타·네이버·페북): iOS 15 이후 강제 탈출 수단이 전부 막혔다. 안내만 가능하다.
 *
 * 안드로이드 `intent://…#Intent;…;end` 일반 탈출은 **의도적으로 넣지 않았다** — 우리 앱은 구성이
 * URL 해시에 실려 있는데 intent 문법이 `#`를 자기 것으로 먹어 구성이 통째로 날아간다.
 */
export function escapeUrl(kind: InAppKind, url: string): string | null {
  if (kind === 'kakao') return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`
  if (kind === 'line') return withParam(url, 'openExternalBrowser', '1')
  return null
}

/** 해시를 보존하며 쿼리 파라미터를 붙인다 (구성이 해시에 있으므로 문자열 이어붙이기는 금지) */
function withParam(url: string, key: string, value: string): string {
  const u = new URL(url)
  u.searchParams.set(key, value)
  return u.toString()
}

/** 사용자 안내 문구 — 앱마다 메뉴 위치가 달라 그대로 읽고 따라 할 수 있게 적는다 */
export function escapeHint(kind: InAppKind): string {
  if (kind === 'instagram') return '오른쪽 위 ⋯ → "외부 브라우저에서 열기"를 눌러 주세요.'
  if (kind === 'naver') return '오른쪽 아래 ⋮ → "다른 브라우저로 열기"를 눌러 주세요.'
  return '오른쪽 위 ⋯ → "다른 브라우저로 열기"를 눌러 주세요.'
}
