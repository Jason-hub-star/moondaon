import { useMemo } from 'react'
import * as THREE from 'three'
import type { DoorSpec, PatternGrid } from './types'
import { makeFrameMaterial, makeGlassMaterial, makeWrapMaterial } from './materials'
import type { ColorId, GlassId } from '../generated/cards'

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

/** 문짝 1장 (스윙) — 프레임 4변 + 셀. SlidingDoor의 Panel과 동일 구조를 스윙 힌지에 매닮 */
function SwingPanel({ w, h, spec, mats, pattern, handleLen }: {
  w: number; h: number; spec: DoorSpec; pattern: PatternGrid
  mats: { frame: THREE.Material; glass: THREE.Material; wrap: THREE.Material }
  handleLen: number
}) {
  const s = spec.stileWidth
  const d = spec.stileDepth
  const xs = [0, ...pattern.vLines, 1]
  const ys = [0, ...pattern.hLines, 1]
  const innerW = w - 2 * s
  const innerH = h - 2 * s
  const solid = new Set(pattern.solidCells.map(([r, c]) => `${r}:${c}`))
  return (
    <group>
      <mesh material={mats.frame} position={[0, h / 2 - s / 2, 0]}><boxGeometry args={[w, s, d]} /></mesh>
      <mesh material={mats.frame} position={[0, -h / 2 + s / 2, 0]}><boxGeometry args={[w, s, d]} /></mesh>
      <mesh material={mats.frame} position={[-w / 2 + s / 2, 0, 0]}><boxGeometry args={[s, h - 2 * s, d]} /></mesh>
      <mesh material={mats.frame} position={[w / 2 - s / 2, 0, 0]}><boxGeometry args={[s, h - 2 * s, d]} /></mesh>
      {pattern.vLines.map((x, i) => (
        <mesh key={`v${i}`} material={mats.frame} position={[-innerW / 2 + x * innerW, 0, 0]}>
          <boxGeometry args={[s, innerH, d]} />
        </mesh>
      ))}
      {pattern.hLines.map((y, i) => (
        <mesh key={`h${i}`} material={mats.frame} position={[0, -innerH / 2 + y * innerH, 0]}>
          <boxGeometry args={[innerW, s, d]} />
        </mesh>
      ))}
      {ys.slice(0, -1).map((y0, r) =>
        xs.slice(0, -1).map((x0, c) => {
          const cw = (xs[c + 1] - x0) * innerW
          const ch = (ys[r + 1] - y0) * innerH
          const cx = -innerW / 2 + x0 * innerW + cw / 2
          const cy = -innerH / 2 + y0 * innerH + ch / 2
          const isSolid = solid.has(`${r}:${c}`)
          return (
            <mesh key={`${r}:${c}`} material={isSolid ? mats.wrap : mats.glass} position={[cx, cy, 0]}>
              <boxGeometry args={[cw, ch, isSolid ? 0.009 : 0.005]} />
            </mesh>
          )
        }),
      )}
      {handleLen > 0 && (
        <mesh material={mats.frame} position={[w / 2 - 0.045, 0, d / 2 + 0.008]}>
          <boxGeometry args={[0.012, handleLen, 0.014]} />
        </mesh>
      )}
    </group>
  )
}

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
          <SwingPanel w={leafW} h={H - 0.01} spec={spec} mats={mats} pattern={pattern}
            handleLen={two ? 0 : handleLengthM} />
        </group>
      </group>
      {/* 2S 대칭 — 우측 힌지 문짝 (반대 방향 회전) */}
      {two && (
        <group position={[W / 2, H / 2, 0]} rotation={[0, -angle, 0]}>
          <group position={[-leafW / 2, 0, 0]}>
            <SwingPanel w={leafW} h={H - 0.01} spec={spec} mats={mats} pattern={pattern} handleLen={handleLengthM} />
          </group>
        </group>
      )}
    </group>
  )
}
