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
  /** 개폐 파라미터 t: 0=닫힘, 1=열림 (자유도 1 — 물리엔진 비채택, R1-10) */
  t: number
}

/** 문짝 1장 — 프레임 4변(19×32) + 분할 그리드 셀(유리|랩핑MDF) */
function Panel({ w, h, spec, mats, pattern, handleLen }: {
  w: number; h: number; spec: DoorSpec; pattern: PatternGrid
  mats: { frame: THREE.Material; glass: THREE.Material; wrap: THREE.Material }
  handleLen: number
}) {
  const s = spec.stileWidth
  const d = spec.stileDepth
  const xs = useMemo(() => [0, ...pattern.vLines, 1], [pattern])
  const ys = useMemo(() => [0, ...pattern.hLines, 1], [pattern])
  const innerW = w - 2 * s
  const innerH = h - 2 * s
  const solid = new Set(pattern.solidCells.map(([r, c]) => `${r}:${c}`))
  return (
    <group>
      {/* 프레임 4변 */}
      <mesh material={mats.frame} position={[0, h / 2 - s / 2, 0]}><boxGeometry args={[w, s, d]} /></mesh>
      <mesh material={mats.frame} position={[0, -h / 2 + s / 2, 0]}><boxGeometry args={[w, s, d]} /></mesh>
      <mesh material={mats.frame} position={[-w / 2 + s / 2, 0, 0]}><boxGeometry args={[s, h - 2 * s, d]} /></mesh>
      <mesh material={mats.frame} position={[w / 2 - s / 2, 0, 0]}><boxGeometry args={[s, h - 2 * s, d]} /></mesh>
      {/* 분할선 (디바이딩 바) */}
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
      {/* 셀 — 유리 또는 랩핑MDF(고시형 막힘) */}
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
      {/* 손잡이 — 기본 접착식 300mm / 고급 일체형 900mm (카드) */}
      {handleLen > 0 && (
        <mesh material={mats.frame} position={[w / 2 - 0.045, 0, d / 2 + 0.008]}>
          <boxGeometry args={[0.012, handleLen, 0.014]} />
        </mesh>
      )}
    </group>
  )
}

/** 초슬림 3연동 — 3트랙, 순차 겹침 (연동 비율 0 : 1/2 : 1) */
export function SlidingDoor3({ spec, colorId, glassId, pattern, handleLengthM, quality, t }: Props) {
  const mats = useMemo(() => ({
    frame: makeFrameMaterial(colorId),
    glass: makeGlassMaterial(glassId, quality),
    wrap: makeWrapMaterial(colorId),
  }), [colorId, glassId, quality])

  const { W, H } = { W: spec.width, H: spec.height }
  const fd = spec.frameDepth
  const jamb = 0.04 // 문틀 정면폭 (근사)
  // 패널 폭: 개구부를 3분할 + 겹침
  const pw = (W + 2 * spec.overlap) / 3
  const stride = pw - spec.overlap // 인접 트랙 이동 거리
  // 트랙 z 오프셋 (117mm 안에 3트랙) — Z-파이팅 방지
  const trackZ = [-0.033, 0, 0.033]
  // 연동 비율: 고정 0, 중간 1/2, 선두 1 (t=1이면 전부 왼쪽 스택)
  const ratio = [0, 0.5, 1]
  const maxTravel = 2 * stride

  return (
    <group>
      {/* 문틀 — 상·좌·우 (알루미늄 117mm) */}
      <mesh material={mats.frame} position={[0, H + jamb / 2, 0]}><boxGeometry args={[W + 2 * jamb, jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[-W / 2 - jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      <mesh material={mats.frame} position={[W / 2 + jamb / 2, H / 2, 0]}><boxGeometry args={[jamb, H + jamb, fd]} /></mesh>
      {/* 하부 레일 7mm */}
      <mesh material={mats.frame} position={[0, 0.0035, 0]}><boxGeometry args={[W, 0.007, fd]} /></mesh>
      {/* 패널 3장 — 닫힘: 좌/중/우 배치, 열림: 왼쪽으로 순차 겹침 */}
      {ratio.map((r, i) => {
        const closedX = -W / 2 + pw / 2 + i * stride
        const x = closedX - t * r * maxTravel
        return (
          <group key={i} position={[x, H / 2, trackZ[i]]}>
            <Panel w={pw} h={H - 0.01} spec={spec} mats={mats} pattern={pattern} handleLen={i === 2 ? handleLengthM : 0} />
          </group>
        )
      })}
    </group>
  )
}
