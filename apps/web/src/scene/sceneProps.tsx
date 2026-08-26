import * as THREE from 'three'
import { lazy, Suspense, useState } from 'react'
import { sheetTexture } from '../door/materials'
import { Monstera } from './Monstera'

/**
 * 씬 소품 SSOT — 목록·위치·회전을 여기서만 관리한다 (SCENE-PLAN 표와 1:1).
 * 좌표 조절: dev 서버에서 `?edit=1` → 소품 클릭 → 기즈모로 이동 → 클립보드의 배열로 이 파일 갱신.
 * 편집기는 import.meta.env.DEV 분기라 프로덕션 번들에는 코드 자체가 존재하지 않는다.
 */

/** anchor: 문폭(doorW)에 따라오는 소품용 — x에 앵커 오프셋이 더해진다 */
export type PropAnchor = 'abs' | 'doorL' | 'doorR'
export interface SceneProp {
  id: string
  type: keyof typeof RENDERERS
  anchor?: PropAnchor
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export const SCENE_PROPS: SceneProp[] = [
  // 현관 바닥 소품 y=-0.045: Entryway v3 타일 단차(STEP)와 동기
  // KKARTdoor 실측(2026-08-26): 현관 반폭 VEST=doorW/2+0.28 — 벽 추종 소품은 doorL/doorR 앵커로 표현
  // 신발장: 좌측벽 붙박이(벽 안면 x=-VEST+0.05에 밀착, 깊이 0.35 → 중심 x=-doorW/2-0.055), z ≤ -1.1 (ㄱ자 리턴은 우측만 침범)
  { id: 'shoe-cabinet', type: 'shoeCabinet', anchor: 'doorL', position: [-0.055, -0.045, -1.06], rotation: [0, Math.PI / 2, 0] }, // 에디터 실배치 2026-08-26
  { id: 'fire-door', type: 'fireDoor', position: [0, -0.045, -1.94] }, // 뒷벽 중앙 — 거실→중문→현관문 시선축(복도형 70%)
  { id: 'door-mat', type: 'doorMat', position: [0.1, -0.041, -1.55] },
  { id: 'umbrella-stand', type: 'umbrellaStand', anchor: 'doorR', position: [0, -0.045, -1.8] },
  { id: 'slipper-l', type: 'slipper', position: [0.32, 0, 0.62], rotation: [0, 0.25, 0] },
  { id: 'slipper-r', type: 'slipper', position: [0.5, 0, 0.66], rotation: [0, 0.1, 0] },
  { id: 'rug', type: 'rug', position: [0.3, 0.006, 1.9] },
  { id: 'mirror', type: 'mirror', position: [2.15, 0.82, 0.24], rotation: [-0.06, -0.35, 0] },
  { id: 'window', type: 'windowSheer', position: [-2.44, 1.55, 1.15], rotation: [0, Math.PI / 2, 0] },
  { id: 'floor-lamp', type: 'floorLamp', position: [-1.85, 0, 2.85] },
  { id: 'wallpad', type: 'wallpad', anchor: 'doorR', position: [0.32, 1.32, 0.09] },
  { id: 'monstera', type: 'monstera', anchor: 'doorL', position: [-0.55, 0, 0.6], scale: 0.85 },
  { id: 'console', type: 'console', position: [-2.22, 0, 2.2] },
]

export function resolvePosition(p: SceneProp, doorW: number): [number, number, number] {
  const dx = p.anchor === 'doorL' ? -doorW / 2 : p.anchor === 'doorR' ? doorW / 2 : 0
  return [p.position[0] + dx, p.position[1], p.position[2]]
}

/* ── 소품 재질 (모듈 싱글턴 — 소품 전용, 구조 재질은 Entryway가 보유) ── */
let _pm: ReturnType<typeof makePropMats> | null = null
function makePropMats() {
  return {
    cabinet: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/sebiji.jpg', 1.2), roughness: 0.75 }),
    cabinetEdge: new THREE.MeshStandardMaterial({ color: '#b8a488', roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9a9da1', metalness: 0.55, roughness: 0.45 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#4d5054', metalness: 0.7, roughness: 0.35 }),
    mat: new THREE.MeshStandardMaterial({ color: '#8f8377', roughness: 1 }),
    shoe2: new THREE.MeshStandardMaterial({ color: '#3e4652', roughness: 0.85 }),
    rug: new THREE.MeshStandardMaterial({ color: '#dcc9ad', roughness: 1 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#dde4ea', metalness: 0, roughness: 0.05 }), // envMap 없이 금속성은 검게 — 밝은 유전체 근사
    mirrorFrame: new THREE.MeshStandardMaterial({ color: '#c9b896', roughness: 0.6 }),
    sheer: new THREE.MeshStandardMaterial({ color: '#fffdf8', transparent: true, opacity: 0.45, roughness: 1, side: THREE.DoubleSide }),
    daylight: new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#fff3da', emissiveIntensity: 1.4 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#f3e6cd', emissive: '#ffdba8', emissiveIntensity: 0.9, side: THREE.DoubleSide }),
    lampPole: new THREE.MeshStandardMaterial({ color: '#5c534a', metalness: 0.6, roughness: 0.4 }),
    wallpad: new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.3, roughness: 0.4 }),
    wallpadScreen: new THREE.MeshStandardMaterial({ color: '#5a80a8', emissive: '#4a6f9a', emissiveIntensity: 0.5 }),
    slipperSole: new THREE.MeshStandardMaterial({ color: '#ece4d8', roughness: 0.65 }),
    slipperIn: new THREE.MeshStandardMaterial({ color: '#d9ccb8', roughness: 0.9, side: THREE.DoubleSide }),
    slipperBand: new THREE.MeshStandardMaterial({ color: '#b8aa99', roughness: 0.95, side: THREE.DoubleSide }),
    console: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/sebiji.jpg', 1.6), roughness: 0.7 }),
    cove: new THREE.MeshStandardMaterial({ color: '#fff1da', emissive: '#ffdba8', emissiveIntensity: 1.6 }),
  }
}
function pm() { return (_pm ??= makePropMats()) }

/* 슬리퍼 지오메트리 싱글턴 — 두 짝이 공유. 발 윤곽 베지어 + 라운드 베벨 + 앞코 들림 */
let _slip: { sole: THREE.BufferGeometry; insole: THREE.BufferGeometry; band: THREE.BufferGeometry } | null = null
function slipperGeos() {
  if (_slip) return _slip
  const foot = new THREE.Shape() // +y = 앞코(넓음), -y = 뒤꿈치(좁음)
  foot.moveTo(0, 0.13)
  foot.bezierCurveTo(0.036, 0.128, 0.05, 0.105, 0.05, 0.07)
  foot.bezierCurveTo(0.05, 0.03, 0.042, -0.01, 0.04, -0.05)
  foot.bezierCurveTo(0.039, -0.095, 0.032, -0.128, 0, -0.13)
  foot.bezierCurveTo(-0.032, -0.128, -0.039, -0.095, -0.04, -0.05)
  foot.bezierCurveTo(-0.042, -0.01, -0.05, 0.03, -0.05, 0.07)
  foot.bezierCurveTo(-0.05, 0.105, -0.036, 0.128, 0, 0.13)
  const bendToe = (g: THREE.BufferGeometry) => {
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i)
      if (z < -0.06) p.setY(i, p.getY(i) + 1.6 * (z + 0.06) ** 2)
    }
    g.computeVertexNormals()
    return g
  }
  const sole = new THREE.ExtrudeGeometry(foot, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 14 })
  sole.rotateX(-Math.PI / 2) // 두께 +y, 앞코 -z
  bendToe(sole)
  const insole = new THREE.ShapeGeometry(foot, 14)
  insole.scale(0.86, 0.92, 1)
  insole.rotateX(-Math.PI / 2)
  bendToe(insole)
  const arch = new THREE.Shape()
  arch.absarc(0, 0, 0.054, 0, Math.PI, false)
  arch.absarc(0, 0, 0.043, Math.PI, 0, true)
  const band = new THREE.ExtrudeGeometry(arch, { depth: 0.085, bevelEnabled: false, curveSegments: 18 })
  _slip = { sole, insole, band }
  return _slip
}

