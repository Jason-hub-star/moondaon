import { useMemo } from 'react'
import * as THREE from 'three'
import type { DoorSpec, PatternArc, PatternGrid } from './types'

function archShape(w: number, h: number, rise: number) {
  const sh = new THREE.Shape()
  const y1 = h / 2 - rise
  sh.moveTo(-w / 2, -h / 2)
  sh.lineTo(-w / 2, y1)
  sh.quadraticCurveTo(0, h / 2 + rise, w / 2, y1)
  sh.lineTo(w / 2, -h / 2)
  sh.closePath()
  return sh
}

/** 스팬드럴 웨지 2개 — 내부 rect 상단 코너 − 아치 곡선 (홀 없는 폐곡선: 경계 접촉 홀은 삼각분할이 깨짐) */
function spandrelWedges(iw: number, ih: number, rise: number): THREE.Shape[] {
  const y1 = ih / 2 - rise
  const cyMid = (y1 + ih / 2 + rise) / 2 // 베지어 반분할(de Casteljau) 제어점 y
  const left = new THREE.Shape()
  left.moveTo(-iw / 2, y1)
  left.quadraticCurveTo(-iw / 4, cyMid, 0, ih / 2)
  left.lineTo(-iw / 2, ih / 2)
  left.closePath()
  const right = new THREE.Shape()
  right.moveTo(iw / 2, y1)
  right.quadraticCurveTo(iw / 4, cyMid, 0, ih / 2)
  right.lineTo(iw / 2, ih / 2)
  right.closePath()
  return [left, right]
}

/** 아치 경계 바 — 바깥 곡선과 안쪽 곡선 사이 환형 밴드 */
function archBand(iw: number, ih: number, rise: number, s: number): THREE.Shape {
  const y1 = ih / 2 - rise
  const iw2 = iw - 2 * s
  const ih2 = ih - 2 * s
  const rise2 = Math.max(0.01, rise - s)
  const y1i = ih2 / 2 - rise2
  const sh = new THREE.Shape()
  sh.moveTo(-iw / 2, y1)
  sh.quadraticCurveTo(0, ih / 2 + rise, iw / 2, y1)
  sh.lineTo(iw2 / 2, y1i)
  sh.quadraticCurveTo(0, ih2 / 2 + rise2, -iw2 / 2, y1i)
  sh.closePath()
  return sh
}

const CORNERS = {
  tl: { sx: 1, sy: -1 }, tr: { sx: -1, sy: -1 }, bl: { sx: 1, sy: 1 }, br: { sx: -1, sy: 1 },
} as const

/** arc 프리미티브 → Shape (문짝 내부 좌표계, 수렴 PATTERN-V2 크럭스: 앵커+반경) */
function arcRegionShape(a: PatternArc, iw: number, ih: number): THREE.Shape {
  const RX = a.rx * iw
  const RY = a.ry * ih
  const sh = new THREE.Shape()
  if (a.anchor === 'left' || a.anchor === 'right' || a.anchor === 'top' || a.anchor === 'bottom') {
    // 변 앵커 — 평변이 해당 변에 붙는 반타원 (invert는 변에선 미지원 — 리플렛 수요 없음)
    if (a.anchor === 'right') {
      sh.moveTo(iw / 2, RY); sh.absellipse(iw / 2, 0, RX, RY, Math.PI / 2, (3 * Math.PI) / 2, false, 0)
    } else if (a.anchor === 'left') {
      sh.moveTo(-iw / 2, RY); sh.absellipse(-iw / 2, 0, RX, RY, Math.PI / 2, -Math.PI / 2, true, 0)
    } else if (a.anchor === 'top') {
      sh.moveTo(-RX, ih / 2); sh.absellipse(0, ih / 2, RX, RY, Math.PI, 0, true, 0)
    } else {
      sh.moveTo(-RX, -ih / 2); sh.absellipse(0, -ih / 2, RX, RY, Math.PI, 0, false, 0)
    }
    sh.closePath()
    return sh
  }
  const { sx, sy } = CORNERS[a.anchor]
  const cx = (-sx * iw) / 2
  const cy = (-sy * ih) / 2
  if (a.invert) {
    // 보수 영역: 코너 사각 − 사분타원 (라운드탑 코너 웨지). 타원 중심 = 코너에서 안쪽 (RX,RY)
    const ox = cx + sx * RX
    const oy = cy + sy * RY
    const a0 = sy < 0 ? Math.PI / 2 : -Math.PI / 2
    const a1 = sx > 0 ? Math.PI : 0
    const cw = a.anchor === 'tr' || a.anchor === 'bl'
    sh.moveTo(cx, cy)
    sh.lineTo(ox, cy)
    sh.absellipse(ox, oy, RX, RY, a0, a1, cw, 0)
    sh.lineTo(cx, cy + sy * RY)
    sh.closePath()
    return sh
  }
  // 사분타원 디스크 (코너 중심)
  const table = {
    tl: { a0: 0, a1: 1.5 * Math.PI, cw: true },
    tr: { a0: Math.PI, a1: 1.5 * Math.PI, cw: false },
    bl: { a0: 0, a1: 0.5 * Math.PI, cw: false },
    br: { a0: Math.PI, a1: 0.5 * Math.PI, cw: true },
  }[a.anchor]
  sh.moveTo(cx, cy)
  sh.lineTo(cx + RX * Math.cos(table.a0), cy + RY * Math.sin(table.a0))
  sh.absellipse(cx, cy, RX, RY, table.a0, table.a1, table.cw, 0)
  sh.closePath()
  return sh
}

