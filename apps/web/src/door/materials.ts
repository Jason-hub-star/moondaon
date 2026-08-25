import * as THREE from 'three'

/** 리플렛 운영색 (도장/아노다이징) — hex는 근사(approx) */
export const FRAME_COLORS = {
  'tiffany-white': { name: '티파니 화이트', hex: '#f4f1ea' },
  black: { name: '블랙', hex: '#1d1d1f' },
  'champagne-gold': { name: '샴페인골드', hex: '#c5a572' },
} as const

/** 적용 유리 10종 중 P1a 대표 4종 — tint는 근사 */
export const GLASSES = {
  clear: { name: '투명', tint: '#eef2f2', opacity: 0.18, roughness: 0.02 },
  bronze: { name: '브론즈', tint: '#8a6a4f', opacity: 0.38, roughness: 0.02 },
  mist: { name: '미스트', tint: '#dfe5e5', opacity: 0.55, roughness: 0.55 },
  aqua: { name: '아쿠아', tint: '#bcd8d4', opacity: 0.32, roughness: 0.05 },
} as const

export type GlassId = keyof typeof GLASSES
export type FrameColorId = keyof typeof FRAME_COLORS

export function makeFrameMaterial(colorId: FrameColorId) {
  const { hex } = FRAME_COLORS[colorId]
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.55, roughness: 0.4 })
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
    color: g.tint, transmission: 1 - g.opacity * 0.4, thickness: 0.005,
    ior: 1.52, roughness: g.roughness, metalness: 0,
    transparent: true, opacity: 1,
  })
}

/** 랩핑MDF (고시형 막힘부) — 랩핑시트 무광 */
export function makeWrapMaterial(colorId: FrameColorId) {
  const { hex } = FRAME_COLORS[colorId]
  return new THREE.MeshStandardMaterial({ color: hex, metalness: 0.05, roughness: 0.8 })
}
