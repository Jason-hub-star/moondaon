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
  t: number
}

/**
 * 3연동 기역자 중문 — 정면 2장(개폐) + 측면 1장(고정 픽스, 돌출 구조).
 * 수렴 PATTERN-V2: 실물 확인 결과 측면은 열리지 않는 픽스창 — 기존 슬라이드 애니메이션은
 * 오판이라 제거(GRILL 결정 8 전제 갱신). 측면 패턴 = patterns[2].
 */
export function LShapeDoor({ spec, colorId, glassId, patterns, handleLengthM, quality, t }: Props) {
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
      <mesh material={mats.frame} position={[0, H - 0.014, 0]}><boxGeometry args={[frontW, 0.032, fd + 0.004]} /></mesh>
      {/* 측면 문틀 (상) — 코너에서 90° */}
      <group position={[frontW / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={mats.frame} position={[-sideW / 2, H + jamb / 2, 0]}><boxGeometry args={[sideW + jamb, jamb, fd]} /></mesh>
        <mesh material={mats.frame} position={[-sideW / 2, 0.0035, 0]}><boxGeometry args={[sideW, 0.007, fd]} /></mesh>
        <mesh material={mats.frame} position={[-sideW / 2, H - 0.014, 0]}><boxGeometry args={[sideW, 0.032, fd + 0.004]} /></mesh>
      </group>
      {/* 정면 패널 2장 — 왼쪽으로 순차 겹침 (손잡이는 이동 패널에) */}
      {[0, 1].map((i) => {
        const closedX = -frontW / 2 + pw / 2 + i * stride
        const x = closedX - t * (i === 0 ? 0 : stride)
        return (
          <group key={i} position={[x, H / 2, i === 0 ? -0.033 : 0]}>
            <PanelMesh w={pw} h={H - 0.01} spec={spec} mats={mats} pattern={patterns[i] ?? patterns[0]} handleLen={i === 1 ? handleLengthM : 0} />
          </group>
        )
      })}
      {/* 측면 — 고정 픽스창 (개폐 없음) + 코너 기둥·끝단 잼 (돌출 구조) */}
      <group position={[frontW / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={mats.frame} position={[0, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
        <mesh material={mats.frame} position={[-sideW - jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
        <group position={[-sideW / 2, H / 2, 0.033]}>
          <PanelMesh w={sideW} h={H - 0.01} spec={spec} mats={mats} pattern={patterns[2] ?? patterns[0]} handleLen={0} />
        </group>
      </group>
    </group>
  )
}