/* ── 렌더러 레지스트리 — 소품 하나 = 컴포넌트 하나, 로컬 좌표는 소품 원점 기준 ── */
export const RENDERERS = {
  // 천장까지 붙박이 톨장 + 하부 띄움 90mm·간접등 — KKARTdoor 실측 국룰 (그룹 y=-0.045 기준 상단 2.7 도달)
  shoeCabinet: () => (
    <>
      <mesh material={pm().cabinet} position={[0, 1.4175, 0]}><boxGeometry args={[0.78, 2.655, 0.35]} /></mesh>
      <mesh material={pm().cabinetEdge} position={[0, 1.42, 0.176]}><boxGeometry args={[0.012, 2.5, 0.004]} /></mesh>
      <mesh material={pm().cabinetEdge} position={[0, 1.05, 0.176]}><boxGeometry args={[0.78, 0.012, 0.004]} /></mesh>
      <mesh material={pm().cove} position={[0, 0.075, 0.1]}><boxGeometry args={[0.74, 0.02, 0.02]} /></mesh>
    </>
  ),
  fireDoor: () => (
    <>
      <mesh material={pm().steel} position={[0, 1.05, 0]}><boxGeometry args={[0.98, 2.1, 0.05]} /></mesh>
      <mesh material={pm().steelDark} position={[-0.38, 1.02, 0.035]}><boxGeometry args={[0.05, 0.34, 0.02]} /></mesh>
      <mesh material={pm().steelDark} position={[-0.38, 1.28, 0.04]}><boxGeometry args={[0.06, 0.1, 0.025]} /></mesh>
      <mesh material={pm().steelDark} position={[0, 2.13, 0]}><boxGeometry args={[1.06, 0.06, 0.06]} /></mesh>
      <mesh material={pm().steelDark} position={[-0.52, 1.05, 0]}><boxGeometry args={[0.04, 2.1, 0.06]} /></mesh>
      <mesh material={pm().steelDark} position={[0.52, 1.05, 0]}><boxGeometry args={[0.04, 2.1, 0.06]} /></mesh>
    </>
  ),
  doorMat: () => (
    <mesh material={pm().mat} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.85, 0.55]} /></mesh>
  ),
  umbrellaStand: () => (
    <>
      <mesh material={pm().steelDark} position={[0, 0.23, 0]}><cylinderGeometry args={[0.07, 0.06, 0.46, 14, 1, true]} /></mesh>
      <mesh material={pm().shoe2} position={[0.02, 0.42, 0]} rotation={[0, 0, 0.18]}><cylinderGeometry args={[0.012, 0.02, 0.55, 6]} /></mesh>
    </>
  ),
  slipper: () => (
    <>
      <mesh geometry={slipperGeos().sole} material={pm().slipperSole} position={[0, 0.006, 0]} castShadow />
      <mesh geometry={slipperGeos().insole} material={pm().slipperIn} position={[0, 0.0305, 0]} />
      <mesh geometry={slipperGeos().band} material={pm().slipperBand} position={[0, 0.024, -0.125]}
        rotation={[-0.15, 0, 0]} scale={[1, 0.72, 1]} castShadow />
    </>
  ),
  rug: () => (
    <mesh material={pm().rug} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[0.85, 36]} /></mesh>
  ),
  mirror: () => (
    <>
      <mesh material={pm().mirrorFrame}><boxGeometry args={[0.54, 1.64, 0.03]} /></mesh>
      <mesh material={pm().mirror} position={[0, 0, 0.017]}><boxGeometry args={[0.46, 1.56, 0.004]} /></mesh>
    </>
  ),
  windowSheer: () => (
    <>
      <mesh material={pm().daylight} position={[0, 0, -0.005]}><planeGeometry args={[1.3, 1.25]} /></mesh>
      {([[0, 0.655], [0, -0.655]] as const).map(([x, y], i) => (
        <mesh key={i} material={pm().mirrorFrame} position={[x, y, 0]}><boxGeometry args={[1.42, 0.06, 0.04]} /></mesh>
      ))}
      {([[-0.68, 0], [0.68, 0], [0, 0]] as const).map(([x, y], i) => (
        <mesh key={i} material={pm().mirrorFrame} position={[x, y, 0]}><boxGeometry args={[0.06, 1.36, 0.04]} /></mesh>
      ))}
      <mesh material={pm().sheer} position={[-0.35, -0.06, 0.09]}><planeGeometry args={[0.72, 1.5]} /></mesh>
    </>
  ),
  floorLamp: () => (
    <>
      <mesh material={pm().lampPole} position={[0, 0.02, 0]}><cylinderGeometry args={[0.11, 0.13, 0.04, 18]} /></mesh>
      <mesh material={pm().lampPole} position={[0, 0.7, 0]}><cylinderGeometry args={[0.012, 0.012, 1.36, 8]} /></mesh>
      <mesh material={pm().lampShade} position={[0, 1.45, 0]}><cylinderGeometry args={[0.13, 0.17, 0.24, 20, 1, true]} /></mesh>
      <pointLight position={[0, 1.42, 0]} intensity={2.6} distance={2.6} color="#ffdba8" />
    </>
  ),
  wallpad: () => (
    <>
      <mesh material={pm().wallpad}><boxGeometry args={[0.13, 0.2, 0.022]} /></mesh>
      <mesh material={pm().wallpadScreen} position={[0, 0.015, 0.012]}><boxGeometry args={[0.105, 0.13, 0.004]} /></mesh>
    </>
  ),
  monstera: () => <Monstera position={[0, 0, 0]} scale={1} />,
  console: () => (
    <>
      <mesh material={pm().console} position={[0, 0.42, 0]} castShadow><boxGeometry args={[0.34, 0.04, 0.9]} /></mesh>
      {([[-0.13, -0.4], [-0.13, 0.4], [0.13, -0.4], [0.13, 0.4]] as const).map(([x, z], i) => (
        <mesh key={i} material={pm().console} position={[x, 0.2, z]}><boxGeometry args={[0.03, 0.4, 0.03]} /></mesh>
      ))}
    </>
  ),
}

// dev 빌드에서만 존재 — 프로덕션 번들에는 분기 제거로 청크 자체가 없다
const SceneEditor = import.meta.env.DEV ? lazy(() => import('./SceneEditor')) : null

export function SceneProps({ doorW }: { doorW: number }) {
  const [props, setProps] = useState(SCENE_PROPS)
  const [selected, setSelected] = useState<string | null>(null)
  const editing = import.meta.env.DEV && SceneEditor && new URLSearchParams(location.search).has('edit')
  return (
    <>
      {props.map((p) => {
        const Renderer = RENDERERS[p.type]
        return (
          <group key={p.id} name={`prop:${p.id}`} position={resolvePosition(p, doorW)}
            rotation={p.rotation ?? [0, 0, 0]} scale={p.scale ?? 1}
            onClick={editing ? (e) => { e.stopPropagation(); setSelected(p.id) } : undefined}>
            <Renderer />
          </group>
        )
      })}
      {editing && SceneEditor && (
        <Suspense fallback={null}>
          <SceneEditor props={props} setProps={setProps} selected={selected} setSelected={setSelected} doorW={doorW} />
        </Suspense>
      )}
    </>
  )
}
