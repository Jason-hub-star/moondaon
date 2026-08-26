// 카드 파이프라인: data/cards/*.md (frontmatter) → Zod 검증 → apps/web/src/generated/cards.ts
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { z } from 'zod'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hex = z.string().regex(/^#[0-9a-f]{6}$/)

const schemas = {
  colors: z.object({
    id: z.string(), name: z.string(),
    category: z.enum(['basic-op', 'basic-sheet', 'wood-sheet', 'marble-sheet', 'abs']),
    finish: z.string(), hex, hexSource: z.enum(['approx', 'measured']),
    sheetCode: z.string().nullable(), texture: z.string().optional(), source: z.string(),
  }),
  glasses: z.object({
    id: z.string(), name: z.string(), thicknessMm: z.number(),
    tint: hex, opacity: z.number().min(0).max(1), roughness: z.number().min(0).max(1),
    mesh: z.boolean(), renderSource: z.enum(['approx', 'measured']), source: z.string(),
  }),
  patterns: z.object({
    id: z.string(), name: z.string(),
    vLines: z.array(z.number().min(0).max(1)), hLines: z.array(z.number().min(0).max(1)),
    solidCells: z.array(z.tuple([z.number().int(), z.number().int()])),
    archProfile: z.number().min(0).max(0.6).optional(),
    spandrel: z.enum(['solid', 'glass']).optional(),
    arcs: z.array(z.object({
      anchor: z.enum(['tl', 'tr', 'bl', 'br', 'left', 'right', 'top', 'bottom', 'center']),
      rx: z.number().min(0).max(1), ry: z.number().min(0).max(1),
      fill: z.enum(['solid', 'glass']), invert: z.boolean().optional(),
    })).optional(),
    motions: z.array(z.string()).optional(),
    geometrySource: z.enum(['approx', 'measured']), source: z.string(),
  }),
  handles: z.object({
    id: z.string(), name: z.string(), lengthM: z.number(),
    type: z.enum(['adhesive', 'integrated']), source: z.string(),
  }),
  products: z.object({
    id: z.string(), name: z.string(), motion: z.string(), panels: z.number().int(),
    frameDepthM: z.number(), stileWidthM: z.number(), stileDepthM: z.number(),
    widthRangeM: z.tuple([z.number(), z.number()]), maxHeightM: z.number(),
    panelWidthFr: z.array(z.number().min(0).max(1)).optional(),
    fixedPanels: z.array(z.number().int()).optional(),
    phase: z.string(), source: z.string(),
  }),
}

const out = {}
let errors = 0
for (const [kind, schema] of Object.entries(schemas)) {
  const dir = join(root, 'data/cards', kind)
  out[kind] = []
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
    const { data } = matter(readFileSync(join(dir, f), 'utf8'))
    const r = schema.safeParse(data)
    if (!r.success) {
      errors++
      console.error(`FAIL ${kind}/${f}:`, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    } else out[kind].push(r.data)
  }
}
if (errors) { console.error(`${errors} card(s) invalid`); process.exit(1) }

// ---- 교차 검증 (Zod가 못 보는 카드 내부 정합성 — 게이트) ----
const xerr = []
for (const c of out.patterns) {
  const rows = c.hLines.length + 1, cols = c.vLines.length + 1
  for (const [r, cc] of c.solidCells)
    if (r < 0 || r >= rows || cc < 0 || cc >= cols) xerr.push(`patterns/${c.id}: solidCells [${r},${cc}]가 그리드(${rows}행×${cols}열) 밖`)
  for (const arr of [c.vLines, c.hLines]) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] <= 0 || arr[i] >= 1) xerr.push(`patterns/${c.id}: 분할선 ${arr[i]}는 (0,1) 열린구간이어야 함`)
      if (i > 0 && arr[i] <= arr[i - 1]) xerr.push(`patterns/${c.id}: 분할선이 오름차순 아님`)
    }
  }
  for (const a of c.arcs ?? []) {
    if (a.invert && !['tl', 'tr', 'bl', 'br'].includes(a.anchor)) xerr.push(`patterns/${c.id}: invert는 코너 앵커에서만 유효 (${a.anchor})`)
  }
  if (c.spandrel && c.archProfile == null) xerr.push(`patterns/${c.id}: spandrel은 archProfile 필요`)
}
for (const c of out.products) {
  if (c.panelWidthFr) {
    if (c.panelWidthFr.length !== c.panels) xerr.push(`products/${c.id}: panelWidthFr 길이 ${c.panelWidthFr.length} ≠ panels ${c.panels}`)
    const sum = c.panelWidthFr.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1) > 0.01) xerr.push(`products/${c.id}: panelWidthFr 합 ${sum.toFixed(3)} ≠ 1`)
  }
  for (const i of c.fixedPanels ?? [])
    if (i < 0 || i >= c.panels) xerr.push(`products/${c.id}: fixedPanels ${i}가 panels ${c.panels} 밖`)
}
if (xerr.length) { xerr.forEach((e) => console.error('XCHECK FAIL', e)); process.exit(1) }

