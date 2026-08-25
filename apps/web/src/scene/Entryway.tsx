import * as THREE from 'three'
import { useMemo } from 'react'

/** 현관 목업 — 벽 2면 + 바닥 + 실링 라이트 (수렴: 소재가 주인공, 환경은 최소) */
export function Entryway({ doorW, doorH }: { doorW: number; doorH: number }) {
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efece6', roughness: 0.95 }), [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b59a78', roughness: 0.7 }), [])
  const tile = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.5 }), [])
  const WALL_W = 5, WALL_H = 2.7, side = (WALL_W - doorW) / 2
  return (
    <group>
      {/* 거실 바닥(우드) / 현관 바닥(타일, 문 뒤쪽) */}
      <mesh material={wood} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.75]} receiveShadow>
        <planeGeometry args={[WALL_W, 3.5]} />
      </mesh>
      <mesh material={tile} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, -1]} receiveShadow>
        <planeGeometry args={[WALL_W, 2]} />
      </mesh>
      {/* 개구부를 낀 벽 — 좌/우/상 */}
      <mesh material={wall} position={[-(doorW / 2 + side / 2 + 0.04), WALL_H / 2, 0]}>
        <boxGeometry args={[side - 0.08, WALL_H, 0.15]} />
      </mesh>
      <mesh material={wall} position={[doorW / 2 + side / 2 + 0.04, WALL_H / 2, 0]}>
        <boxGeometry args={[side - 0.08, WALL_H, 0.15]} />
      </mesh>
      <mesh material={wall} position={[0, doorH + 0.08 + (WALL_H - doorH) / 2, 0]}>
        <boxGeometry args={[doorW + 0.3, WALL_H - doorH, 0.15]} />
      </mesh>
      {/* 측벽 (거실) */}
      <mesh material={wall} position={[-WALL_W / 2, WALL_H / 2, 1.2]}>
        <boxGeometry args={[0.1, WALL_H, 4]} />
      </mesh>
      {/* 현관 — 뒷벽·측벽·천장 (개구부 너머가 실내로 보이게) */}
      <mesh material={wall} position={[0, WALL_H / 2, -2]}>
        <boxGeometry args={[WALL_W, WALL_H, 0.1]} />
      </mesh>
      <mesh material={wall} position={[-WALL_W / 2 + 0.6, WALL_H / 2, -1]}>
        <boxGeometry args={[0.1, WALL_H, 2]} />
      </mesh>
      <mesh material={wall} position={[WALL_W / 2 - 0.6, WALL_H / 2, -1]}>
        <boxGeometry args={[0.1, WALL_H, 2]} />
      </mesh>
      <mesh material={wall} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0.75]}>
        <planeGeometry args={[WALL_W, 5.5]} />
      </mesh>
    </group>
  )
}
