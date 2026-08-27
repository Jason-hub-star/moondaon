// 카드 파이프라인: data/cards/*.md (frontmatter) → Zod 검증 → apps/web/src/generated/cards.ts
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { z } from 'zod'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const hex = z.string().regex(/^#[0-9a-f]{6}$/)

/**
 * 근거 규약 (R1-14 "실측치 들어오면 교체"의 구조화).
 *
 * `measured` = **문다온이 준 수치**를 그대로 쓴 필드 목록 (팜플렛 인쇄값 또는 실측 수령값).
 * 목록에 없는 수치 필드는 전부 **우리가 추정한 값** — 실측이 도착하면 교체 대상이다.
 * `confirmWith` = 문다온에 물어봐야 할 필드와 그 내용. 물어볼 게 있는 것만 적는다.
 *
 * 값이 하나뿐인 카드(색상 hex·유리 발색)는 카드 단위 `hexSource`/`renderSource`가 이미
 * 같은 일을 하므로 중복해서 넣지 않는다 — 집계만 양쪽을 함께 센다.
 */
const provenance = {
  measured: z.array(z.string()).optional(),
  confirmWith: z.record(z.string(), z.string()).optional(),
}

/** 실측 교체 대상이 되는 수치 필드 (집계 분모) */
const NUMERIC_FIELDS = {
  products: ['panels', 'frameDepthM', 'stileWidthM', 'stileDepthM', 'widthRangeM', 'maxHeightM', 'panelWidthFr', 'jambM', 'overlapM', 'louverBarM', 'louverGapM', 'sizeZonesMm', 'trackPitchM', 'panelThicknessM'],
  handles: ['lengthM'],
  rails: ['heightMm', 'widthMm'],
  patterns: ['archProfile'],
}

const schemas = {
  colors: z.object({
    id: z.string(), name: z.string(),
    category: z.enum(['basic-op', 'basic-sheet', 'wood-sheet', 'marble-sheet', 'abs']),
    finish: z.string(), hex, hexSource: z.enum(['approx', 'measured']),
    sheetCode: z.string().nullable(), texture: z.string().optional(),
    confirmWith: provenance.confirmWith, source: z.string(),
  }),
  glasses: z.object({
    id: z.string(), name: z.string(), thicknessMm: z.number(),
    tint: hex, opacity: z.number().min(0).max(1), roughness: z.number().min(0).max(1),
    mesh: z.boolean(),
    /** 팜플렛 p2: 모루·굴곡유리 선택 시 기본 일체형 손잡이 적용 */
    requiresIntegratedHandle: z.boolean().optional(),
    confirmWith: provenance.confirmWith,
    renderSource: z.enum(['approx', 'measured']), source: z.string(),
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
    ...provenance,
    geometrySource: z.enum(['approx', 'measured']), source: z.string(),
  }),
  rails: z.object({
    id: z.string(), name: z.string(),
    /** 문턱 높이 (mm) — 0이면 무레일 */
    heightMm: z.number().min(0).max(50),
    /** 레일 폭 (mm) — 팜플렛에 표기된 제품만 (원슬 25X5) */
    widthMm: z.number().nullable(),
    /** 고객이 읽을 한 줄 — 걸림·외풍·청소 트레이드오프 */
    note: z.string(),
    ...provenance,
    source: z.string(),
  }),
  handles: z.object({
    id: z.string(), name: z.string(), lengthM: z.number(),
    type: z.enum(['adhesive', 'integrated', 'half-moon']),
    orderType: z.enum(['stock', 'order']),
    colorIds: z.array(z.string()),
    ...provenance,
    source: z.string(),
  }),
  products: z.object({
    id: z.string(), name: z.string(), motion: z.string(), panels: z.number().int(),
    frameDepthM: z.number(), stileWidthM: z.number(), stileDepthM: z.number(),
    widthRangeM: z.tuple([z.number(), z.number()]), maxHeightM: z.number(),
    panelWidthFr: z.array(z.number().min(0).max(1)).optional(),
    fixedPanels: z.array(z.number().int()).optional(),
    glassIds: z.array(z.string()).optional(),
    colorIds: z.array(z.string()).optional(),
    colorCats: z.array(z.enum(['basic-op', 'basic-sheet', 'wood-sheet', 'marble-sheet', 'abs'])).optional(),
    /** 팜플렛 "구간별 사이즈" 표 (mm) — 없으면 구간 개념이 없는 제품이라 UI가 표시하지 않는다 */
    sizeZonesMm: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
    /** 문틀 정면폭 (m) — 팜플렛 미표기. 렌더가 이 값으로 문틀 3면을 그린다 */
    jambM: z.number(),
    /** 연동 트랙 간 간격 (m) — 문틀 깊이 안에 N트랙이 들어가는 하드웨어 피치 */
    trackPitchM: z.number().optional(),
    /** 문짝 두께 (m) — 여닫이(ABS)만. 슬라이딩·스윙은 stileDepthM이 대신한다 */
    panelThicknessM: z.number().optional(),
    /** 인접 문짝 겹침폭 (m) — 연동 슬라이딩만. 없으면 겹침 0 */
    overlapM: z.number().optional(),
    /** 간살 바 폭·간격 (m) — 간살 도어만 (팜플렛 "기본간격 30~40미리") */
    louverBarM: z.number().optional(),
    louverGapM: z.number().optional(),
    /** 하부레일(문턱) 허용 목록 — 없으면 레일 개념이 없는 제품(스윙·ABS 여닫이)이라 UI가 섹션을 숨긴다 */
    railIds: z.array(z.string()).optional(),
    /** 스윙 제품 힌지 구성 (팜플렛 2026-08 p5 제작칫수) */
    hinge: z.string().optional(),
    /** 양개도어 주문 시 강화유리 기본적용 (팜플렛 2026-08 p5) */
    temperedDefault: z.boolean().optional(),
    ...provenance,
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
const glassIdSet = new Set(out.glasses.map((g) => g.id))
const colorIdSet = new Set(out.colors.map((g) => g.id))
const railIdSet = new Set(out.rails.map((g) => g.id))
if (out.glasses.some((g) => g.requiresIntegratedHandle) && !out.handles.some((h) => h.type === 'integrated'))
  xerr.push(`glasses: requiresIntegratedHandle 유리가 있는데 type 'integrated' 손잡이 카드가 없음 — UI가 고를 수 있는 손잡이를 잃는다`)
for (const c of out.handles) {
  if (!c.colorIds.length) xerr.push(`handles/${c.id}: colorIds가 비어 있음 — 최소 1색`)
  for (const g of c.colorIds)
    if (!colorIdSet.has(g)) xerr.push(`handles/${c.id}: colorIds '${g}' — 존재하지 않는 색상 카드`)
}
for (const c of out.products) {
  for (const g of c.glassIds ?? [])
    if (!glassIdSet.has(g)) xerr.push(`products/${c.id}: glassIds '${g}' — 존재하지 않는 유리 카드`)
  for (const g of c.colorIds ?? [])
    if (!colorIdSet.has(g)) xerr.push(`products/${c.id}: colorIds '${g}' — 존재하지 않는 색상 카드`)
  if (c.railIds) {
    // 빈 배열은 "레일이 없다"가 아니라 "고를 게 없다"라 UI가 빈 섹션을 그린다 — 필드를 지우게 한다
    if (!c.railIds.length) xerr.push(`products/${c.id}: railIds가 비어 있음 — 레일이 없는 제품이면 필드를 지운다`)
    for (const g of c.railIds)
      if (!railIdSet.has(g)) xerr.push(`products/${c.id}: railIds '${g}' — 존재하지 않는 레일 카드`)
  }
  // 팜플렛 두 규칙("양개는 강화 기본" × "망입은 강화불가")이 한 제품에서 부딪히면 UI가 답을 못 낸다
  if (c.temperedDefault)
    for (const g of c.glassIds ?? [])
      if (out.glasses.find((x) => x.id === g)?.mesh)
        xerr.push(`products/${c.id}: 강화 기본 제품인데 망입 유리 '${g}'를 허용한다 — 팜플렛상 강화불가`)
  // 간살 수치는 간살 도어에만 의미가 있다 — 다른 제품에 붙으면 렌더가 조용히 무시해 낡은 값이 남는다
  const isLouver = c.motion === 'louver_sliding'
  const hasLouver = c.louverBarM != null || c.louverGapM != null
  if (isLouver && !(c.louverBarM != null && c.louverGapM != null))
    xerr.push(`products/${c.id}: 간살 도어인데 louverBarM/louverGapM이 없다`)
  if (!isLouver && hasLouver) xerr.push(`products/${c.id}: 간살이 아닌데 louver 수치가 있다`)
  if (c.motion === 'abs_hinged' && c.panelThicknessM == null)
    xerr.push(`products/${c.id}: 여닫이인데 panelThicknessM이 없다 — 문짝 두께를 렌더가 못 정한다`)
  if (c.panels > 1 && c.overlapM != null && c.trackPitchM == null)
    xerr.push(`products/${c.id}: 연동인데 trackPitchM이 없다 — 트랙이 겹쳐 Z-파이팅이 난다`)
  if (c.panels > 1 && c.motion.startsWith('sliding') && c.overlapM == null)
    xerr.push(`products/${c.id}: 연동 슬라이딩인데 overlapM이 없다 — 겹침 0으로 렌더된다`)
  if (c.sizeZonesMm) {
    const z = c.sizeZonesMm
    for (let i = 0; i < z.length; i++) {
      if (z[i][0] >= z[i][1]) xerr.push(`products/${c.id}: sizeZonesMm[${i}] 하한이 상한 이상`)
      if (i > 0 && z[i][0] <= z[i - 1][1]) xerr.push(`products/${c.id}: sizeZonesMm 구간이 겹치거나 역순`)
    }
    // 슬라이더 범위와 어긋나면 고객이 표에 없는 폭을 고르고도 구간을 못 본다
    const [lo, hi] = [z[0][0], z[z.length - 1][1]]
    if (Math.round(c.widthRangeM[0] * 1000) !== lo) xerr.push(`products/${c.id}: 구간 하한 ${lo} ≠ widthRangeM 하한 ${c.widthRangeM[0] * 1000}`)
    if (Math.round(c.widthRangeM[1] * 1000) !== hi) xerr.push(`products/${c.id}: 구간 상한 ${hi} ≠ widthRangeM 상한 ${c.widthRangeM[1] * 1000}`)
  }
  if (c.panelWidthFr) {
    if (c.panelWidthFr.length !== c.panels) xerr.push(`products/${c.id}: panelWidthFr 길이 ${c.panelWidthFr.length} ≠ panels ${c.panels}`)
    const sum = c.panelWidthFr.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1) > 0.01) xerr.push(`products/${c.id}: panelWidthFr 합 ${sum.toFixed(3)} ≠ 1`)
  }
  for (const i of c.fixedPanels ?? [])
    if (i < 0 || i >= c.panels) xerr.push(`products/${c.id}: fixedPanels ${i}가 panels ${c.panels} 밖`)
}
// ---- 근거 규약 검증 + 집계 (실측값이 도착했을 때 어디를 고칠지 카드가 말하게 한다) ----
const pending = [] // 실측 대기: [kind/id, field]
const asks = []    // 문다온 확인: [kind/id, field, 물어볼 내용]
for (const [kind, fields] of Object.entries(NUMERIC_FIELDS)) {
  const known = new Set(Object.keys(schemas[kind].shape))
  for (const c of out[kind]) {
    const measured = new Set(c.measured ?? [])
    const ask = c.confirmWith ?? {}
    // 오타 차단 — 스키마가 모르는 필드명을 적으면 그 항목은 영원히 아무것도 가리키지 않는다
    for (const f of measured)
      if (!known.has(f)) xerr.push(`${kind}/${c.id}: measured '${f}' — 스키마에 없는 필드명`)
    for (const [f, why] of Object.entries(ask)) {
      if (!known.has(f)) xerr.push(`${kind}/${c.id}: confirmWith '${f}' — 스키마에 없는 필드명`)
      if (!why.trim()) xerr.push(`${kind}/${c.id}: confirmWith.${f} — 물어볼 내용이 비었다`)
      // 모순 차단: 실측을 반영하고도 확인 목록을 안 지우는 사고를 여기서 잡는다
      if (measured.has(f)) xerr.push(`${kind}/${c.id}: '${f}'가 measured이면서 confirmWith에 남아 있다 — 반영 후 확인 항목을 지운다`)
      asks.push([`${kind}/${c.id}`, f, why])
    }
    if (c.measured && !c.measured.length) xerr.push(`${kind}/${c.id}: measured가 빈 배열 — 확정 필드가 없으면 필드를 지운다`)
    // null은 "그 제품엔 해당 없음"이라 실측 대상이 아니다 (레일 widthMm 등)
    for (const f of fields)
      if (c[f] != null && !measured.has(f)) pending.push([`${kind}/${c.id}`, f])
  }
}
// 색상·유리는 measured 대신 카드 단위 등급을 쓴다 — 그 등급과 confirmWith가 어긋나면 잡는다
for (const [kind, gradeKey, valueKey] of [['colors', 'hexSource', 'hex'], ['glasses', 'renderSource', 'tint']]) {
  const known = new Set(Object.keys(schemas[kind].shape))
  for (const c of out[kind]) {
    for (const [f, why] of Object.entries(c.confirmWith ?? {})) {
      if (!known.has(f)) xerr.push(`${kind}/${c.id}: confirmWith '${f}' — 스키마에 없는 필드명`)
      if (!why.trim()) xerr.push(`${kind}/${c.id}: confirmWith.${f} — 물어볼 내용이 비었다`)
      if (f === valueKey && c[gradeKey] === 'measured')
        xerr.push(`${kind}/${c.id}: ${gradeKey}가 measured인데 confirmWith.${f}가 남아 있다`)
      asks.push([`${kind}/${c.id}`, f, why])
    }
  }
}

// 패턴 실루엣은 분할선 좌표 뭉치라 필드로 못 센다 — 카드 단위로 센다

const approxCards = out.colors.filter((c) => c.hexSource === 'approx').length
  + out.glasses.filter((c) => c.renderSource === 'approx').length
  + out.patterns.filter((c) => c.geometrySource === 'approx').length

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
export type RailId = ${ids('rails')}
export type ProductId = ${ids('products')}
${Object.entries(out).map(([k, v]) => `export const ${k.toUpperCase()} = ${JSON.stringify(Object.fromEntries(v.map((c) => [c.id, c])), null, 1)} as const`).join('\n')}
export const PATTERN_THUMBS: Record<PatternId, string> = ${JSON.stringify(thumbs, null, 0)}
export const PRODUCT_THUMBS: Record<ProductId, string> = ${JSON.stringify(productThumbs, null, 0)}
`
mkdirSync(join(root, 'apps/web/src/generated'), { recursive: true })
writeFileSync(join(root, 'apps/web/src/generated/cards.ts'), ts)
console.log(`OK: ${Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', ')}`)
console.log(`근거: 실측 대기 ${pending.length}개 필드 + 근사 카드 ${approxCards}장 · 문다온 확인 ${asks.length}건`)
if (process.argv.includes('--pending')) {
  for (const [card, f] of pending) console.log(`  대기 ${card}.${f}`)
  for (const [card, f, why] of asks) console.log(`  확인 ${card}.${f} — ${why}`)
}
