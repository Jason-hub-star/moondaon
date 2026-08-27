import * as THREE from 'three'
import { lazy, Suspense, useState, useSyncExternalStore, type ReactElement } from 'react'
import { Monstera } from './Monstera'
import { SCENE_PROPS, resolveProp, WALL_PARAMS, WALL_LIMITS, type PropType, type WallParams } from './props.data'

/**
 * 씬 렌더러 + 소품 재질 + 편집기 게이트. **배치 숫자는 여기 없다** — `props.data.ts`가 SSOT다
 * (three/JSX 의존이 0이라야 `frame.test.ts` 프레임 게이트가 node에서 읽는다).
 * 좌표·카메라·게이트가 필요한 쪽은 `./props.data`를 직접 import 한다 — 여기로 우회시키면
 * 컴포넌트 파일이 값까지 내보내게 돼 Fast Refresh가 깨진다.
 */


let _wp: WallParams = { ...WALL_PARAMS }
const _wpSubs = new Set<() => void>()
export function useWallParams(): WallParams {
  return useSyncExternalStore((cb) => { _wpSubs.add(cb); return () => _wpSubs.delete(cb) }, () => _wp)
}
export function setWallParams(patch: Partial<WallParams>) {
  const next = { ..._wp }
  for (const [k, v] of Object.entries(patch) as [keyof WallParams, number][]) {
    const [lo, hi] = WALL_LIMITS[k]
    next[k] = Math.min(hi, Math.max(lo, v))
  }
  _wp = next
  _wpSubs.forEach((cb) => cb())
}

