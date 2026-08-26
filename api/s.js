const SITE = 'https://moondaon-showroom.vercel.app'

/** 공유 랜딩 — 크롤러에겐 스크린샷 OG 카드를, 사람에겐 앱(#구성)으로 리다이렉트 */
export default function handler(req, res) {
  const { i = '', c = '' } = req.query
  let img = `${SITE}/og.png`
  try {
    const u = new URL(String(i))
    if (u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') && u.pathname.startsWith('/og/')) img = u.href
  } catch { /* 기본 카드 유지 */ }
  const conf = /^[A-Za-z0-9_-]*$/.test(String(c)) ? String(c) : ''
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const self = `${SITE}/s?i=${encodeURIComponent(img)}&c=${conf}`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400')
  res.send(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>문다온 3D 중문 쇼룸</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="문다온">
<meta property="og:title" content="문다온 3D 중문 쇼룸 — 내가 만든 중문">
<meta property="og:description" content="우리 집 중문, 직접 만들어봐요. 색상·유리·손잡이까지 셀프 견적.">
<meta property="og:url" content="${esc(self)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(img)}">
<script>location.replace('/#' + ${JSON.stringify(conf)})</script>
</head><body><a href="/#${esc(conf)}">문다온 쇼룸으로 이동</a></body></html>`)
}
