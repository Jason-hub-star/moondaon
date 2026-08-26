import * as THREE from 'three'
import { useMemo } from 'react'

/**
 * 몬스테라 화분 — img2threejs B안(assets/props/monstera/object-sculpt-spec.json) 검증 파라미터의 slim 포팅.
 * 원본 생성 코드는 assets에 보존, 여기엔 렌더에 필요한 지오메트리만. ~12k tri — quality 'high' 전용.
 */

/** 심장형 잎 프로파일 — 변연 절개는 외곽 폭을 주기적으로 파서 인코딩 (spec leaf_profile 포팅) */
function leafShape(slits: number, s: number): THREE.Shape {
  const sh = new THREE.Shape()
  const N = 60
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const ang = t * 2 * Math.PI
    const y = 0.2 - 0.22 * Math.cos(ang)
    let w = 0.16 * Math.sin(ang) * (1 + 0.25 * Math.cos(ang))
    const depth = 0.68 * Math.max(0, Math.sin(ang * slits)) ** 6
    if (t > 0.15 && t < 0.85) w *= 1 - depth * Math.abs(Math.sin(ang))
    if (i === 0) sh.moveTo(w * s, y * s)
    else sh.lineTo(w * s, y * s)
  }
  if (s > 0.75) for (const [cx, cy, rx, ry] of [[0.05, 0.16, 0.012, 0.03], [-0.045, 0.22, 0.01, 0.026]]) {
    const h = new THREE.Path()
    h.absellipse(cx * s, cy * s, rx * s * 2, ry * s, 0, Math.PI * 2, false, 0)
    sh.holes.push(h)
  }
  return sh
}

const SAUCER: [number, number][] = [[0.005, 0], [0.11, 0], [0.125, 0.008], [0.132, 0.022], [0.122, 0.03], [0.112, 0.024]]
const POT: [number, number][] = [[0.005, 0], [0.085, 0], [0.115, 0.012], [0.10, 0.045], [0.128, 0.13], [0.148, 0.22], [0.150, 0.265], [0.158, 0.285], [0.150, 0.30], [0.138, 0.292]]

export function Monstera({ position, scale = 0.85 }: { position: [number, number, number]; scale?: number }) {
  const built = useMemo(() => {
    const mats = {
      ceramic: new THREE.MeshStandardMaterial({ color: '#eae8e3', roughness: 0.3 }),
      soil: new THREE.MeshStandardMaterial({ color: '#2e2119', roughness: 1 }),
      stem: new THREE.MeshStandardMaterial({ color: '#5a7a42', roughness: 0.6 }),
      leaf: new THREE.MeshStandardMaterial({ color: '#2f6633', roughness: 0.42, side: THREE.DoubleSide }),
    }
    const g = new THREE.Group()
    const lathe = (pts: [number, number][], m: THREE.Material, y = 0) => {
      const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, py]) => new THREE.Vector2(x, py)), 40), m)
      mesh.position.y = y
      mesh.castShadow = true
      g.add(mesh)
    }
    lathe(SAUCER, mats.ceramic)
    lathe(POT, mats.ceramic, 0.028)
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.132, 0.03, 28), mats.soil)
    soil.position.y = 0.30
    g.add(soil)
    // 줄기 — 좌편중 ~30° 기움 (레퍼런스 습성)
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.30, 0), new THREE.Vector3(-0.05, 0.62, 0.015), new THREE.Vector3(-0.14, 1.0, 0.04),
    ])
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 10, 0.02, 8), mats.stem)
    stem.castShadow = true
    g.add(stem)
    // 잎자루·잎몸 8쌍 — 결정적 인덱스 변주 (spec repetition 파라미터)
    for (let i = 0; i < 8; i++) {
      const az = i * (Math.PI / 4) + (i % 3) * 0.21
      const az2 = Math.PI / 2 + (az / (2 * Math.PI)) * Math.PI * 1.35
      const frac = 0.42 + 0.55 * ((i * 37) % 10) / 10
      const L = 0.30 + 0.22 * ((i * 53) % 10) / 10
      const lift = 0.16 + 0.12 * ((i * 29) % 10) / 10
      const base = stemCurve.getPoint(frac)
      const tip = new THREE.Vector3(base.x + Math.cos(az2) * L, base.y + lift, base.z + Math.sin(az2) * L)
      const petCurve = new THREE.CatmullRomCurve3([
        base, base.clone().lerp(tip, 0.55).add(new THREE.Vector3(0, 0.05, 0)), tip,
      ])
      const pet = new THREE.Mesh(new THREE.TubeGeometry(petCurve, 8, 0.008, 6), mats.stem)
      g.add(pet)
      const s = 0.60 + 0.4 * (1 - frac)
      const droop = -(0.5 + 0.35 * ((i * 7) % 10) / 10)
      const leaf = new THREE.Mesh(new THREE.ShapeGeometry(leafShape(s > 0.75 ? 4 : 3, s), 10), mats.leaf)
      leaf.position.copy(tip)
      leaf.rotation.set(droop, -az2, 0, 'YXZ')
      leaf.castShadow = true
      g.add(leaf)
    }
    return g
  }, [])
  return <primitive object={built} position={position} scale={scale} />
}