/* 액자 포스터 — 절차적 캔버스(외부 애셋 0). 256px면 원경 수백 px에 충분하다 */
const _posters = new Map<string, THREE.CanvasTexture>()
function posterTexture(key: 'sun' | 'hill'): THREE.CanvasTexture {
  const hit = _posters.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  if (key === 'sun') {
    g.fillStyle = '#efe6d8'; g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#c9805e'; g.beginPath(); g.arc(128, 108, 58, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#7d6551'; g.fillRect(0, 184, 256, 72)
  } else {
    g.fillStyle = '#e8eae3'; g.fillRect(0, 0, 256, 256)
    g.fillStyle = '#8b9b83'; g.beginPath(); g.moveTo(-10, 206); g.lineTo(96, 96); g.lineTo(186, 206); g.fill()
    g.fillStyle = '#4d5c4b'; g.beginPath(); g.moveTo(112, 206); g.lineTo(198, 74); g.lineTo(266, 206); g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  _posters.set(key, t)
  return t
}

/* ── 소품 재질 (모듈 싱글턴 — 소품 전용, 구조 재질은 Entryway가 보유) ── */
let _pm: ReturnType<typeof makePropMats> | null = null
function makePropMats() {
  return {
    // 신발장·방화문은 흰색 도장 — 목재/회색강판이 중문보다 대비가 세서 주인공을 가렸다 (피드백 2026-08-27).
    // 배경으로 물러나되 분할선·프레임은 한 톤 낮은 회색으로 남겨 형태는 읽히게 한다
    cabinet: new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.55 }),
    cabinetEdge: new THREE.MeshStandardMaterial({ color: '#dcd6cc', roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: '#eeebe5', metalness: 0.12, roughness: 0.55 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#bdb8b0', metalness: 0.2, roughness: 0.45 }),
    mat: new THREE.MeshStandardMaterial({ color: '#8f8377', roughness: 1 }),
    shoe2: new THREE.MeshStandardMaterial({ color: '#3e4652', roughness: 0.85 }),
    shoeLight: new THREE.MeshStandardMaterial({ color: '#cfc4b4', roughness: 0.8 }),
    shoeSole: new THREE.MeshStandardMaterial({ color: '#8d8880', roughness: 0.9 }),
    shoeIn: new THREE.MeshStandardMaterial({ color: '#3a352f', roughness: 1 }), // 신발 입구 — 어둠 한 점이 '빈 통'을 '신을 수 있는 것'으로 만든다
    // 코트는 원경 40px짜리 실루엣이다 — 흰 신발장보다 대비를 세우지 않는 중간 값 토프로 둔다
    // (2026-08-27 "문이 주인공" 피드백 불가침)
    coat: new THREE.MeshStandardMaterial({ color: '#7f7668', roughness: 1 }),
    hook: new THREE.MeshStandardMaterial({ color: '#8e887e', metalness: 0.35, roughness: 0.5 }),
    // 러그가 마루와 같은 값이면 "베이지 방수포"로 읽힌다 — 필드를 한 톤 낮추고 바인딩(테두리)을
    // 한 톤 더 낮춰 두 값으로 만든다. 면 2개로 원경에서 '깔린 것'이 확정된다 (P-E3)
    rug: new THREE.MeshStandardMaterial({ color: '#c9bca7', roughness: 1 }),
    rugEdge: new THREE.MeshStandardMaterial({ color: '#9d8e7b', roughness: 1 }),
    woodFrame: new THREE.MeshStandardMaterial({ color: '#c9b896', roughness: 0.6 }),
    // 액자는 프레임(짙은 월넛)+흰 매트+포스터 3겹. 매트가 있어야 저해상도 원경에서도 '액자'로 읽힌다 —
    // 단색 판 하나로 두면 미완성 3D 신호가 된다 (P-E2, 2026-08-27)
    artFrame: new THREE.MeshStandardMaterial({ color: '#4a3f34', roughness: 0.55 }),
    artMat: new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.95 }),
    posterSun: new THREE.MeshStandardMaterial({ map: posterTexture('sun'), roughness: 0.9 }),
    posterHill: new THREE.MeshStandardMaterial({ map: posterTexture('hill'), roughness: 0.9 }),
    switchPlate: new THREE.MeshStandardMaterial({ color: '#f6f4f0', roughness: 0.5 }),
    switchKey: new THREE.MeshStandardMaterial({ color: '#e4e0d9', roughness: 0.6 }),
    daylight: new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#fff3da', emissiveIntensity: 1.4 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#f3e6cd', emissive: '#ffdba8', emissiveIntensity: 0.9, side: THREE.DoubleSide }),
    lampPole: new THREE.MeshStandardMaterial({ color: '#5c534a', metalness: 0.6, roughness: 0.4 }),
    wallpad: new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.3, roughness: 0.4 }),
    wallpadScreen: new THREE.MeshStandardMaterial({ color: '#5a80a8', emissive: '#4a6f9a', emissiveIntensity: 0.5 }),
    slipperSole: new THREE.MeshStandardMaterial({ color: '#ece4d8', roughness: 0.65 }),
    slipperIn: new THREE.MeshStandardMaterial({ color: '#d9ccb8', roughness: 0.9, side: THREE.DoubleSide }),
    slipperBand: new THREE.MeshStandardMaterial({ color: '#b8aa99', roughness: 0.95, side: THREE.DoubleSide }),
    // 짙은 값 앵커 — 프레임 안 최암부가 몬스테라 잎이던 걸 소파가 넘겨받는다.
    // 현관이 아니라 **거실 쪽**에만 둔다(흰 신발장 피드백 2026-08-27 불가침)
    sofa: new THREE.MeshStandardMaterial({ color: '#6b6259', roughness: 0.92 }),
    sofaSeat: new THREE.MeshStandardMaterial({ color: '#7e7568', roughness: 0.95 }),
    sofaLeg: new THREE.MeshStandardMaterial({ color: '#4a3f34', roughness: 0.6 }),
    throw: new THREE.MeshStandardMaterial({ color: '#b5765c', roughness: 1 }), // 유일한 채도 액센트
    cushion: new THREE.MeshStandardMaterial({ color: '#d8cdbb', roughness: 1 }),
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

/* 신발 지오메트리 싱글턴 — 슬리퍼와 **같은 기법**(베지어 윤곽 + 압출 + 베벨 + 정점 변형).
   구 버전은 상자 3개 근사라 유리 너머에서도 '블록'으로 읽혔다 (2026-08-27 주인님 지적).
   등급은 A 유지 — `소품` 스킬이 신발을 원경 A급으로 못박고 있어 img2threejs(B급, 12k tri)는 과잉이다.
   curveSegments 8 / bevelSegments 1로 켤레당 ~1.8k tri에 묶는다. */
