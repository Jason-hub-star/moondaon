import { put } from '@vercel/blob'
import { sameSite, rateLimited } from './_blob.js'

/**
 * 쇼룸 캔버스 스크린샷 업로드 → OG 카드용 공개 이미지 URL 반환.
 *
 * 감사 D3: 인증·오리진 검사·레이트리밋이 하나도 없어 외부에서 curl로 그대로 도달했다.
 * 유효한 JPEG data URL이면 주인님 Vercel 계정 블롭에 무제한으로 쌓인다 — 과금·저장소 남용.
 * 공개 앱이라 진짜 인증은 못 붙인다(누구나 토큰을 받을 수 있으므로 의미가 없다).
 * 대신 **브라우저에서 우리 사이트를 통해 온 요청만** 받고, 형식·크기·빈도로 조인다.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!sameSite(req)) return res.status(403).json({ error: 'forbidden' })

  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) return res.status(429).json({ error: 'too many uploads, try later' })

  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image ?? '')
  if (!m) return res.status(400).json({ error: 'image must be a JPEG data URL' })
  const buf = Buffer.from(m[1], 'base64')
  // 실제 JPEG인지는 매직바이트로 본다 — data URL 접두사는 누구나 붙일 수 있다
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return res.status(400).json({ error: 'not a JPEG' })
  }
  // 1200px 폭 q0.88 스크린샷은 실측 200~500KB다. 2MB면 충분히 넉넉하다
  if (buf.length > 2_000_000) return res.status(413).json({ error: 'image too large' })

  const blob = await put('og/config.jpg', buf, {
    access: 'public',
    contentType: 'image/jpeg',
    addRandomSuffix: true,
  })
  res.json({ url: blob.url })
}
