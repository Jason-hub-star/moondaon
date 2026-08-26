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

const ids = (k) => out[k].map((c) => `'${c.id}'`).join(' | ')
const ts = `// 자동 생성 — 편집 금지. 정본은 data/cards/*.md (scripts/build-cards.mjs)
export type ColorId = ${ids('colors')}
export type GlassId = ${ids('glasses')}
export type PatternId = ${ids('patterns')}
export type HandleId = ${ids('handles')}
export type ProductId = ${ids('products')}
${Object.entries(out).map(([k, v]) => `export const ${k.toUpperCase()} = ${JSON.stringify(Object.fromEntries(v.map((c) => [c.id, c])), null, 1)} as const`).join('\n')}
`
mkdirSync(join(root, 'apps/web/src/generated'), { recursive: true })
writeFileSync(join(root, 'apps/web/src/generated/cards.ts'), ts)
console.log(`OK: ${Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', ')}`)
