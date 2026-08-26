import { create } from 'zustand'
import type { ColorId, GlassId, PatternId, HandleId, ProductId } from '../generated/cards'

export interface ShareState {
  /** URL 공유 스키마 버전 (수렴: 카드 변경에서 옛 링크 보호. v2: panelPatterns 추가) */
  v: 2
  productId: ProductId
  colorId: ColorId
  glassId: GlassId
  patternId: PatternId
  handleId: HandleId
  /** 개구부 가로 (m) — 팜플렛 구간 A~D */
  widthM: number
  /** 패널별 패턴 오버라이드 (수렴 PATTERN-V2) — null/미지정 = patternId 균일 적용 */
  panelPatterns?: (PatternId | null)[]
}

interface ConfigState extends ShareState {
  t: number
  quality: 'high' | 'lite'
  set: (p: Partial<Omit<ConfigState, 'set' | 'v'>>) => void
}

const DEFAULTS: ShareState = { v: 2, productId: 'slim-3track-19', colorId: 'white', glassId: 'clear', patternId: 'open', handleId: 'basic-adhesive', widthM: 1.25 } // widthM: KKARTdoor 쇼츠 64편 실측 중앙값 1214mm(2026-08-26)

function decodeHash(): Partial<ShareState> {
  try {
    const h = location.hash.slice(1)
    if (!h) return {}
    const o = JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/')))
    if (o?.v === 2) return o
    if (o?.v === 1) return { ...o, v: 2 } // v1 링크 호환 — patternId 균일 적용으로 동일 렌더
    return {}
  } catch { return {} }
}

export function encodeHash(s: ShareState) {
  const b64 = btoa(JSON.stringify(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  history.replaceState(null, '', `#${b64}`)
}

export const useConfig = create<ConfigState>((set, get) => ({
  ...DEFAULTS,
  ...decodeHash(),
  t: 0,
  quality: 'high',
  set: (p) => {
    set(p)
    const { v, productId, colorId, glassId, patternId, handleId, widthM, panelPatterns } = get()
    encodeHash({ v, productId, colorId, glassId, patternId, handleId, widthM, panelPatterns })
  },
}))

/** 팜플렛 구간별 사이즈 A~D 판정 */
export function sizeZone(widthM: number): string {
  const mm = widthM * 1000
  if (mm < 1200) return '범위 밖 (최소 1200)'
  if (mm <= 1400) return 'A구간 (1200~1400)'
  if (mm <= 1600) return 'B구간 (1401~1600)'
  if (mm <= 1800) return 'C구간 (1601~1800)'
  if (mm <= 2000) return 'D구간 (1801~2000)'
  return '범위 밖 (최대 2000)'
}
