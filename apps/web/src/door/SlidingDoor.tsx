import { useMemo } from 'react'
import type { DoorSpec, PatternGrid } from './types'
import { makeFrameMaterial, makeGlassMaterial, makeWrapMaterial } from './materials'
import type { ColorId, GlassId } from '../generated/cards'
import { PanelMesh } from './PanelMesh'

interface Props {
  spec: DoorSpec
  colorId: ColorId
  glassId: GlassId
  patterns: PatternGrid[]
  handleLengthM: number
  quality: 'high' | 'lite'
  /** 개폐 파라미터 t: 0=닫힘, 1=열림 (자유도 1 — 물리엔진 비채택, R1-10) */
  t: number
}

/** 슬라이딩 도어 범용 — N트랙 순차 겹침 (연동비 i/(N-1)), N=1은 원슬라이딩(전폭 이동) */
export function SlidingDoor({ spec, colorId, glassId, patterns, handleLengthM, quality, t }: Props) {
  const mats = useMemo(() => ({
    frame: makeFrameMaterial(colorId),
    glass: makeGlassMaterial(glassId, quality),
    wrap: makeWrapMaterial(colorId),
  }), [colorId, glassId, quality])

  const { W, H } = { W: spec.width, H: spec.height }
  const fd = spec.frameDepth
  const jamb = 0.04 // 문틀 정면폭 (근사)
  const N = spec.panels
  // 패널 폭: 개구부 N분할 + 겹침 (N=1이면 전폭)
  const pw = N > 1 ? (W + (N - 1) * spec.overlap) / N : W
  const stride = pw - spec.overlap // 인접 트랙 이동 거리
  // 트랙 z 오프셋 — 문틀 깊이 안에 N트랙, Z-파이팅 방지
  const trackZ = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * 0.033)
  // 연동 비율: i/(N-1). 원슬라이딩(N=1)은 1 — 벽면 앞으로 전폭 이동
  const ratio = Array.from({ length: N }, (_, i) => (N > 1 ? i / (N - 1) : 1))
  const maxTravel = N > 1 ? (N - 1) * stride : W * 0.92

  return (
    <group>
      {/* 문틀 — 상·좌·우 (알루미늄 117mm) */}
      <mesh material={mats.frame} position={[0, H + jamb / 2, 0]}><boxGeometry args={[W + 2 * jamb, jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[-W / 2 - jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[W / 2 + jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      {/* 하부 레일 7mm */}
      <mesh material={mats.frame} position={[0, 0.0035, 0]}><boxGeometry args={[W, 0.007, fd]} /></mesh>
      {/* 상부 트랙 커버 — 실물 문틀이 패널 상단 틈·트랙을 가림 (닫힘 시 슬릿 방지) */}
      <mesh material={mats.frame} position={[0, H - 0.014, 0]}><boxGeometry args={[W, 0.032, fd + 0.004]} /></mesh>
      {/* 패널 3장 — 닫힘: 좌/중/우 배치, 열림: 왼쪽으로 순차 겹침 */}
      {ratio.map((r, i) => {
        const closedX = -W / 2 + pw / 2 + i * stride
        const x = closedX - t * r * maxTravel
        return (
          <group key={i} position={[x, H / 2, trackZ[i]]}>
            <PanelMesh w={pw} h={H - 0.01} spec={spec} mats={mats} pattern={patterns[i]} handleLen={i === 2 ? handleLengthM : 0} />
          </group>
        )
      })}
    </group>
  )
}
