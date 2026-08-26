import * as THREE from 'three'
import { useMemo } from 'react'
import { sheetTexture } from '../door/materials'

/**
 * 현관 목업 v2 — 오늘의집st 컷어웨이 방 연출 (레퍼런스: assets/참고자료/오늘의집st-방연출-예시.gif).
 * 웜톤 벽 + 실텍스처 바닥(우딘 스와치) + 걸레받이 + 코브 간접등 + 러그·화분·액자·콘솔 소품.
 * ponytail: 소품은 저폴리 프리미티브 근사 — 문이 주인공, 소품은 무드 담당.
 */
export function Entryway({ doorW, doorH }: { doorW: number; doorH: number }) {
  const mats = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: '#f1eae0', roughness: 0.95 }),
    wallBack: new THREE.MeshStandardMaterial({ color: '#ece2d4', roughness: 0.95 }),
    base: new THREE.MeshStandardMaterial({ color: '#cbb499', roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/hazelnut-oak.jpg', 2.6), roughness: 0.65 }),
    tile: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/moonstone-greige.jpg', 2.2), roughness: 0.45 }),
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
      {/* 러그 — 거실 중앙 */}
      <mesh material={mats.rug} rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.006, 1.9]} receiveShadow>
        <circleGeometry args={[0.85, 36]} />
      </mesh>
      {/* 화분 2 — 개구부 좌측 앞 / 우측 뒤 */}
      {[[-doorW / 2 - 0.45, 0.55], [doorW / 2 + 0.72, 0.32]].map(([x, z], i) => (
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
