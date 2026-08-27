/**
 * 이 프로젝트 블롭 저장소의 **공개 호스트 하나**. 감사 D3의 뿌리가 여기였다 —
 * 구 검사는 `endsWith('.public.blob.vercel-storage.com')`이라 Vercel 고객 **전체**의
 * 블롭 호스트를 통과시켰다. 무료 계정 하나만 있으면 우리 도메인의 OG 카드에 남의 이미지를 실을 수 있었다.
 *
 * 저장소 id는 R/W 토큰의 4번째 세그먼트다 — `vercel_blob_rw_<storeId>_<secret>`.
 * storeId는 공개 blob URL에 그대로 드러나므로 비밀이 아니다(비밀은 마지막 세그먼트).
 * 구할 수 없으면 `null`을 돌려주고, 호출부는 외부 이미지를 통째로 거부한다 — **fail-closed**.
 */
export function publicBlobHost() {
  const explicit = process.env.BLOB_PUBLIC_HOST
  if (explicit) return norm(explicit.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  const seg = String(process.env.BLOB_READ_WRITE_TOKEN ?? '').replace(/^"|"$/g, '').split('_')
  const storeId = seg[0] === 'vercel' && seg[1] === 'blob' && seg.length >= 5 ? seg[3] : ''
  return /^[A-Za-z0-9]{8,}$/.test(storeId) ? norm(`${storeId}.public.blob.vercel-storage.com`) : null
}

/**
 * 소문자로 눕힌다. **토큰 안의 store id는 대소문자가 섞여 있는데(kfpb6CTDHooPslmB) 실제 blob
 * 호스트는 전부 소문자다(kfpb6ctdhoopslmb).** `URL.hostname`도 항상 소문자로 정규화되므로,
 * 눕히지 않으면 우리 블롭조차 한 번도 일치하지 않아 공유 카드가 전부 기본 이미지로 떨어진다
 * — 배포 후 운영 검증에서 실제로 그렇게 났다 (2026-08-27).
 */
const norm = (h) => h.toLowerCase()

/** 우리 사이트에서 온 요청인가. 브라우저는 same-origin POST에도 Origin을 붙인다 */
export function sameSite(req) {
  const allow = new Set(['moondaon-showroom.vercel.app'])
  if (process.env.VERCEL_URL) allow.add(process.env.VERCEL_URL) // 프리뷰 배포 자신
  const hostOf = (v) => { try { return new URL(v).host } catch { return '' } }
  const dev = (h) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h)
  // Origin 우선. 없으면 Referer로 폴백하고, 둘 다 없으면 거부한다 —
  // 그 조합은 브라우저가 아니라는 뜻이고, 이 엔드포인트는 브라우저 전용이다
  const h = hostOf(req.headers.origin ?? '') || hostOf(req.headers.referer ?? '')
  return !!h && (allow.has(h) || dev(h))
}

/**
 * 인스턴스 로컬 슬라이딩 윈도 레이트리밋.
 * ponytail: 서버리스라 인스턴스마다 카운터가 따로 논다 — 분산 한도가 아니라 **단일 클라이언트의
 * 폭주만** 막는 안전판이다. ceiling: 진짜 한도가 필요해지면 Upstash/KV 같은 공유 저장소로 올린다.
 */
const hits = new Map()
export function rateLimited(key, max = 10, windowMs = 600_000) {
  const now = Date.now()
  const fresh = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (fresh.length >= max) { hits.set(key, fresh); return true }
  fresh.push(now)
  hits.set(key, fresh)
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
  return false
}
