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
    const { v, productId, colorId, glassId, patternId, handleId, railId, tempered, widthM, panelPatterns } = get()
    encodeHash({ v, productId, colorId, glassId, patternId, handleId, railId, tempered, widthM, panelPatterns })
  },
}))

