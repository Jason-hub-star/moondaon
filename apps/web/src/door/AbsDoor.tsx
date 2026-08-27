import { useMemo } from 'react'
import type { DoorSpec, PatternGrid } from './types'
import { makeFrameMaterial, makeWrapMaterial } from './materials'
import type { ColorId, GlassId } from '../generated/cards'

interface Props {
  spec: DoorSpec
  colorId: ColorId
  glassId: GlassId
  patterns: PatternGrid[]
  handleLengthM: number
  quality: 'high' | 'lite'
  t: number
}

// 88° 클램프 — 90° 초과 시 문짝이 개구 평면 뒤로 넘어가 주변 소품 관통 (스윙 공통 실측 2026-08-27)
const MAX_ANGLE = (88 * Math.PI) / 180

/**
 * ABS 도어 — 여닫이 방문 (수렴: 방문 씬 분기). 발포 문틀 + 솔리드 ABS 문짝.
 * ponytail: 디자인 코드 21종은 가로 홈 실루엣 근사 1종으로 시작 — 코드별 1:1은
 * 사진 등록 절차(R1-08)로 상향. 타공/펫도어는 v2.
 */
export function AbsDoor({ spec, colorId, handleLengthM, t }: Props) {
  const mats = useMemo(() => ({
    frame: makeFrameMaterial(colorId),
    abs: makeWrapMaterial(colorId),
  }), [colorId])

  const { W, H } = { W: spec.width, H: spec.height }
  const jamb = spec.jamb // ABS 발포 문틀 — 카드 jambM (팜플렛 110~230mm 계열 근사)
  const d = 0.04 // 문짝 두께
  const angle = -t * MAX_ANGLE // 안여닫이

  return (
    <group>
      {/* 발포 문틀 — 상·좌·우 */}
      <mesh material={mats.frame} position={[0, H + jamb / 2, 0]}><boxGeometry args={[W + 2 * jamb, jamb, spec.frameDepth]} /></mesh>
      <mesh material={mats.frame} position={[-W / 2 - jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, spec.frameDepth]} /></mesh>
      <mesh material={mats.frame} position={[W / 2 + jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, spec.frameDepth]} /></mesh>
      {/* 문짝 — 좌측 힌지 회전 */}
      <group position={[-W / 2, H / 2, 0]} rotation={[0, angle, 0]}>
        <group position={[W / 2, 0, 0]}>
          <mesh material={mats.abs}><boxGeometry args={[W - 0.006, H - 0.01, d]} /></mesh>
          {/* 디자인 실루엣 — 가로 홈 3줄 (근사) */}
          {[0.25, 0, -0.25].map((y, i) => (
            <mesh key={i} material={mats.frame} position={[0, y * H, d / 2 + 0.002]}>
              <boxGeometry args={[W - 0.12, 0.012, 0.004]} />
            </mesh>
          ))}
          {/* 레버 손잡이 — 양면 */}
          {handleLengthM > 0 && [1, -1].map((z) => (
            <mesh key={z} material={mats.frame} position={[W / 2 - 0.07, -0.02, z * (d / 2 + 0.02)]}>
              <boxGeometry args={[0.13, 0.02, 0.02]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}
