import { put } from '@vercel/blob'

/** 쇼룸 캔버스 스크린샷 업로드 → OG 카드용 공개 이미지 URL 반환 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image ?? '')
  if (!m) return res.status(400).json({ error: 'image must be a JPEG data URL' })
  const buf = Buffer.from(m[1], 'base64')
  if (buf.length > 3_500_000) return res.status(413).json({ error: 'image too large' })
  const blob = await put('og/config.jpg', buf, {
    access: 'public',
    contentType: 'image/jpeg',
    addRandomSuffix: true,
  })
  res.json({ url: blob.url })
}
