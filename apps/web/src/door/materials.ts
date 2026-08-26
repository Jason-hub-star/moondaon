import * as THREE from 'three'
import { COLORS, GLASSES, type ColorId, type GlassId } from '../generated/cards'

/** 시트 텍스처 캐시 — 우딘 스와치 실측 텍스처 (assets/색상표 → public/textures) */
const texCache = new Map<string, THREE.Texture>()
export function sheetTexture(url: string, repeat = 1.4): THREE.Texture {
  const key = `${url}@${repeat}`
  let t = texCache.get(key)
  if (!t) {
    t = new THREE.TextureLoader().load(url)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.repeat.set(repeat, repeat)
    texCache.set(key, t)
  }
  return t
}

/** 노멀·러프니스 맵용 — 색공간 변환 없이 로드 (SRGB로 읽으면 법선이 왜곡됨) */
export function linearTexture(url: string, repeat = 1.4): THREE.Texture {
  const key = `${url}@lin@${repeat}`
  let t = texCache.get(key)
  if (!t) {
    t = new THREE.TextureLoader().load(url)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.NoColorSpace
    t.repeat.set(repeat, repeat)
    texCache.set(key, t)
  }
  return t
}

function texOf(colorId: ColorId): THREE.Texture | null {
  const c = COLORS[colorId] as { texture?: string }
  return c.texture ? sheetTexture(c.texture) : null
}

export function makeFrameMaterial(colorId: ColorId) {
  const c = COLORS[colorId]
  const sheet = c.category === 'wood-sheet' || c.category === 'marble-sheet'
  const map = texOf(colorId)
  return new THREE.MeshStandardMaterial({
    color: map ? '#ffffff' : c.hex,
    map,
    metalness: sheet ? 0.05 : 0.5,
    roughness: sheet ? 0.75 : 0.4,
  })
}

/** 품질 토글 (수렴 완화책): high=transmission, lite=alpha 근사 — 모바일 대비 */
export function makeGlassMaterial(glassId: GlassId, quality: 'high' | 'lite') {
  const g = GLASSES[glassId]
  if (quality === 'lite') {
    return new THREE.MeshPhysicalMaterial({
      color: g.tint, transparent: true, opacity: Math.max(0.25, g.opacity),
      roughness: g.roughness, metalness: 0,
    })
  }
  return new THREE.MeshPhysicalMaterial({
    color: g.tint, transmission: 1 - g.opacity * 0.4, thickness: g.thicknessMm / 1000,
    ior: 1.52, roughness: g.roughness, metalness: 0,
    transparent: true, opacity: 1,
  })
}

/** 랩핑MDF (고시형 막힘부) — 랩핑시트 무광, 실텍스처 우선 */
export function makeWrapMaterial(colorId: ColorId) {
  const map = texOf(colorId)
  return new THREE.MeshStandardMaterial({
    color: map ? '#ffffff' : COLORS[colorId].hex, map, metalness: 0.05, roughness: 0.8,
  })
}
