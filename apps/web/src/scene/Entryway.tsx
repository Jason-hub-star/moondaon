import * as THREE from 'three'
import { useMemo } from 'react'
import { sheetTexture, linearTexture, makeFrameMaterial, makeGlassMaterial } from '../door/materials'
import type { ColorId, GlassId } from '../generated/cards'
import { SceneProps, useWallParams } from './sceneProps'

/**
 * 현관 목업 v3 — 오늘의집st 컷어웨이 + KKARTdoor 쇼츠 64편 실측 패턴(2026-08-26, scratchpad/kkart/census.json).
 * 실측 반영: 복도형 현관 70% → 현관을 개구폭+0.56m로 협소화, 방화문 중앙(시선축 관통),
 * 신발장 천장까지 붙박이(하부 띄움+간접등), 현관 타일 단차 -45mm. 개구 실측 중앙값 1214mm.
 * ponytail: 소품은 저폴리 프리미티브 근사 — 문이 주인공, 소품은 무드 담당.
 */
export function Entryway({ doorW, doorH, openCorner = false, colorId, glassId, quality }: {
  doorW: number; doorH: number; openCorner?: boolean
  /** ㄱ자 부스 측면 고정창은 도어와 같은 제품 — 색상·유리 선택을 그대로 따른다 */
  colorId: ColorId; glassId: GlassId; quality: 'high' | 'lite'
}) {
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
    frame: new THREE.MeshStandardMaterial({ color: '#a98d68', roughness: 0.6 }),
    art1: new THREE.MeshStandardMaterial({ color: '#e6d3bd', roughness: 0.95 }),
    art2: new THREE.MeshStandardMaterial({ color: '#c9d2c5', roughness: 0.95 }),
    cove: new THREE.MeshStandardMaterial({ color: '#fff1da', emissive: '#ffdba8', emissiveIntensity: 1.6 }),
    down: new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#fff0d0', emissiveIntensity: 2.2 }),
  }), [])
  // 부스 고정창 — 도어와 동일한 제품 재질 (유리·색상 선택이 여기에도 걸린다)
  const booth = useMemo(() => ({
    glass: makeGlassMaterial(glassId, quality),
    frame: makeFrameMaterial(colorId),
  }), [glassId, colorId, quality])
  const WP = useWallParams() // 실측 기본값 + ?edit=1 슬라이더 (sceneProps.tsx <wall-params>)
  const WALL_W = 5, WALL_H = WP.wallH, side = (WALL_W - doorW) / 2
  const VEST = doorW / 2 + WP.vestMargin // 현관(유리 너머) 반폭 — 실측 복도폭(개구+0.5~0.6m) 재현
  const STEP = WP.step // 현관 타일 단차(실측 40~50mm)
  const DEPTH = WP.vestDepth // 현관 깊이(중문→뒷벽)
  // 개방형 코너(ㄱ자) — 목 없는 현관에 전실을 신설하는 부스: 우측은 벽 대신 하프월 가벽+고정유리 (레퍼런스: 아이지도어 ㄱ자 파티션, 실측 하프월 ≈1.05m)
  const HALF_H = 0.92 // 하프월 높이 — 아이지도어 레퍼런스 실측 0.40×H(2300) ≈ 920mm
  const boothR = doorW / 2 // 부스 우측 면 = 개구 우측 끝
  // 가벽(두께 80mm) 중심 — 안쪽 면이 개구 끝선 boothR에 딱 맞게 선다. 도어 우측 문틀이 같은 선이라 한 면으로 이어진다
  const SIDE_PLANE = boothR + 0.04
  const tileW = openCorner ? VEST + boothR : VEST * 2
  const tileCX = openCorner ? (boothR - VEST) / 2 : 0
  return (
    <group>
      {/* 거실 바닥(우드 실텍스처) / 현관 바닥(마블 타일, 문 뒤쪽) */}
      <mesh material={mats.wood} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.75]} receiveShadow>
        <planeGeometry args={[WALL_W, 3.5]} />
      </mesh>
      <mesh material={mats.tile} rotation={[-Math.PI / 2, 0, 0]} position={[tileCX, -STEP, -DEPTH / 2]} receiveShadow>
        <planeGeometry args={[openCorner ? tileW : WALL_W, DEPTH]} />
      </mesh>
      {/* 개방형: 부스 우측 바깥은 거실 마루가 이어진다 */}
      {openCorner && (
        <mesh material={mats.wood} rotation={[-Math.PI / 2, 0, 0]} position={[(boothR + WALL_W / 2) / 2, 0, -DEPTH / 2]} receiveShadow>
          <planeGeometry args={[WALL_W / 2 - boothR, DEPTH]} />
        </mesh>
      )}
      {/* 단차면(마루 마구리) — 중문 바로 뒤, 현관 타일로 45mm 내려섬 */}
      <mesh material={mats.wood} position={[tileCX, -STEP / 2, -0.02]}>
        <boxGeometry args={[tileW, STEP, 0.016]} />
      </mesh>
      {/* 개구부를 낀 벽 — 좌/우/상. 안쪽 모서리를 문틀 잼(개구+40mm)에 10mm 겹쳐 물림 — 공중 슬릿 제거 (실측 2026-08-27) */}
      <mesh material={mats.wall} position={[-(doorW / 2 + side / 2 + 0.015), WALL_H / 2, 0]}>
        <boxGeometry args={[side - 0.03, WALL_H, 0.15]} />
      </mesh>
      {!openCorner && (
        <mesh material={mats.wall} position={[doorW / 2 + side / 2 + 0.015, WALL_H / 2, 0]}>
          <boxGeometry args={[side - 0.03, WALL_H, 0.15]} />
        </mesh>
      )}
      <mesh material={mats.wall} position={[0, doorH + 0.03 + (WALL_H - doorH) / 2, 0]}>
        <boxGeometry args={[doorW + 0.3, WALL_H - doorH, 0.15]} />
      </mesh>
      {/* 걸레받이 — 정면벽 좌우 + 측벽 */}
      <mesh material={mats.base} position={[-(doorW / 2 + side / 2 + 0.015), 0.045, 0.082]}>
        <boxGeometry args={[side - 0.03, 0.09, 0.012]} />
      </mesh>
      {!openCorner && (
        <mesh material={mats.base} position={[doorW / 2 + side / 2 + 0.015, 0.045, 0.082]}>
          <boxGeometry args={[side - 0.03, 0.09, 0.012]} />
        </mesh>
      )}
      <mesh material={mats.base} position={[-WALL_W / 2 + 0.056, 0.045, 1.2]}>
        <boxGeometry args={[0.012, 0.09, 4]} />
      </mesh>
      {/* 측벽 (거실) */}
      <mesh material={mats.wall} position={[-WALL_W / 2, WALL_H / 2, 1.2]}>
        <boxGeometry args={[0.1, WALL_H, 4]} />
      </mesh>
      {/* 현관 — 뒷벽·측벽·천장 */}
      <mesh material={mats.wallBack} position={[0, WALL_H / 2, -DEPTH]}>
        <boxGeometry args={[WALL_W, WALL_H, 0.1]} />
      </mesh>
      <mesh material={mats.wall} position={[-VEST, WALL_H / 2, -DEPTH / 2]}>
        <boxGeometry args={[0.1, WALL_H, DEPTH]} />
      </mesh>
      {!openCorner && (
        <mesh material={mats.wall} position={[VEST, WALL_H / 2, -DEPTH / 2]}>
          <boxGeometry args={[0.1, WALL_H, DEPTH]} />
        </mesh>
      )}
      {/* 개방형: 도어 리턴(z 0~-SIDE_W) 뒤를 잇는 하프월 가벽 + 브론즈 고정유리 + 상부 마감 */}
      {openCorner && (() => {
        // 도어 문틀(깊이 117mm, z ±0.0585) 안쪽에서 시작 — 가벽 끝면이 문틀에 가려 이음새가 보이지 않는다
        const z0 = 0.04
        const len = DEPTH - z0, cz = -(z0 + DEPTH) / 2
        return (
          <group position={[SIDE_PLANE, 0, 0]}>
            {/* 하프월 가벽 (도장) */}
            <mesh material={mats.wall} position={[0, HALF_H / 2, cz]}>
              <boxGeometry args={[0.08, HALF_H, len]} />
            </mesh>
            {/* 고정창 — 유리 + 도어와 같은 색의 상·하 레일과 끝단 스타일 */}
            <mesh material={booth.glass} position={[0, (HALF_H + doorH) / 2, cz]}>
              <boxGeometry args={[0.02, doorH - HALF_H, len]} />
            </mesh>
            <mesh material={booth.frame} position={[0, HALF_H + 0.02, cz]}>
              <boxGeometry args={[0.06, 0.04, len]} />
            </mesh>
            <mesh material={booth.frame} position={[0, doorH - 0.02, cz]}>
              <boxGeometry args={[0.06, 0.04, len]} />
            </mesh>
            <mesh material={booth.frame} position={[0, (HALF_H + doorH) / 2, -DEPTH + 0.02]}>
              <boxGeometry args={[0.06, doorH - HALF_H, 0.04]} />
            </mesh>
            {/* 상부 마감 (가벽) */}
            <mesh material={mats.wall} position={[0, doorH + (WALL_H - doorH) / 2, cz]}>
              <boxGeometry args={[0.08, WALL_H - doorH, len]} />
            </mesh>
          </group>
        )
      })()}
      <mesh material={mats.wall} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, (3.5 - DEPTH) / 2]}>
        <planeGeometry args={[WALL_W, DEPTH + 3.5]} />
      </mesh>
      {/* 코브 간접등 — 거실 측벽 상단 + 현관 뒷벽 하단(무드등) */}
      <mesh material={mats.cove} position={[-WALL_W / 2 + 0.08, WALL_H - 0.12, 1.2]}>
        <boxGeometry args={[0.03, 0.03, 3.6]} />
      </mesh>
      <mesh material={mats.cove} position={[tileCX, 0.12 - STEP, -DEPTH + 0.07]}>
        <boxGeometry args={[tileW - 0.3, 0.025, 0.025]} />
      </mesh>
      {/* 천장 다운라이트 2개 (발광 디스크) */}
      {[[-1.1, 1.6], [1.1, 1.6]].map(([x, z], i) => (
        <mesh key={i} material={mats.down} rotation={[Math.PI / 2, 0, 0]} position={[x, WALL_H - 0.01, z]}>
          <circleGeometry args={[0.07, 20]} />
        </mesh>
      ))}
      {/* 소품 일체 — sceneProps.tsx SSOT (dev ?edit=1 기즈모로 배치) */}
      <SceneProps doorW={doorW} openCorner={openCorner} />
      {/* 현관 센서등 — 등기구 원판 (광원은 기존 pointLight가 담당) */}
      <mesh material={mats.down} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H - 0.015, -DEPTH * 0.55]}>
        <circleGeometry args={[0.09, 20]} />
      </mesh>
{/* 액자 2 — 개구부 좌우 벽 */}
      <group position={[-(doorW / 2 + side / 2), 1.55, 0.09]}>
        <mesh material={mats.frame}><boxGeometry args={[0.34, 0.44, 0.02]} /></mesh>
        <mesh material={mats.art1} position={[0, 0, 0.011]}><boxGeometry args={[0.28, 0.38, 0.004]} /></mesh>
      </group>
      {!openCorner && (
        <group position={[doorW / 2 + side / 2, 1.42, 0.09]}>
          <mesh material={mats.frame}><boxGeometry args={[0.28, 0.36, 0.02]} /></mesh>
          <mesh material={mats.art2} position={[0, 0, 0.011]}><boxGeometry args={[0.22, 0.3, 0.004]} /></mesh>
        </group>
      )}
    </group>
  )
}
