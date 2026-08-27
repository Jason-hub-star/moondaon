import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useCapture, envelope, CAPTURE_MS } from './capture'
import { useConfig } from '../configurator/store'
import { CAMERA } from '../scene/props.data'

// 시선 높이는 기본 카메라와 같은 SSOT를 쓴다 — 여기에 값을 다시 적으면 캡처 결과가
// 화면에서 본 구도와 어긋난다 (P-E3에서 target y 1.15→0.98로 바뀌며 실제로 어긋났던 지점)
const TARGET = CAMERA.target

/** 캡처 중 t·카메라 패스 구동 + 비교 뷰 정면 프리셋 (Canvas 내부) */
export function CaptureRig() {
  const active = useCapture((s) => s.active)
  const presetSeq = useCapture((s) => s.presetSeq)
  const camera = useThree((s) => s.camera)

  // 제작사례 비교용 정면 프리셋 (R1-09)
  useEffect(() => {
    if (presetSeq === 0) return
    camera.position.set(0, 1.15, 3.4)
    camera.lookAt(...TARGET)
  }, [presetSeq, camera])

  useFrame(() => {
    if (!active) return
    const e = Math.min(performance.now() - active.start, CAPTURE_MS)
    useConfig.setState({ t: envelope(e) })
    const u = e / CAPTURE_MS
    if (active.path === 'front') {
      camera.position.set(0, 1.15, 3.4)
    } else if (active.path === 'orbit') {
      const a = -0.5 + u * 1.0 // -0.5rad → +0.5rad 수평 궤도
      camera.position.set(Math.sin(a) * 3.6, 1.35, Math.cos(a) * 3.6)
    } else {
      camera.position.set(0.3, 1.3, 4.2 - u * 1.9) // 워크스루 전진
    }
    camera.lookAt(...TARGET)
  })
  return null
}
