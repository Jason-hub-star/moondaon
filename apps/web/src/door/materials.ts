import * as THREE from 'three'
import { COLORS, GLASSES, type ColorId, type GlassId } from '../generated/cards'

export function makeFrameMaterial(colorId: ColorId) {
  const c = COLORS[colorId]
  const wood = c.category === 'wood-sheet'
  return new THREE.MeshStandardMaterial({
    color: c.hex,
    metalness: wood ? 0.05 : 0.5,
    roughness: wood ? 0.75 : 0.4,
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

/** 랩핑MDF (고시형 막힘부) — 랩핑시트 무광 */
export function makeWrapMaterial(colorId: ColorId) {
  return new THREE.MeshStandardMaterial({ color: COLORS[colorId].hex, metalness: 0.05, roughness: 0.8 })
}
