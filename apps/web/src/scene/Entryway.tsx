import * as THREE from 'three'
import { useMemo } from 'react'
import { sheetTexture, linearTexture } from '../door/materials'
import { Monstera } from './Monstera'

/**
 * 현관 목업 v2 — 오늘의집st 컷어웨이 방 연출 (레퍼런스: assets/참고자료/오늘의집st-방연출-예시.gif).
 * 웜톤 벽 + 실텍스처 바닥(우딘 스와치) + 걸레받이 + 코브 간접등 + 러그·화분·액자·콘솔 소품.
 * ponytail: 소품은 저폴리 프리미티브 근사 — 문이 주인공, 소품은 무드 담당.
 */
export function Entryway({ doorW, doorH, quality = 'high' }: { doorW: number; doorH: number; quality?: 'high' | 'lite' }) {
  const mats = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: '#f1eae0', roughness: 0.95,
      normalMap: linearTexture('/textures/wall-plaster-n.jpg', 3), normalScale: new THREE.Vector2(0.35, 0.35) }),
    wallBack: new THREE.MeshStandardMaterial({ color: '#ece2d4', roughness: 0.95,
      normalMap: linearTexture('/textures/wall-plaster-n.jpg', 3), normalScale: new THREE.Vector2(0.35, 0.35) }),
    base: new THREE.MeshStandardMaterial({ color: '#cbb499', roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/floor-oak.jpg', 2.4),
      normalMap: linearTexture('/textures/floor-oak-n.jpg', 2.4), normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: linearTexture('/textures/floor-oak-r.jpg', 2.4), roughness: 1 }),
    tile: new THREE.MeshStandardMaterial({ color: '#e6dfd4', map: sheetTexture('/textures/tile-porcelain.jpg', 3),
      normalMap: linearTexture('/textures/tile-porcelain-n.jpg', 3), roughness: 0.35 }),
    rug: new THREE.MeshStandardMaterial({ color: '#dcc9ad', roughness: 1 }),
    pot: new THREE.MeshStandardMaterial({ color: '#c8b9a4', roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#6d8b5c', roughness: 0.85 }),
    stem: new THREE.MeshStandardMaterial({ color: '#7a6a4f', roughness: 0.9 }),
    frame: new THREE.MeshStandardMaterial({ color: '#a98d68', roughness: 0.6 }),
    art1: new THREE.MeshStandardMaterial({ color: '#e6d3bd', roughness: 0.95 }),
    art2: new THREE.MeshStandardMaterial({ color: '#c9d2c5', roughness: 0.95 }),
    console: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/sebiji.jpg', 1.6), roughness: 0.7 }),
    cove: new THREE.MeshStandardMaterial({ color: '#fff1da', emissive: '#ffdba8', emissiveIntensity: 1.6 }),
    down: new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#fff0d0', emissiveIntensity: 2.2 }),
    cabinet: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/sebiji.jpg', 1.2), roughness: 0.75 }),
    cabinetEdge: new THREE.MeshStandardMaterial({ color: '#b8a488', roughness: 0.7 }),
    steel: new THREE.MeshStandardMaterial({ color: '#9a9da1', metalness: 0.55, roughness: 0.45 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#4d5054', metalness: 0.7, roughness: 0.35 }),
    mat: new THREE.MeshStandardMaterial({ color: '#8f8377', roughness: 1 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#6b5d4e', roughness: 0.85 }),
    shoe2: new THREE.MeshStandardMaterial({ color: '#3e4652', roughness: 0.85 }),
    mirror: new THREE.MeshStandardMaterial({ color: '#dde4ea', metalness: 0, roughness: 0.05 }), // envMap 없이 금속성은 검게 나옴 — 밝은 유전체 근사
    mirrorFrame: new THREE.MeshStandardMaterial({ color: '#c9b896', roughness: 0.6 }),
    sheer: new THREE.MeshStandardMaterial({ color: '#fffdf8', transparent: true, opacity: 0.45, roughness: 1, side: THREE.DoubleSide }),
    daylight: new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#fff3da', emissiveIntensity: 1.4 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#f3e6cd', emissive: '#ffdba8', emissiveIntensity: 0.9, side: THREE.DoubleSide }),
    lampPole: new THREE.MeshStandardMaterial({ color: '#5c534a', metalness: 0.6, roughness: 0.4 }),
    wallpad: new THREE.MeshStandardMaterial({ color: '#3a3d42', metalness: 0.3, roughness: 0.4 }),
    wallpadScreen: new THREE.MeshStandardMaterial({ color: '#5a80a8', emissive: '#4a6f9a', emissiveIntensity: 0.5 }),
  }), [])
  const WALL_W = 5, WALL_H = 2.7, side = (WALL_W - doorW) / 2
  return (
    <group>
      {/* 거실 바닥(우드 실텍스처) / 현관 바닥(마블 타일, 문 뒤쪽) */}
      <mesh material={mats.wood} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.75]} receiveShadow>
        <planeGeometry args={[WALL_W, 3.5]} />
      </mesh>
      <mesh material={mats.tile} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, -1]} receiveShadow>
        <planeGeometry args={[WALL_W, 2]} />
      </mesh>
      {/* 개구부를 낀 벽 — 좌/우/상 */}
      <mesh material={mats.wall} position={[-(doorW / 2 + side / 2 + 0.04), WALL_H / 2, 0]}>
        <boxGeometry args={[side - 0.08, WALL_H, 0.15]} />
      </mesh>
      <mesh material={mats.wall} position={[doorW / 2 + side / 2 + 0.04, WALL_H / 2, 0]}>
        <boxGeometry args={[side - 0.08, WALL_H, 0.15]} />
      </mesh>
      <mesh material={mats.wall} position={[0, doorH + 0.08 + (WALL_H - doorH) / 2, 0]}>
        <boxGeometry args={[doorW + 0.3, WALL_H - doorH, 0.15]} />
      </mesh>
      {/* 걸레받이 — 정면벽 좌우 + 측벽 */}
      <mesh material={mats.base} position={[-(doorW / 2 + side / 2 + 0.04), 0.045, 0.082]}>
        <boxGeometry args={[side - 0.08, 0.09, 0.012]} />
      </mesh>
      <mesh material={mats.base} position={[doorW / 2 + side / 2 + 0.04, 0.045, 0.082]}>
        <boxGeometry args={[side - 0.08, 0.09, 0.012]} />
      </mesh>
      <mesh material={mats.base} position={[-WALL_W / 2 + 0.056, 0.045, 1.2]}>
        <boxGeometry args={[0.012, 0.09, 4]} />
      </mesh>
      {/* 측벽 (거실) */}
      <mesh material={mats.wall} position={[-WALL_W / 2, WALL_H / 2, 1.2]}>
        <boxGeometry args={[0.1, WALL_H, 4]} />
      </mesh>
      {/* 현관 — 뒷벽·측벽·천장 */}
      <mesh material={mats.wallBack} position={[0, WALL_H / 2, -2]}>
        <boxGeometry args={[WALL_W, WALL_H, 0.1]} />
      </mesh>
      <mesh material={mats.wall} position={[-WALL_W / 2 + 0.6, WALL_H / 2, -1]}>
        <boxGeometry args={[0.1, WALL_H, 2]} />
      </mesh>
      <mesh material={mats.wall} position={[WALL_W / 2 - 0.6, WALL_H / 2, -1]}>
        <boxGeometry args={[0.1, WALL_H, 2]} />
      </mesh>
      <mesh material={mats.wall} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0.75]}>
        <planeGeometry args={[WALL_W, 5.5]} />
      </mesh>
      {/* 코브 간접등 — 거실 측벽 상단 + 현관 뒷벽 하단(무드등) */}
      <mesh material={mats.cove} position={[-WALL_W / 2 + 0.08, WALL_H - 0.12, 1.2]}>
        <boxGeometry args={[0.03, 0.03, 3.6]} />
      </mesh>
      <mesh material={mats.cove} position={[0, 0.12, -1.93]}>
        <boxGeometry args={[WALL_W * 0.7, 0.025, 0.025]} />
      </mesh>
      {/* 천장 다운라이트 2개 (발광 디스크) */}
      {[[-1.1, 1.6], [1.1, 1.6]].map(([x, z], i) => (
        <mesh key={i} material={mats.down} rotation={[Math.PI / 2, 0, 0]} position={[x, WALL_H - 0.01, z]}>
          <circleGeometry args={[0.07, 20]} />
        </mesh>
      ))}
      {/* ── 현관 (유리 너머, z ≤ -1.4 — 슬라이딩 개폐 경로와 무충돌) ── */}
      {/* 신발장(키큰장) — 현관 좌측 */}
      <group position={[-1.55, 0, -1.72]}>
        <mesh material={mats.cabinet} position={[0, 1.1, 0]}>
          <boxGeometry args={[1.0, 2.2, 0.35]} />
        </mesh>
        {/* 도어 갈라짐 라인 + 하부 띄움(플로팅 시공) */}
        <mesh material={mats.cabinetEdge} position={[0, 1.1, 0.176]}>
          <boxGeometry args={[0.012, 2.2, 0.004]} />
        </mesh>
        <mesh material={mats.cabinetEdge} position={[0, 0.62, 0.176]}>
          <boxGeometry args={[1.0, 0.012, 0.004]} />
        </mesh>
      </group>
      {/* 방화문(현관문) 실루엣 — 뒷벽 우측 + 도어록·손잡이 */}
      <group position={[1.05, 0, -1.94]}>
        <mesh material={mats.steel} position={[0, 1.05, 0]}>
          <boxGeometry args={[0.98, 2.1, 0.05]} />
        </mesh>
        <mesh material={mats.steelDark} position={[-0.38, 1.02, 0.035]}>
          <boxGeometry args={[0.05, 0.34, 0.02]} />
        </mesh>
        <mesh material={mats.steelDark} position={[-0.38, 1.28, 0.04]}>
          <boxGeometry args={[0.06, 0.1, 0.025]} />
        </mesh>
        {/* 문틀 */}
        <mesh material={mats.steelDark} position={[0, 2.13, 0]}>
          <boxGeometry args={[1.06, 0.06, 0.06]} />
        </mesh>
        <mesh material={mats.steelDark} position={[-0.52, 1.05, 0]}>
          <boxGeometry args={[0.04, 2.1, 0.06]} />
        </mesh>
        <mesh material={mats.steelDark} position={[0.52, 1.05, 0]}>
          <boxGeometry args={[0.04, 2.1, 0.06]} />
        </mesh>
      </group>
      {/* 현관 매트 + 신발 2켤레 (원경 — 단순형) */}
      <mesh material={mats.mat} rotation={[-Math.PI / 2, 0, 0]} position={[1.05, 0.004, -1.55]}>
        <planeGeometry args={[0.85, 0.55]} />
      </mesh>
      {[[0.78, -1.45, 0.12, mats.shoe], [0.95, -1.42, -0.22, mats.shoe], [1.35, -1.62, 0.35, mats.shoe2], [1.5, -1.6, 0.3, mats.shoe2]].map(([x, z, ry, m], i) => (
        <mesh key={i} material={m as THREE.Material} position={[x as number, 0.035, z as number]} rotation={[0, ry as number, 0]}>
          <boxGeometry args={[0.09, 0.07, 0.26]} />
        </mesh>
      ))}
      {/* 우산꽂이 — 방화문 옆 (P-D 생활감) */}
      <group position={[1.72, 0, -1.8]}>
        <mesh material={mats.steelDark} position={[0, 0.23, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.46, 14, 1, true]} />
        </mesh>
        <mesh material={mats.shoe2} position={[0.02, 0.42, 0]} rotation={[0, 0, 0.18]}>
          <cylinderGeometry args={[0.012, 0.02, 0.55, 6]} />
        </mesh>
      </group>
      {/* 현관 센서등 — 등기구 원판 (광원은 기존 pointLight가 담당) */}
      <mesh material={mats.down} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H - 0.015, -1.1]}>
        <circleGeometry args={[0.09, 20]} />
      </mesh>
      {/* 슬리퍼 한 켤레 — 중문 앞 거실측 (P-D 생활감) */}
      {[[0.32, 0.62, 0.25], [0.5, 0.66, 0.1]].map(([x, z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh material={mats.rug} position={[0, 0.012, 0]}>
            <boxGeometry args={[0.09, 0.02, 0.24]} />
          </mesh>
          <mesh material={mats.shoe} position={[0, 0.035, -0.04]}>
            <boxGeometry args={[0.088, 0.03, 0.1]} />
          </mesh>
        </group>
      ))}
      {/* 러그 — 거실 중앙 */}
      <mesh material={mats.rug} rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.006, 1.9]} receiveShadow>
        <circleGeometry args={[0.85, 36]} />
      </mesh>
      {/* ── 거실 소품 (P-C) ── */}
      {/* 전신거울 — 우측 벽에 기대기 (중문 옆 국룰) */}
      <group position={[2.15, 0.82, 0.24]} rotation={[-0.06, -0.35, 0]}>
        <mesh material={mats.mirrorFrame}><boxGeometry args={[0.54, 1.64, 0.03]} /></mesh>
        <mesh material={mats.mirror} position={[0, 0, 0.017]}><boxGeometry args={[0.46, 1.56, 0.004]} /></mesh>
      </group>
      {/* 창문 + 쉬어 커튼 — 거실 좌측벽 (자연광의 이유) */}
      <group position={[-WALL_W / 2 + 0.06, 1.55, 1.15]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={mats.daylight} position={[0, 0, -0.005]}><planeGeometry args={[1.3, 1.25]} /></mesh>
        {[[0, 0.655, 1.42, 0.06], [0, -0.655, 1.42, 0.06]].map(([x, y, w, h], i) => (
          <mesh key={i} material={mats.mirrorFrame} position={[x, y, 0]}><boxGeometry args={[w, h, 0.04]} /></mesh>
        ))}
        {[[-0.68, 0], [0.68, 0], [0, 0]].map(([x, y], i) => (
          <mesh key={i} material={mats.mirrorFrame} position={[x, y, 0]}><boxGeometry args={[0.06, 1.36, 0.04]} /></mesh>
        ))}
        <mesh material={mats.sheer} position={[-0.35, -0.06, 0.09]}><planeGeometry args={[0.72, 1.5]} /></mesh>
      </group>
      {/* 스탠드 조명 — 거실 좌측 뒤 (warm glow) */}
      <group position={[-1.85, 0, 2.85]}>
        <mesh material={mats.lampPole} position={[0, 0.02, 0]}><cylinderGeometry args={[0.11, 0.13, 0.04, 18]} /></mesh>
        <mesh material={mats.lampPole} position={[0, 0.7, 0]}><cylinderGeometry args={[0.012, 0.012, 1.36, 8]} /></mesh>
        <mesh material={mats.lampShade} position={[0, 1.45, 0]}><cylinderGeometry args={[0.13, 0.17, 0.24, 20, 1, true]} /></mesh>
        <pointLight position={[0, 1.42, 0]} intensity={2.6} distance={2.6} color="#ffdba8" />
      </group>
      {/* 월패드 — 개구부 우측 벽 (한국 아파트 시그니처) */}
      <group position={[doorW / 2 + 0.32, 1.32, 0.09]}>
        <mesh material={mats.wallpad}><boxGeometry args={[0.13, 0.2, 0.022]} /></mesh>
        <mesh material={mats.wallpadScreen} position={[0, 0.015, 0.012]}><boxGeometry args={[0.105, 0.13, 0.004]} /></mesh>
      </group>
      {/* 몬스테라 (B안 slim 포팅) — 좌측 앞, lite에선 기존 저폴리 화분 */}
      {quality === 'high' && <Monstera position={[-doorW / 2 - 0.55, 0, 0.6]} />}
      {/* 화분 — 우측 뒤 (+ lite일 때 좌측도 저폴리로) */}
      {(quality === 'high' ? [[doorW / 2 + 0.72, 0.32]] : [[-doorW / 2 - 0.45, 0.55], [doorW / 2 + 0.72, 0.32]]).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={mats.pot} position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.09, 0.28, 18]} />
          </mesh>
          <mesh material={mats.stem} position={[0, 0.38, 0]}>
            <cylinderGeometry args={[0.012, 0.018, 0.24, 8]} />
          </mesh>
          <mesh material={mats.leaf} position={[0, 0.58, 0]} castShadow>
            <icosahedronGeometry args={[0.17, 1]} />
          </mesh>
          <mesh material={mats.leaf} position={[0.08, 0.44, 0.04]}>
            <icosahedronGeometry args={[0.1, 1]} />
          </mesh>
        </group>
      ))}
      {/* 액자 2 — 개구부 좌우 벽 */}
      <group position={[-(doorW / 2 + side / 2), 1.55, 0.09]}>
        <mesh material={mats.frame}><boxGeometry args={[0.34, 0.44, 0.02]} /></mesh>
        <mesh material={mats.art1} position={[0, 0, 0.011]}><boxGeometry args={[0.28, 0.38, 0.004]} /></mesh>
      </group>
      <group position={[doorW / 2 + side / 2, 1.42, 0.09]}>
        <mesh material={mats.frame}><boxGeometry args={[0.28, 0.36, 0.02]} /></mesh>
        <mesh material={mats.art2} position={[0, 0, 0.011]}><boxGeometry args={[0.22, 0.3, 0.004]} /></mesh>
      </group>
      {/* 콘솔 — 거실 측벽 */}
      <group position={[-WALL_W / 2 + 0.28, 0, 2.2]}>
        <mesh material={mats.console} position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.34, 0.04, 0.9]} />
        </mesh>
        {[[-0.13, -0.4], [-0.13, 0.4], [0.13, -0.4], [0.13, 0.4]].map(([x, z], i) => (
          <mesh key={i} material={mats.console} position={[x, 0.2, z]}>
            <boxGeometry args={[0.03, 0.4, 0.03]} />
          </mesh>
        ))}
        <mesh material={mats.pot} position={[0, 0.49, -0.25]}>
          <cylinderGeometry args={[0.06, 0.045, 0.1, 14]} />
        </mesh>
        <mesh material={mats.leaf} position={[0, 0.6, -0.25]}>
          <icosahedronGeometry args={[0.08, 1]} />
        </mesh>
      </group>
    </group>
  )
}