// ---- 패턴 썸네일 SVG (시각 게이트 + UI 칩) — PanelMesh와 동일한 파라메트릭 샘플링 ----
const CORNERS = { tl: { sx: 1, sy: -1 }, tr: { sx: -1, sy: -1 }, bl: { sx: 1, sy: 1 }, br: { sx: -1, sy: 1 } }
function arcPoints(a, iw, ih, N = 28) {
  // 내부 좌표(x우측+, y위+, 중심 원점) 폴리곤 — PanelMesh arcRegionShape 이식
  const RX = a.rx * iw, RY = a.ry * ih
  const pts = []
  const arc = (cx, cy, rx, ry, a0, a1) => { for (let i = 0; i <= N; i++) { const t = a0 + (a1 - a0) * (i / N); pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]) } }
  if (a.anchor === 'center') { arc(0, 0, RX, RY, 0, 2 * Math.PI); return pts }
  if (a.anchor === 'right') { arc(iw / 2, 0, RX, RY, Math.PI / 2, 1.5 * Math.PI); return pts }
  if (a.anchor === 'left') { arc(-iw / 2, 0, RX, RY, Math.PI / 2, -Math.PI / 2); return pts }
  if (a.anchor === 'top') { arc(0, ih / 2, RX, RY, Math.PI, 2 * Math.PI); return pts }
  if (a.anchor === 'bottom') { arc(0, -ih / 2, RX, RY, Math.PI, 0); return pts }
  const { sx, sy } = CORNERS[a.anchor]
  const cx = (-sx * iw) / 2, cy = (-sy * ih) / 2
  if (a.invert) {
    const ox = cx + sx * RX, oy = cy + sy * RY
    const a0 = sy < 0 ? Math.PI / 2 : -Math.PI / 2
    const a1 = sx > 0 ? Math.PI : 0
    pts.push([cx, cy], [ox, cy])
    // cw 여부에 맞게 각도 진행 (tr·bl은 시계방향 = 각도 감소)
    const cw = a.anchor === 'tr' || a.anchor === 'bl'
    arc(ox, oy, RX, RY, a0, cw ? a1 - (a1 > a0 ? 2 * Math.PI : 0) : a1 + (a1 < a0 ? 2 * Math.PI : 0))
    pts.push([cx, cy + sy * RY])
    return pts
  }
  const table = { tl: [0, -Math.PI / 2], tr: [Math.PI, 1.5 * Math.PI], bl: [0, Math.PI / 2], br: [Math.PI, Math.PI / 2] }[a.anchor]
  pts.push([cx, cy])
  arc(cx, cy, RX, RY, table[0], table[1])
  return pts
}
function thumbSVG(p) {
  const W = 60, H = 100, m = 3, iw = W - 2 * m, ih = H - 2 * m
  const mapPt = ([x, y]) => `${(m + iw / 2 + x).toFixed(1)},${(m + ih / 2 - y).toFixed(1)}`
  const DARK = '#4a453e', LINE = '#9a938a', BG = '#ffffff'
  const el = []
  const legacyArch = p.archProfile != null && !p.spandrel
  const R = p.archProfile != null ? p.archProfile * ih : 0
  if (legacyArch) {
    el.push(`<path d="M${m},${m + ih} L${m},${m + 2 * R} Q${m + iw / 2},${m - 2 * R} ${m + iw},${m + 2 * R} L${m + iw},${m + ih} Z" fill="${BG}" stroke="${LINE}" stroke-width="1.5"/>`)
  } else {
    el.push(`<rect x="${m}" y="${m}" width="${iw}" height="${ih}" fill="${BG}" stroke="${LINE}" stroke-width="1.5"/>`)
  }
  const xs = [0, ...p.vLines, 1], ys = [0, ...p.hLines, 1]
  for (const [r, c] of p.solidCells) {
    const x = m + xs[c] * iw, w = (xs[c + 1] - xs[c]) * iw
    const yTop = m + (1 - ys[r + 1]) * ih, h = (ys[r + 1] - ys[r]) * ih
    el.push(`<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${DARK}"/>`)
  }
  for (const a of p.arcs ?? []) {
    const pts = arcPoints(a, iw, ih).map(mapPt).join(' ')
    el.push(`<polygon points="${pts}" fill="${a.fill === 'solid' ? DARK : BG}" stroke="${LINE}" stroke-width="1"/>`)
  }
  if (p.spandrel && p.archProfile != null) {
    const y1 = m + 2 * R, cx2 = m + iw / 2
    const fill = p.spandrel === 'solid' ? DARK : BG
    el.push(`<path d="M${m},${y1} Q${m + iw / 4},${m} ${cx2},${m} L${m},${m} Z" fill="${fill}" stroke="${LINE}" stroke-width="1"/>`)
    el.push(`<path d="M${m + iw},${y1} Q${m + (3 * iw) / 4},${m} ${cx2},${m} L${m + iw},${m} Z" fill="${fill}" stroke="${LINE}" stroke-width="1"/>`)
  }
  for (const x of p.vLines) el.push(`<line x1="${(m + x * iw).toFixed(1)}" y1="${m}" x2="${(m + x * iw).toFixed(1)}" y2="${m + ih}" stroke="${LINE}" stroke-width="1"/>`)
  for (const y of p.hLines) el.push(`<line x1="${m}" y1="${(m + (1 - y) * ih).toFixed(1)}" x2="${m + iw}" y2="${(m + (1 - y) * ih).toFixed(1)}" stroke="${LINE}" stroke-width="1"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${el.join('')}</svg>`
}
const thumbs = Object.fromEntries(out.patterns.map((c) => [c.id, thumbSVG(c)]))

// ---- 제품 썸네일 SVG — motion·panels·panelWidthFr·fixedPanels에서 실루엣 자동 생성 ----
function productThumbSVG(p) {
  const W = 84, H = 100, m = 4
  const LINE = '#9a938a', DARK = '#4a453e', BG = '#ffffff'
  const el = []
  const dw = W - 2 * m, dh = H - 2 * m - 12 // 하단 12px는 개폐 화살표 영역
  const y0 = m, y1 = m + dh
  const panelRect = (x, w, opts = {}) =>
    `<rect x="${x.toFixed(1)}" y="${(opts.y ?? y0).toFixed(1)}" width="${w.toFixed(1)}" height="${(opts.h ?? dh).toFixed(1)}" fill="${opts.fill ?? BG}" stroke="${LINE}" stroke-width="1.5"/>`
  const chev = (x, y, dir) => `<path d="M${x},${y - 4} L${x + 5 * dir},${y} L${x},${y + 4}" fill="none" stroke="${DARK}" stroke-width="1.6"/>`
  const ay = y1 + 7 // 화살표 y
  const fr = p.panelWidthFr && p.panelWidthFr.length === p.panels ? p.panelWidthFr : Array.from({ length: p.panels }, () => 1 / p.panels)
  const fixed = new Set(p.fixedPanels ?? [])
  if (p.motion === 'sliding_multi_panel' || p.motion === 'automatic_sliding' || p.motion === 'louver_sliding') {
    // N트랙 순차 겹침 — 패널마다 살짝 겹치고 z단차
    const overlap = 6
    const pw = (dw + (p.panels - 1) * overlap) / p.panels
    for (let i = p.panels - 1; i >= 0; i--) {
      const x = m + i * (pw - overlap)
      el.push(panelRect(x, pw))
      if (p.motion === 'louver_sliding') for (let k = 1; k <= 3; k++)
        el.push(`<line x1="${(x + (pw * k) / 4).toFixed(1)}" y1="${y0 + 3}" x2="${(x + (pw * k) / 4).toFixed(1)}" y2="${y1 - 3}" stroke="${LINE}" stroke-width="1"/>`)
    }
    if (p.id === 'custom-arch') el.push(`<path d="M${m},${y0 + 16} Q${m + dw / 2},${y0 - 10} ${m + dw},${y0 + 16}" fill="none" stroke="${DARK}" stroke-width="1.5"/>`)
    if (p.motion === 'automatic_sliding') el.push(`<circle cx="${m + dw / 2}" cy="${y0 + 6}" r="2.5" fill="${DARK}"/>`)
    el.push(chev(m + dw / 2 - 8, ay, -1), chev(m + dw / 2 + 8, ay, -1))
  } else if (p.motion === 'sliding_single_panel') {
    el.push(panelRect(m + 4, dw - 8))
    el.push(chev(m + dw / 2 - 8, ay, -1), chev(m + dw / 2 + 8, ay, -1))
  } else if (p.motion === 'sliding_multi_panel_corner') {
    // ㄱ자 — 정면 2장 + 측면 원근 평행사변형(고정 픽스)
    const fw = dw * 0.66, pw2 = fw / 2 + 3
    el.push(panelRect(m + pw2 - 3, pw2))
    el.push(panelRect(m, pw2))
    const sx = m + fw + 2
    el.push(`<path d="M${sx},${y0 + 5} L${m + dw},${y0 + 12} L${m + dw},${y1 - 12} L${sx},${y1 - 5} Z" fill="#f3efe9" stroke="${LINE}" stroke-width="1.3"/>`)
    el.push(chev(m + fw / 2 - 6, ay, -1), chev(m + fw / 2 + 6, ay, -1))
  } else if (p.motion === 'swing_bi_directional') {
    let acc = m
    fr.forEach((f, i) => {
      const w = f * dw
      el.push(panelRect(acc, w, { fill: fixed.has(i) ? '#f3efe9' : BG }))
      if (!fixed.has(i)) {
        // 양방향 스윙 — 문짝 하단에 좌우 화살표
        const cx2 = acc + w / 2
        el.push(chev(cx2 - 7, ay, -1), chev(cx2 + 7, ay, 1))
      }
      acc += w
    })
  } else if (p.motion === 'abs_hinged') {
    el.push(panelRect(m + 8, dw - 16, { fill: '#f3efe9' }))
    for (const k of [0.3, 0.5, 0.7])
      el.push(`<line x1="${m + 14}" y1="${(y0 + dh * k).toFixed(1)}" x2="${m + dw - 14}" y2="${(y0 + dh * k).toFixed(1)}" stroke="${LINE}" stroke-width="1"/>`)
    el.push(`<circle cx="${m + dw - 13}" cy="${(y0 + dh / 2).toFixed(1)}" r="2" fill="${DARK}"/>`)
    el.push(chev(m + dw / 2 + 4, ay, 1))
  } else {
    el.push(panelRect(m, dw))
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${el.join('')}</svg>`
}
const productThumbs = Object.fromEntries(out.products.map((c) => [c.id, productThumbSVG(c)]))

const ids = (k) => out[k].map((c) => `'${c.id}'`).join(' | ')
const ts = `// 자동 생성 — 편집 금지. 정본은 data/cards/*.md (scripts/build-cards.mjs)
export type ColorId = ${ids('colors')}
export type GlassId = ${ids('glasses')}
export type PatternId = ${ids('patterns')}
export type HandleId = ${ids('handles')}
export type ProductId = ${ids('products')}
${Object.entries(out).map(([k, v]) => `export const ${k.toUpperCase()} = ${JSON.stringify(Object.fromEntries(v.map((c) => [c.id, c])), null, 1)} as const`).join('\n')}
export const PATTERN_THUMBS: Record<PatternId, string> = ${JSON.stringify(thumbs, null, 0)}
export const PRODUCT_THUMBS: Record<ProductId, string> = ${JSON.stringify(productThumbs, null, 0)}
`
mkdirSync(join(root, 'apps/web/src/generated'), { recursive: true })
writeFileSync(join(root, 'apps/web/src/generated/cards.ts'), ts)
console.log(`OK: ${Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', ')}`)
