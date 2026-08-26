import { useMemo } from 'react'
import type { DoorSpec, PatternGrid } from './types'
import { makeFrameMaterial, makeGlassMaterial, makeWrapMaterial } from './materials'
import type { ColorId, GlassId } from '../generated/cards'
import { PanelMesh } from './PanelMesh'

interface Props {
  spec: DoorSpec
  colorId: ColorId
  glassId: GlassId
  /** 패널별 패턴 (수렴 PATTERN-V2 — 2S 오른짝 미러는 DoorModel에서 해석 완료) */
  patterns: PatternGrid[]
  handleLengthM: number
  quality: 'high' | 'lite'
  /** t: 0=닫힘, 1=열림. 양방향 스윙 — 방향은 dir(+1 안쪽/-1 바깥쪽) */
  t: number
  dir?: 1 | -1
}

const MAX_ANGLE = (100 * Math.PI) / 180

/**
 * 양방향 스윙 도어 — 1S/2S + 픽스 사이드라이트 (팜플렛: 스마트 양방향 베젤양개).
 * 패널 폭 = spec.panelWidthFr(없으면 균등), fixedPanels는 비개폐 픽스창.
 * 힌지: 패널 중심이 좌반부면 좌힌지, 우반부면 우힌지 (1S는 좌힌지).
 */
export function SwingDoor({ spec, colorId, glassId, patterns, handleLengthM, quality, t, dir = 1 }: Props) {
  const mats = useMemo(() => ({
    frame: makeFrameMaterial(colorId),
    glass: makeGlassMaterial(glassId, quality),
    wrap: makeWrapMaterial(colorId),
  }), [colorId, glassId, quality])

  const { W, H } = { W: spec.width, H: spec.height }
  const fd = spec.frameDepth
  const jamb = 0.04
  const N = spec.panels
  const fr = spec.panelWidthFr && spec.panelWidthFr.length === N ? spec.panelWidthFr : Array.from({ length: N }, () => 1 / N)
  const fixed = new Set(spec.fixedPanels ?? [])
  const angle = t * MAX_ANGLE * dir
  let acc = -W / 2
  const slots = fr.map((f) => { const lw = f * W; const x0 = acc; acc += lw; return { lw, x0 } })
  const lastMovable = slots.reduce((m, _, i) => (fixed.has(i) ? m : i), -1)

  return (
    <group>
      {/* 문틀 — 상·좌·우 (알루미늄 65×20 근사) */}
      <mesh material={mats.frame} position={[0, H + jamb / 2, 0]}><boxGeometry args={[W + 2 * jamb, jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[-W / 2 - jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[W / 2 + jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      {slots.map(({ lw, x0 }, i) => {
        const center = x0 + lw / 2
        const pat = patterns[i] ?? patterns[0]
        const handleLen = i === lastMovable ? handleLengthM : 0
        if (fixed.has(i)) {
          return (
            <group key={i} position={[center, H / 2, 0]}>
              <PanelMesh w={lw} h={H - 0.01} spec={spec} mats={mats} pattern={pat} handleLen={0} />
            </group>
          )
        }
        const hingeLeft = N === 1 || center < 0
        return (
          <group key={i} position={[hingeLeft ? x0 : x0 + lw, H / 2, 0]} rotation={[0, hingeLeft ? angle : -angle, 0]}>
            <group position={[hingeLeft ? lw / 2 : -lw / 2, 0, 0]}>
              <PanelMesh w={lw} h={H - 0.01} spec={spec} mats={mats} pattern={pat} handleLen={handleLen} />
            </group>
          </group>
        )
      })}
    </group>
  )
}
