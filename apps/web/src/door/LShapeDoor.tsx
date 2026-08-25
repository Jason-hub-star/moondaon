import { useMemo } from 'react'
import type { DoorSpec, PatternGrid } from './types'
import { makeFrameMaterial, makeGlassMaterial, makeWrapMaterial } from './materials'
import type { ColorId, GlassId } from '../generated/cards'
import { PanelMesh } from './PanelMesh'

interface Props {
  spec: DoorSpec
  colorId: ColorId
  glassId: GlassId
  pattern: PatternGrid
  handleLengthM: number
  quality: 'high' | 'lite'
  t: number
}

/**
 * 3연동 기역자 중문 — 정면 2장 + 측면 1장 (코너 90° 고정, 수렴 결정 8).
 * ponytail: 실제 제품은 트랙이 코너를 돌아 패널이 통과하지만, 여기서는 각 패널이
 * 자기 구간에서 직선 이동만 한다 (코너 통과 회전 없음). 한계: 완전 개방 시 실제와
 * 패널 적층 위치가 다름. 업그레이드 경로: 경로 길이 파라미터화 + 코너 통과 회전.
 */
export function LShapeDoor({ spec, colorId, glassId, pattern, handleLengthM, quality, t }: Props) {
  const mats = useMemo(() => ({
    frame: makeFrameMaterial(colorId),
    glass: makeGlassMaterial(glassId, quality),
    wrap: makeWrapMaterial(colorId),
  }), [colorId, glassId, quality])

  const { H } = { H: spec.height }
  const fd = spec.frameDepth
  const jamb = 0.04
  const frontW = (spec.width * 2) / 3
  const sideW = spec.width / 3
  const pw = frontW / 2 + spec.overlap // 정면 패널 폭
  const stride = pw - spec.overlap

  return (
    <group>
      {/* 정면 문틀 (상·좌) */}
      <mesh material={mats.frame} position={[0, H + jamb / 2, 0]}><boxGeometry args={[frontW + jamb, jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[-frontW / 2 - jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[0, 0.0035, 0]}><boxGeometry args={[frontW, 0.007, fd]} /></mesh>
      {/* 측면 문틀 (상) — 코너에서 90° */}
      <group position={[frontW / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={mats.frame} position={[-sideW / 2, H + jamb / 2, 0]}><boxGeometry args={[sideW + jamb, jamb, fd]} /></mesh>
        <mesh material={mats.frame} position={[-sideW / 2, 0.0035, 0]}><boxGeometry args={[sideW, 0.007, fd]} /></mesh>
      </group>
      {/* 정면 패널 2장 — 왼쪽으로 순차 겹침 */}
      {[0, 1].map((i) => {
        const closedX = -frontW / 2 + pw / 2 + i * stride
        const x = closedX - t * (i === 0 ? 0 : stride)
        return (
          <group key={i} position={[x, H / 2, i === 0 ? -0.033 : 0]}>
            <PanelMesh w={pw} h={H - 0.01} spec={spec} mats={mats} pattern={pattern} handleLen={0} />
          </group>
        )
      })}
      {/* 측면 패널 1장 — 측벽 쪽으로 슬라이드 (열림) */}
      <group position={[frontW / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <group position={[-sideW / 2 - t * sideW * 0.9, H / 2, 0.033]}>
          <PanelMesh w={sideW + spec.overlap} h={H - 0.01} spec={spec} mats={mats} pattern={pattern} handleLen={handleLengthM} />
        </group>
      </group>
    </group>
  )
}