/** anchor별 타원 스윕 파라미터 (환형 바 공용) */
function arcSweep(a: PatternArc, iw: number, ih: number) {
  if (a.anchor === 'right') return { ox: iw / 2, oy: 0, a0: Math.PI / 2, a1: 1.5 * Math.PI, cw: false }
  if (a.anchor === 'left') return { ox: -iw / 2, oy: 0, a0: Math.PI / 2, a1: -Math.PI / 2, cw: true }
  if (a.anchor === 'top') return { ox: 0, oy: ih / 2, a0: Math.PI, a1: 0, cw: true }
  if (a.anchor === 'bottom') return { ox: 0, oy: -ih / 2, a0: Math.PI, a1: 0, cw: false }
  const { sx, sy } = CORNERS[a.anchor]
  const t = {
    tl: { a0: 0, a1: 1.5 * Math.PI, cw: true },
    tr: { a0: Math.PI, a1: 1.5 * Math.PI, cw: false },
    bl: { a0: 0, a1: 0.5 * Math.PI, cw: false },
    br: { a0: Math.PI, a1: 0.5 * Math.PI, cw: true },
  }[a.anchor]
  return { ox: (-sx * iw) / 2, oy: (-sy * ih) / 2, ...t }
}

/** arc 경계 바 — 바깥/안쪽 타원 호 사이 환형 섹터 (홀 없음) */
function arcRing(a: PatternArc, iw: number, ih: number, s: number): THREE.Shape {
  const { ox, oy, a0, a1, cw } = arcSweep(a, iw, ih)
  const RX = a.rx * iw
  const RY = a.ry * ih
  const rx2 = Math.max(0.005, RX - s)
  const ry2 = Math.max(0.005, RY - s)
  const sh = new THREE.Shape()
  sh.moveTo(ox + RX * Math.cos(a0), oy + RY * Math.sin(a0))
  sh.absellipse(ox, oy, RX, RY, a0, a1, cw, 0)
  sh.lineTo(ox + rx2 * Math.cos(a1), oy + ry2 * Math.sin(a1))
  sh.absellipse(ox, oy, rx2, ry2, a1, a0, !cw, 0)
  sh.closePath()
  return sh
}

/** 좌우 미러 패턴 (2S 양개 오른짝 자동 미러 — 수렴 PATTERN-V2 R3) */
export function mirrorPattern(p: PatternGrid): PatternGrid {
  const nCols = p.vLines.length + 1
  const flip: Record<PatternArc['anchor'], PatternArc['anchor']> = {
    tl: 'tr', tr: 'tl', bl: 'br', br: 'bl', left: 'right', right: 'left', top: 'top', bottom: 'bottom',
  }
  return {
    ...p,
    vLines: p.vLines.map((x) => 1 - x).sort((a, b) => a - b),
    solidCells: p.solidCells.map(([r, c]) => [r, nCols - 1 - c]),
    arcs: p.arcs?.map((a) => ({ ...a, anchor: flip[a.anchor] })),
  }
}

