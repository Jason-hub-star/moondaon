import { create } from 'zustand'
import { DEFAULTS, sanitizeShare, type ShareState } from './shareSchema'

export type { ShareState }

interface ConfigState extends ShareState {
  t: number
  quality: 'high' | 'lite'
  set: (p: Partial<Omit<ConfigState, 'set' | 'v'>>) => void
}

function decodeHash(): Partial<ShareState> {
  try {
    const h = location.hash.slice(1)
    if (!h) return {}
    return sanitizeShare(JSON.parse(atob(h.replace(/-/g, '+').replace(/_/g, '/'))))
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
