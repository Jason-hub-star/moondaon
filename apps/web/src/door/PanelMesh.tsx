import { useMemo } from 'react'
import * as THREE from 'three'
import type { DoorSpec, PatternGrid } from './types'

/** 문짝 1장 — 프레임 4변(19×32) + 분할 그리드 셀(유리|랩핑MDF) */
export function PanelMesh({ w, h, spec, mats, pattern, handleLen }: {
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
      {/* 간살 — 세로 바 배열 (알루미늄/MDF랩핑), 유리 뒤 z 오프셋 */}
      {spec.louver && (() => {
        const { barW, gap } = spec.louver
        const n = Math.max(1, Math.floor((innerW + gap) / (barW + gap)))
        const pitch = innerW / n
        return Array.from({ length: n }, (_, i) => (
          <mesh key={`lv${i}`} material={mats.frame}
            position={[-innerW / 2 + pitch * (i + 0.5), 0, d / 2 + 0.006]}>
            <boxGeometry args={[barW, innerH, 0.012]} />
          </mesh>
        ))
      })()}
      {handleLen > 0 && (
        <mesh material={mats.frame} position={[w / 2 - 0.045, 0, d / 2 + 0.008]}>
          <boxGeometry args={[0.012, handleLen, 0.014]} />
        </mesh>
      )}
    </group>
  )
}

