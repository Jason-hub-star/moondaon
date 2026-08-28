import * as THREE from 'three'
import { useMemo } from 'react'
import { sheetTexture, linearTexture, makeFrameMaterial, makeGlassMaterial } from '../door/materials'
import type { ColorId, GlassId } from '../generated/cards'
import { SceneProps, useWallParams } from './sceneProps'
import type { doorSweep } from './props.data'

/**
 * 현관 목업 v3 — 오늘의집st 컷어웨이 + KKARTdoor 쇼츠 64편 실측 패턴(2026-08-26, scratchpad/kkart/census.json).
 * 실측 반영: 복도형 현관 70% → 현관을 개구폭+0.56m로 협소화, 방화문 중앙(시선축 관통),
 * 신발장 천장까지 붙박이(하부 띄움+간접등), 현관 타일 단차 -45mm. 개구 실측 중앙값 1214mm.
 * ponytail: 소품은 저폴리 프리미티브 근사 — 문이 주인공, 소품은 무드 담당.
 */
export function Entryway({ doorW, doorH, openCorner = false, colorId, glassId, quality, sweep }: {
  doorW: number; doorH: number; openCorner?: boolean
  /** 여닫이 문짝 궤적 — 소품 자동 숨김에 쓴다 */
  sweep?: ReturnType<typeof doorSweep>
  /** ㄱ자 부스 측면 고정창은 도어와 같은 제품 — 색상·유리 선택을 그대로 따른다 */
  colorId: ColorId; glassId: GlassId; quality: 'high' | 'lite'
}) {
  const mats = useMemo(() => ({
    wall: new THREE.MeshStandardMaterial({ color: '#f1eae0', roughness: 0.95,
      normalMap: linearTexture('/textures/wall-plaster-n.jpg', 3), normalScale: new THREE.Vector2(0.35, 0.35) }),
    wallBack: new THREE.MeshStandardMaterial({ color: '#ece2d4', roughness: 0.95,
      normalMap: linearTexture('/textures/wall-plaster-n.jpg', 3), normalScale: new THREE.Vector2(0.35, 0.35) }),
    // 걸레받이는 벽보다 반 톤만 낮은 오프화이트 — 국내 아파트 국룰(화이트 or 마루 매치)이고,
    // 구 #cbb499는 화면에서 채도가 제일 높아 방을 가로로 자르는 띠로 읽혔다 (P-E2, 2026-08-27)
    base: new THREE.MeshStandardMaterial({ color: '#e6dfd3', roughness: 0.8 }),
    wood: new THREE.MeshStandardMaterial({ map: sheetTexture('/textures/floor-oak.jpg', 2.4),
      normalMap: linearTexture('/textures/floor-oak-n.jpg', 2.4), normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: linearTexture('/textures/floor-oak-r.jpg', 2.4), roughness: 1 }),
    tile: new THREE.MeshStandardMaterial({ color: '#e6dfd4', map: sheetTexture('/textures/tile-porcelain.jpg', 3),
      normalMap: linearTexture('/textures/tile-porcelain-n.jpg', 3), roughness: 0.35 }),
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
  const JAMB = 0.04 // SlidingDoor 문틀 세로폭
  const WALL_T = 0.08 // 부스 가벽 두께
  const boothR = doorW / 2 // 개구 우측 끝
  // 가벽 안쪽 면은 도어 문틀 '바깥'에 붙는다 — boothR에 붙이면 가벽(80mm)이 문틀(40mm)을 통째로 삼켜
  // 문틀이 사라지고 가벽 끝면만 턱처럼 삐져나온다
  const boothIn = boothR + JAMB
  const boothOut = boothIn + WALL_T
  const SIDE_PLANE = boothIn + WALL_T / 2
  const tileW = openCorner ? VEST + boothIn : VEST * 2
  const tileCX = openCorner ? (boothIn - VEST) / 2 : 0
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
        <mesh material={mats.wood} rotation={[-Math.PI / 2, 0, 0]} position={[(boothOut + WALL_W / 2) / 2, 0, -DEPTH / 2]} receiveShadow>
          <planeGeometry args={[WALL_W / 2 - boothOut, DEPTH]} />
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
      {/* 개구 상부 벽 — 문틀 상단(doorH+0.04)에서 천장까지 딱 맞게. 높이를 WALL_H-doorH로 두면 천장 위로 솟는다.
          개방형에선 우측 끝을 부스 가벽 바깥면(boothR+0.08)에 맞춰 헤더가 부스보다 튀어나오지 않게 한다 */}
      {(() => {
        const y0 = doorH + JAMB
        const xL = -(doorW / 2 + 0.15)
        const xR = openCorner ? boothOut : doorW / 2 + 0.15
        return (
          <mesh material={mats.wall} position={[(xL + xR) / 2, (y0 + WALL_H) / 2, 0]}>
            <boxGeometry args={[xR - xL, WALL_H - y0, 0.15]} />
          </mesh>
        )
      })()}
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
        // 문틀이 가벽을 이긴다 — 코너 기둥(문틀 색, 가벽 두께까지 덮음)이 앞면을 잡고,
        // 가벽·고정창은 그 기둥 뒷면(z −0.075)에서 시작해 끝면이 기둥에 완전히 가려진다
        const zF = -0.075
        const len = DEPTH + zF, cz = (zF - DEPTH) / 2
        const y0 = doorH + JAMB // 상부 마감 시작 = 정면 헤더와 같은 높이
        return (
          <group position={[SIDE_PLANE, 0, 0]}>
            {/* 하프월 가벽 (도장) */}
            <mesh material={mats.wall} position={[0, HALF_H / 2, cz]}>
              <boxGeometry args={[WALL_T, HALF_H, len]} />
            </mesh>
            {/* 고정창 — 유리 + 도어와 같은 색의 상·하 레일과 끝단 스타일 */}
            <mesh material={booth.glass} position={[0, (HALF_H + doorH) / 2, cz]}>
              <boxGeometry args={[0.02, doorH - HALF_H, len]} />
            </mesh>
            {/* 하부 레일은 하프월 위에 얹힌 창대 — 벽과 같은 두께로 면을 맞춰야 끝단에 턱이 안 생긴다 */}
            <mesh material={booth.frame} position={[0, HALF_H + 0.02, cz]}>
              <boxGeometry args={[WALL_T, 0.04, len]} />
            </mesh>
            <mesh material={booth.frame} position={[0, doorH + JAMB / 2, cz]}>
              <boxGeometry args={[0.06, JAMB, len]} />
            </mesh>
            <mesh material={booth.frame} position={[0, (HALF_H + doorH) / 2, -DEPTH + 0.02]}>
              <boxGeometry args={[0.06, doorH - HALF_H, 0.04]} />
            </mesh>
            {/* 상부 마감 (가벽) */}
            <mesh material={mats.wall} position={[0, (y0 + WALL_H) / 2, cz]}>
              <boxGeometry args={[WALL_T, WALL_H - y0, len]} />
            </mesh>
          </group>
        )
      })()}
      {/* 코너 기둥 — 문틀 색으로 개구 끝선부터 가벽 바깥면까지 덮는다. 도어 문틀과 같은 부재로 읽히면서
          가벽·고정창의 끝면을 가려 코너에 턱이 남지 않는다 (문틀이 가벽을 이긴다) */}
      {openCorner && (
        <mesh material={booth.frame} position={[(boothR + boothOut) / 2, (doorH + JAMB) / 2, 0]}>
          <boxGeometry args={[boothOut - boothR, doorH + JAMB, 0.15]} />
        </mesh>
      )}
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
      <SceneProps doorW={doorW} openCorner={openCorner} sweep={sweep} />
      {/* 현관 센서등 — 등기구 원판 (광원은 기존 pointLight가 담당) */}
      <mesh material={mats.down} rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H - 0.015, -DEPTH * 0.55]}>
        <circleGeometry args={[0.09, 20]} />
      </mesh>
      {/* 액자는 소품 SSOT(props.data.ts art-l·art-r)로 이관 — 여기 있으면 프레임 게이트가 못 잰다 (P-E2) */}
    </group>
  )
}
