import { create } from 'zustand'
import { DEFAULTS, sanitizeShare, type ShareState } from './shareSchema'

export type { ShareState }

interface ConfigState extends ShareState {
  t: number
  quality: 'high' | 'lite'
  /**
   * 여닫이 여는 방향 — +1 거실(기본) / -1 현관.
   *
   * **`ShareState`가 아니라 여기 있는 게 핵심이다.** 공유 링크는 견적 문의에 그대로 붙으므로,
   * 문다온이 주문 사양으로 받는지 확인되기 전(확인 목록 8번)까지 해시에 실으면
   * 주문 못 받는 사양이 견적서로 나간다. `t`·`quality`와 같은 **3D 미리보기 상태**로 둔다.
   * 회신이 "받는다"면 `ShareState`로 올리고 아래 `encodeHash` 목록에 이름 하나만 추가한다.
   */
  doorDir: 1 | -1
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
  doorDir: 1,
  set: (p) => {
    set(p)
    const { v, productId, colorId, glassId, patternId, handleId, railId, tempered, widthM, panelPatterns } = get()
    encodeHash({ v, productId, colorId, glassId, patternId, handleId, railId, tempered, widthM, panelPatterns })
  },
}))