let _shoe: { sole: THREE.BufferGeometry; upper: THREE.BufferGeometry; collar: THREE.BufferGeometry } | null = null
function shoeGeos() {
  if (_shoe) return _shoe
  // 발 윤곽 — +y가 앞코(넓고 둥글다), -y가 뒤꿈치(좁다). 허리는 안쪽으로 들어간다
  const outline = (w: number, l: number) => {
    const c = new THREE.Shape()
    c.moveTo(0, l)
    c.bezierCurveTo(w * 0.72, l * 0.97, w, l * 0.74, w, l * 0.40)
    c.bezierCurveTo(w, l * 0.06, w * 0.80, -l * 0.32, w * 0.78, -l * 0.62)
    c.bezierCurveTo(w * 0.76, -l * 0.90, w * 0.46, -l, 0, -l)
    c.bezierCurveTo(-w * 0.46, -l, -w * 0.76, -l * 0.90, -w * 0.78, -l * 0.62)
    c.bezierCurveTo(-w * 0.80, -l * 0.32, -w, l * 0.06, -w, l * 0.40)
    c.bezierCurveTo(-w, l * 0.74, -w * 0.72, l * 0.97, 0, l)
    return c
  }
  const EXT = { bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 1, curveSegments: 8 }
  // rotateX(-90°)는 (x,y,z)를 (x, z, -y)로 보낸다 → 압출 두께가 +y(높이), 앞코가 -z로 간다
  const sole = new THREE.ExtrudeGeometry(outline(0.047, 0.132), { ...EXT, depth: 0.020 })
  sole.rotateX(-Math.PI / 2)

  const upper = new THREE.ExtrudeGeometry(outline(0.042, 0.124), { ...EXT, depth: 0.090 })
  upper.rotateX(-Math.PI / 2)
  /* 갑피 옆모습 — 이 곡선 하나가 '상자'와 '신발'을 가른다.
     앞코는 낮고 둥글게, 발등에서 가장 높고, 발목 입구에서 파이고, 뒤축이 다시 선다. */
  const PROFILE: [number, number][] = [
    [-0.132, 0.026], [-0.088, 0.044], [-0.040, 0.070], [0.000, 0.082],
    [0.042, 0.056], [0.088, 0.074], [0.124, 0.064],
  ]
  const heightAt = (z: number) => {
    if (z <= PROFILE[0][0]) return PROFILE[0][1]
    for (let i = 1; i < PROFILE.length; i++) {
      const [z0, h0] = PROFILE[i - 1], [z1, h1] = PROFILE[i]
      if (z <= z1) return h0 + ((h1 - h0) * (z - z0)) / (z1 - z0)
    }
    return PROFILE[PROFILE.length - 1][1]
  }
  const pa = upper.attributes.position
  for (let i = 0; i < pa.count; i++) {
    if (pa.getY(i) < 0.045) continue // 아랫면·옆면 하단은 그대로 (밑창에 붙는다)
    pa.setY(i, heightAt(pa.getZ(i)))
  }
  upper.computeVertexNormals()
  upper.translate(0, 0.018, 0) // 밑창 위에 얹는다

  // 발목 입구 — 어두운 타원 한 장. 원경에서 '신을 수 있는 것'으로 읽히게 하는 최소 단서
  const hole = new THREE.Shape()
  hole.absellipse(0, 0, 0.030, 0.040, 0, Math.PI * 2, false, 0)
  const collar = new THREE.ShapeGeometry(hole, 10)
  collar.rotateX(-Math.PI / 2)
  collar.translate(0, 0.070, 0.042)

  _shoe = { sole, upper, collar }
  return _shoe
}

/* 신발 한 켤레 — 짝마다 각도를 달리해야 '벗어둔 것'이지 '진열된 것'이 아니다 */
function shoePair(upper: THREE.Material) {
  const g = shoeGeos()
  return (
    <>
      {([[-0.072, 0.01, 0.09], [0.072, -0.02, -0.16]] as const).map(([x, z, rot], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, rot, 0]}>
          <mesh geometry={g.sole} material={pm().shoeSole} castShadow />
          <mesh geometry={g.upper} material={upper} castShadow />
          <mesh geometry={g.collar} material={pm().shoeIn} />
        </group>
      ))}
    </>
  )
}

