import { create } from 'zustand'
import { COLORS, GLASSES, PATTERNS, HANDLES, PRODUCTS } from '../generated/cards'
import type { ShareState } from '../configurator/store'

export type CameraPath = 'front' | 'orbit' | 'walk'

interface CaptureState {
  /** 진행 중 캡처 — CaptureRig가 프레임마다 t·카메라를 구동 */
  active: { path: CameraPath; start: number } | null
  /** 카메라 프리셋 트리거 (비교 뷰 — 제작사례와 같은 앵글) */
  presetSeq: number
  begin: (path: CameraPath) => void
  end: () => void
  firePreset: () => void
}

export const useCapture = create<CaptureState>((set) => ({
  active: null,
  presetSeq: 0,
  begin: (path) => set({ active: { path, start: performance.now() } }),
  end: () => set({ active: null }),
  firePreset: () => set((s) => ({ presetSeq: s.presetSeq + 1 })),
}))

/** 시퀀스: 닫힘→열림(2.5s)→정지(1s)→닫힘(2.5s)→정지(1s) = 7s (R2-13) */
export const CAPTURE_MS = 7000
export function envelope(elapsed: number): number {
  const ease = (u: number) => 1 - Math.pow(1 - u, 3)
  if (elapsed < 2500) return ease(elapsed / 2500)
  if (elapsed < 3500) return 1
  if (elapsed < 6000) return 1 - ease((elapsed - 3500) / 2500)
  return 0
}

/** video_prompt_template(리플렛 JSON) 기반 — 영상AI 레퍼런스 페어 텍스트 */
export function buildPrompt(s: ShareState, path: CameraPath): string {
  const p = PRODUCTS[s.productId]
  const color = COLORS[s.colorId]
  const glass = GLASSES[s.glassId]
  const pattern = PATTERNS[s.patternId]
  const handle = HANDLES[s.handleId]
  const cam = { front: '정면 고정', orbit: '수평 궤도 회전', walk: '전진 워크스루' }[path]
  return [
    `brand: 문다온`,
    `product: ${p.name} (${p.motion})`,
    `panels: ${p.panels} / 개구부 가로 ${Math.round(s.widthM * 1000)}mm × 높이 ${Math.round(p.maxHeightM * 1000)}mm`,
    `frame/surface: 알루미늄 프레임, ${color.name}(${color.finish})`,
    `glass/design: ${glass.name} 5mm, ${pattern.name} / 손잡이 ${handle.name}`,
    `motion: 닫힘→열림→정지→닫힘, 감속(ease-out) 포함. 레퍼런스 영상과 동일한 패널 수·트랙·이동 순서 유지`,
    `camera: ${cam}`,
    `negative: 문짝이 벽을 관통하지 않음 / 패널·트랙 수 변경 금지 / 스윙을 슬라이딩처럼 움직이지 않음 / 프레임 휨·유리 왜곡 금지 / 손잡이·레일·간살이 프레임과 분리되지 않음 / 없는 장식·로고 추가 금지`,
  ].join('\n')
}