/** 문짝 1장 — 프레임 4변(19×32) + 분할 그리드 셀(유리|랩핑MDF) + arc/스팬드럴 오버레이 */
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
  const arch = pattern.archProfile
  const legacyArch = arch != null && !pattern.spandrel
  const archGeos = useMemo(() => {
    if (!legacyArch || arch == null) return null
    const rise = arch * h
    const outer = archShape(w, h, rise)
    outer.holes.push(archShape(w - 2 * s, h - 2 * s, Math.max(0.01, rise - s)))
    const frame = new THREE.ExtrudeGeometry(outer, { depth: d, bevelEnabled: false })
    frame.translate(0, 0, -d / 2)
    const glass = new THREE.ExtrudeGeometry(archShape(w - 2 * s, h - 2 * s, Math.max(0.01, rise - s)), { depth: 0.005, bevelEnabled: false })
    glass.translate(0, 0, -0.0025)
    return { frame, glass }
  }, [legacyArch, arch, w, h, s, d])
  // 스팬드럴 — 직사각 문짝 유지, 상단 코너 웨지 2개 + 아치 경계 밴드
  const spandrelGeos = useMemo(() => {
    if (arch == null || !pattern.spandrel) return null
    const rise = Math.min(arch * h, innerH * 0.45)
    const solid2 = pattern.spandrel === 'solid'
    const wedgeGeos = spandrelWedges(innerW, innerH, rise).map((sh) => {
      const g = new THREE.ExtrudeGeometry(sh, { depth: solid2 ? 0.012 : 0.006, bevelEnabled: false })
      g.translate(0, 0, solid2 ? -0.006 : -0.003)
      return g
    })
    const ringGeo = new THREE.ExtrudeGeometry(archBand(innerW, innerH, rise, s), { depth: d * 0.6, bevelEnabled: false })
    ringGeo.translate(0, 0, -d * 0.3)
    return { wedgeGeos, ringGeo }
  }, [arch, pattern.spandrel, innerW, innerH, h, s, d])
  // arc 오버레이 — solid 12mm / glass 14mm(전면 우선), 경계 바 = 환형 섹터 (invert는 바 생략 — ponytail 근사)
  const arcGeos = useMemo(() => {
    if (!pattern.arcs?.length) return []
    return pattern.arcs.map((a) => {
      const region = new THREE.ExtrudeGeometry(arcRegionShape(a, innerW, innerH), { depth: a.fill === 'solid' ? 0.012 : 0.014, bevelEnabled: false })
      region.translate(0, 0, a.fill === 'solid' ? -0.006 : -0.007)
      let barGeo: THREE.ExtrudeGeometry | null = null
      if (!a.invert && a.rx > 0.05 && a.ry > 0.05) {
        barGeo = new THREE.ExtrudeGeometry(arcRing(a, innerW, innerH, s), { depth: d * 0.6, bevelEnabled: false })
        barGeo.translate(0, 0, -d * 0.3)
      }
      return { fill: a.fill, region, barGeo }
    })
  }, [pattern.arcs, innerW, innerH, s, d])
  if (archGeos) {
    return (
      <group>
        <mesh material={mats.frame} geometry={archGeos.frame} />
        <mesh material={mats.glass} geometry={archGeos.glass} />
        {handleLen > 0 && (
          <mesh material={mats.frame} position={[w / 2 - 0.045, 0, d / 2 + 0.008]}>
            <boxGeometry args={[0.012, handleLen, 0.014]} />
          </mesh>
        )}
      </group>
    )
  }
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
      {/* 스팬드럴 (아치 코너 웨지) + 아치 경계 바 */}
      {spandrelGeos && (
        <>
          {spandrelGeos.wedgeGeos.map((g, i) => (
            <mesh key={`sp${i}`} material={pattern.spandrel === 'solid' ? mats.wrap : mats.glass} geometry={g} />
          ))}
          <mesh material={mats.frame} geometry={spandrelGeos.ringGeo} />
        </>
      )}
      {/* arc 오버레이 (1/4·반타원 solid/glass) + 경계 바 */}
      {arcGeos.map((g, i) => (
        <group key={`arc${i}`}>
          <mesh material={g.fill === 'solid' ? mats.wrap : mats.glass} geometry={g.region} />
          {g.barGeo && <mesh material={mats.frame} geometry={g.barGeo} />}
        </group>
      ))}
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
