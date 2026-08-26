/** 캔버스를 1200px 폭 JPEG로 줄여 업로드하고, 스크린샷 OG 카드가 붙은 공유 URL을 만든다 */
export async function sharePhoto(canvas: HTMLCanvasElement): Promise<string> {
  const scale = Math.min(1, 1200 / canvas.width)
  const off = document.createElement('canvas')
  off.width = Math.round(canvas.width * scale)
  off.height = Math.round(canvas.height * scale)
  off.getContext('2d')!.drawImage(canvas, 0, 0, off.width, off.height)
  const image = off.toDataURL('image/jpeg', 0.88)
  const r = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  })
  if (!r.ok) throw new Error(`upload ${r.status}`)
  const { url } = (await r.json()) as { url: string }
  return `${location.origin}/s?i=${encodeURIComponent(url)}&c=${location.hash.slice(1)}`
}
