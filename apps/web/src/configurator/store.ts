import { create } from 'zustand'
import type { FrameColorId, GlassId } from '../door/materials'
import { OPEN_PATTERN, GOSI_PATTERN, type PatternGrid } from '../door/types'

export type PatternId = 'open' | 'gosi'
export const PATTERNS: Record<PatternId, { name: string; grid: PatternGrid }> = {
  open: { name: '오픈형', grid: OPEN_PATTERN },
  gosi: { name: '고시형', grid: GOSI_PATTERN },
}

interface ConfigState {
  t: number
  frameColor: FrameColorId
  glassId: GlassId
  patternId: PatternId
  quality: 'high' | 'lite'
  set: (p: Partial<Omit<ConfigState, 'set'>>) => void
}

export const useConfig = create<ConfigState>((set) => ({
  t: 0,
  frameColor: 'tiffany-white',
  glassId: 'clear',
  patternId: 'open',
  quality: 'high',
  set: (p) => set(p),
}))
