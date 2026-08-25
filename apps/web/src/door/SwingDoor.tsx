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
  /** t: 0=닫힘, 1=열림. 양방향 스윙 — 방향은 dir(+1 안쪽/-1 바깥쪽) */
  t: number
  dir?: 1 | -1
}

const MAX_ANGLE = (100 * Math.PI) / 180

/** 양방향 스윙 도어 — 1S: 측면 힌지 1장 / 2S: 좌우 힌지 2장 대칭 (팜플렛: 스마트 양방향 베젤양개) */
export function SwingDoor({ spec, colorId, glassId, pattern, handleLengthM, quality, t, dir = 1 }: Props) {
  const mats = useMemo(() => ({
    frame: makeFrameMaterial(colorId),
    glass: makeGlassMaterial(glassId, quality),
    wrap: makeWrapMaterial(colorId),
  }), [colorId, glassId, quality])

  const { W, H } = { W: spec.width, H: spec.height }
  const fd = spec.frameDepth
  const jamb = 0.04
  const two = spec.panels >= 2
  const leafW = two ? W / 2 : W
  const angle = t * MAX_ANGLE * dir

  return (
    <group>
      {/* 문틀 — 상·좌·우 (알루미늄 65×20 근사) */}
      <mesh material={mats.frame} position={[0, H + jamb / 2, 0]}><boxGeometry args={[W + 2 * jamb, jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[-W / 2 - jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[W / 2 + jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      {/* 좌측 힌지 문짝 */}
      <group position={[-W / 2, H / 2, 0]} rotation={[0, angle, 0]}>
        <group position={[leafW / 2, 0, 0]}>
          <PanelMesh w={leafW} h={H - 0.01} spec={spec} mats={mats} pattern={pattern}
            handleLen={two ? 0 : handleLengthM} />
        </group>
      </group>
      {/* 2S 대칭 — 우측 힌지 문짝 (반대 방향 회전) */}
      {two && (
        <group position={[W / 2, H / 2, 0]} rotation={[0, -angle, 0]}>
          <group position={[-leafW / 2, 0, 0]}>
            <PanelMesh w={leafW} h={H - 0.01} spec={spec} mats={mats} pattern={pattern} handleLen={handleLengthM} />
          </group>
        </group>
      )}
    </group>
  )
}