/* ── 렌더러 레지스트리 — 소품 하나 = 컴포넌트 하나, 로컬 좌표는 소품 원점 기준 ── */
export const RENDERERS: Record<PropType, () => ReactElement> = {
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
  /* 신발 2켤레 — census 반복 소품 1순위인데 매트만 있고 신발이 없었다.
     유리 너머 원경이라 밑창+갑피 상자 2개면 실루엣이 선다 (등급 A) */
  shoesDark: () => shoePair(pm().shoe2),
  shoesLight: () => shoePair(pm().shoeLight),
  /* 벽 후크 + 코트 1벌 — "사람이 산다" 신호 중 최고 가성비.
     뒷벽 좌측(x −1.05~−0.53)은 개구부 시선이 닿고 신발장에도 안 가리는 유일한 벽면이다 */
  coatHook: () => (
    <>
      <mesh material={pm().hook} position={[0, 0.34, 0.03]}><boxGeometry args={[0.34, 0.03, 0.02]} /></mesh>
      {([-0.1, 0.1] as const).map((x, i) => (
        <mesh key={i} material={pm().hook} position={[x, 0.3, 0.05]}><boxGeometry args={[0.015, 0.05, 0.03]} /></mesh>
      ))}
      <mesh material={pm().coat} position={[-0.02, 0, 0.07]}><boxGeometry args={[0.3, 0.62, 0.07]} /></mesh>
      <mesh material={pm().coat} position={[-0.02, 0.26, 0.07]}><boxGeometry args={[0.16, 0.12, 0.07]} /></mesh>
      <mesh material={pm().coat} position={[-0.03, -0.4, 0.06]}><boxGeometry args={[0.22, 0.2, 0.06]} /></mesh>
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
  // 원형 0.85 → 직사각 1.9×1.3. 국내 가이드상 거실 러그는 240×320급이 표준이라 원형 소형은
  // 애초에 아파트 문법이 아니었고, 바닥이 비어 보이던 하단 1/3을 이게 채운다 (P-E3)
  rug: () => (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      <mesh material={pm().rugEdge} receiveShadow><planeGeometry args={[1.9, 1.3]} /></mesh>
      <mesh material={pm().rug} position={[0, 0, 0.001]} receiveShadow><planeGeometry args={[1.76, 1.16]} /></mesh>
    </group>
  ),
  // 액자 — 프레임 상자 + 흰 매트 + 포스터. 매트/포스터는 프레임 앞면(z 0.011)보다 살짝 앞이라 z-fight 없음
  artTall: () => (
    <>
      <mesh material={pm().artFrame}><boxGeometry args={[0.36, 0.46, 0.022]} /></mesh>
      <mesh material={pm().artMat} position={[0, 0, 0.0115]}><planeGeometry args={[0.32, 0.42]} /></mesh>
      <mesh material={pm().posterSun} position={[0, 0.01, 0.0125]}><planeGeometry args={[0.21, 0.29]} /></mesh>
    </>
  ),
  // 우측 벽은 카메라에서 1.6m라 좌측(4.5m)보다 3배 크게 잡힌다 — 실측 원근이 맞아도
  // 시선을 문에서 뺏으므로 실제 액자를 한 치수 작게 건다 (P-E2 실렌더 판정)
  artWide: () => (
    <>
      <mesh material={pm().artFrame}><boxGeometry args={[0.34, 0.26, 0.022]} /></mesh>
      <mesh material={pm().artMat} position={[0, 0, 0.0115]}><planeGeometry args={[0.3, 0.22]} /></mesh>
      <mesh material={pm().posterHill} position={[0, 0, 0.0125]}><planeGeometry args={[0.2, 0.15]} /></mesh>
    </>
  ),
  // 2구 스위치 — 월패드 옆 국룰 동반 부재. 상자 2개로 "한국 아파트"가 확정된다
  lightSwitch: () => (
    <>
      <mesh material={pm().switchPlate}><boxGeometry args={[0.086, 0.12, 0.011]} /></mesh>
      {([0.028, -0.028] as const).map((y, i) => (
        <mesh key={i} material={pm().switchKey} position={[0, y, 0.007]}><boxGeometry args={[0.058, 0.044, 0.004]} /></mesh>
      ))}
    </>
  ),
  // 폭 1.42 → 0.9 (P-E3). 좌측벽 창은 z를 문 쪽으로 당길수록 프레임에 드는데, 넓으면 개구부
  // 벽 모서리(z ±0.075)를 파고든다 — 좁혀야 당길 수 있다. 창의 역할은 크기가 아니라 빛의 근거다.
  // 커튼·속커튼은 폐기 — 저폴리 상자로는 '천'이 안 나오고 벽과 같은 값으로 뭉갰다 (2026-08-27 판정)
  windowSheer: () => (
    <>
      <mesh material={pm().daylight} position={[0, 0, -0.005]}><planeGeometry args={[0.8, 1.25]} /></mesh>
      {([0.655, -0.655] as const).map((y, i) => (
        <mesh key={i} material={pm().woodFrame} position={[0, y, 0]}><boxGeometry args={[0.9, 0.06, 0.04]} /></mesh>
      ))}
      {([-0.42, 0.42, 0] as const).map((x, i) => (
        <mesh key={i} material={pm().woodFrame} position={[x, 0, 0]}><boxGeometry args={[0.06, 1.36, 0.04]} /></mesh>
      ))}
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
  /* 소파 — 좌측벽 2인용. 깊이는 x, 길이는 z. 프레임 좌측에서 잘리는 컷오프 근경물이라
     원점만 게이트 안(총 29.7°)에 두고 지오메트리는 밖으로 뻗는다.
     ponytail: 쿠션 곡률·주름 없는 상자 조합 — 원경 근경물이라 실루엣과 값만 맞으면 된다.
     ceiling: 카메라를 더 왼쪽으로 돌리면 각진 게 드러난다. 그때 img2threejs 정밀화 대상. */
  sofa: () => (
    <>
      <mesh material={pm().sofa} position={[0, 0.19, 0]} castShadow><boxGeometry args={[0.82, 0.3, 1.1]} /></mesh>
      <mesh material={pm().sofaSeat} position={[0.02, 0.42, 0]} castShadow><boxGeometry args={[0.74, 0.16, 1.02]} /></mesh>
      <mesh material={pm().sofa} position={[-0.33, 0.64, 0]} castShadow><boxGeometry args={[0.16, 0.62, 1.1]} /></mesh>
      {([-0.48, 0.48] as const).map((z, i) => (
        <mesh key={i} material={pm().sofa} position={[0, 0.53, z]} castShadow><boxGeometry args={[0.78, 0.38, 0.14]} /></mesh>
      ))}
      {([[-0.34, -0.48], [-0.34, 0.48], [0.32, -0.48], [0.32, 0.48]] as const).map(([x, z], i) => (
        <mesh key={i} material={pm().sofaLeg} position={[x, 0.02, z]}><boxGeometry args={[0.05, 0.04, 0.05]} /></mesh>
      ))}
      {/* 등에 기대둔 쿠션 2개. 팔걸이 안쪽 면(z ±0.41)을 뚫지 않게 z폭 0.3·중심 ±0.21로 물린다 */}
      {([-0.21, 0.22] as const).map((z, i) => (
        <mesh key={i} material={pm().cushion} position={[-0.19, 0.62, z]} rotation={[0, 0, i ? 0.2 : -0.14]} castShadow>
          <boxGeometry args={[0.12, 0.32, 0.3]} />
        </mesh>
      ))}
      {/* 좌판에 던져둔 담요 — 팔걸이에 '걸치는' 형태는 저폴리 상자로는 오렌지 파이프로 읽혀 폐기했다
          (P-E4 실렌더 판정). 접어둔 천 한 장이 같은 신호를 내면서 실루엣이 안 무너진다 */}
      <mesh material={pm().throw} position={[0.05, 0.52, 0.26]} rotation={[0.05, 0.14, 0]} castShadow>
        <boxGeometry args={[0.5, 0.05, 0.4]} />
      </mesh>
    </>
  ),
}

// dev 빌드에서만 존재 — 프로덕션 번들에는 분기 제거로 청크 자체가 없다
const SceneEditor = import.meta.env.DEV ? lazy(() => import('./SceneEditor')) : null

/** 맵 편집기 모드 — dev 서버 + `?edit=1`. 내부 도구(레퍼런스 비교·영상 캡처)의 노출 게이트를 겸한다 */
export const isEditMode = () => import.meta.env.DEV && new URLSearchParams(location.search).has('edit')

export function SceneProps({ doorW, openCorner = false }: { doorW: number; openCorner?: boolean }) {
  const [props, setProps] = useState(SCENE_PROPS)
  const [selected, setSelected] = useState<string | null>(null)
  const editing = SceneEditor && isEditMode()
  return (
    <>
      {props.map((p) => {
        const r = resolveProp(p, doorW, openCorner)
        if (r.hidden) return null
        const Renderer = RENDERERS[p.type]
        return (
          <group key={p.id} name={`prop:${p.id}`} position={r.position}
            rotation={r.rotation} scale={p.scale ?? 1}
            onClick={editing ? (e) => { e.stopPropagation(); setSelected(p.id) } : undefined}>
            <Renderer />
          </group>
        )
      })}
      {editing && SceneEditor && (
        <Suspense fallback={null}>
          <SceneEditor props={props} setProps={setProps} selected={selected} setSelected={setSelected} doorW={doorW} openCorner={openCorner} />
        </Suspense>
      )}
    </>
  )
}
