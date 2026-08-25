import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { DoorModel, specFrom } from './door/DoorModel'
import { Entryway } from './scene/Entryway'
import { useConfig, sizeZone } from './configurator/store'
import {
  COLORS, GLASSES, PATTERNS, HANDLES, PRODUCTS,
  type ColorId, type GlassId, type PatternId, type HandleId, type ProductId,
} from './generated/cards'

/** P1~P2 노출 제품 (이후 페이즈에서 카드 phase로 자동 확장) */
const VISIBLE_PHASES = ['P1', 'P2', 'P3', 'P4']

const COLOR_GROUPS: { label: string; category: (typeof COLORS)[ColorId]['category'] }[] = [
  { label: '기본색상 (기본운영)', category: 'basic-op' },
  { label: '베이직색상 (주문제 시트)', category: 'basic-sheet' },
  { label: '우드색상 (주문제 시트)', category: 'wood-sheet' },
]

export default function App() {
  const { t, productId, colorId, glassId, patternId, handleId, widthM, quality, set } = useConfig()
  const spec = specFrom(productId, widthM)
  const pattern = PATTERNS[patternId]
  const [wMin, wMax] = PRODUCTS[productId].widthRangeM
  const wallW = PRODUCTS[productId].motion === 'sliding_multi_panel_corner' ? (spec.width * 2) / 3 : spec.width
  // 자동재생 — 자동중문 감속(ease-out) 연출 (R2-06: 모션만)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  useEffect(() => {
    if (!playing) { cancelAnimationFrame(raf.current); return }
    const ease = (u: number) => 1 - Math.pow(1 - u, 3)
    const start = performance.now()
    const OPEN = 2200, HOLD = 900, CLOSE = 2200, CYCLE = OPEN + HOLD + CLOSE + HOLD
    const tick = (now: number) => {
      const e = (now - start) % CYCLE
      let v: number
      if (e < OPEN) v = ease(e / OPEN)
      else if (e < OPEN + HOLD) v = 1
      else if (e < OPEN + HOLD + CLOSE) v = 1 - ease((e - OPEN - HOLD) / CLOSE)
      else v = 0
      useConfig.setState({ t: v })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing])
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#faf9f7', color: '#2b2926', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas shadows camera={{ position: [1.8, 1.5, 3.4], fov: 45 }}>
          <color attach="background" args={['#f4f1ec']} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2.5, 2.6, 3]} intensity={1.6} castShadow />
          <directionalLight position={[-2, 2.5, -2]} intensity={0.5} />
          <pointLight position={[0, 2.4, -1]} intensity={8} color="#fff4e0" />
          <Entryway doorW={wallW} doorH={spec.height} />
          <DoorModel productId={productId} widthM={widthM} colorId={colorId} glassId={glassId}
            pattern={{ vLines: [...pattern.vLines], hLines: [...pattern.hLines], solidCells: pattern.solidCells.map((c) => [...c] as [number, number]) }}
            handleLengthM={HANDLES[handleId].lengthM} quality={quality} t={t} />
          <OrbitControls target={[0, 1.15, 0]} maxPolarAngle={Math.PI / 2} />
        </Canvas>
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13 }}>닫힘</span>
          <input type="range" min={0} max={1} step={0.01} value={t} aria-label="개폐"
            onChange={(e) => set({ t: Number(e.target.value) })} style={{ flex: 1, accentColor: '#c5a572' }} />
          <span style={{ fontSize: 13 }}>열림</span>
          <button onClick={() => setPlaying((p) => !p)} aria-label="자동재생"
            style={{ padding: '6px 12px', fontSize: 13, borderRadius: 16, cursor: 'pointer',
              border: '1px solid #c5a572', background: playing ? '#c5a572' : '#f6efe3', color: playing ? '#fff' : '#2b2926' }}>
            {playing ? '■ 정지' : '▶ 자동'}
          </button>
        </div>
      </div>
      <aside style={{ width: 300, padding: '20px 18px', borderLeft: '1px solid #e6e1d8', overflowY: 'auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px', letterSpacing: '0.06em' }}>문다온</h1>
        <p style={{ fontSize: 12, color: '#8a8478', margin: '0 0 14px' }}>{PRODUCTS[productId].name}</p>
        <Section title="제품">
          {(Object.keys(PRODUCTS) as ProductId[]).filter((id) => VISIBLE_PHASES.includes(PRODUCTS[id].phase)).map((id) => (
            <Chip key={id} active={productId === id} onClick={() => set({ productId: id })}>{PRODUCTS[id].name}</Chip>
          ))}
        </Section>
        {COLOR_GROUPS.map(({ label, category }) => (
          <Section key={category} title={label}>
            {(Object.keys(COLORS) as ColorId[]).filter((id) => COLORS[id].category === category).map((id) => (
              <button key={id} onClick={() => set({ colorId: id })} title={COLORS[id].name}
                style={{ width: 30, height: 30, borderRadius: '50%', background: COLORS[id].hex, cursor: 'pointer',
                  border: colorId === id ? '2px solid #c5a572' : '1px solid #d9d4ca' }} />
            ))}
          </Section>
        ))}
        <Section title="적용 유리 (5mm)">
          {(Object.keys(GLASSES) as GlassId[]).map((id) => (
            <Chip key={id} active={glassId === id} onClick={() => set({ glassId: id })}>{GLASSES[id].name}</Chip>
          ))}
        </Section>
        <Section title="디자인 / 디바이딩">
          {(Object.keys(PATTERNS) as PatternId[]).map((id) => (
            <Chip key={id} active={patternId === id} onClick={() => set({ patternId: id })}>{PATTERNS[id].name}</Chip>
          ))}
        </Section>
        <Section title="손잡이">
          {(Object.keys(HANDLES) as HandleId[]).map((id) => (
            <Chip key={id} active={handleId === id} onClick={() => set({ handleId: id })}>{HANDLES[id].name}</Chip>
          ))}
        </Section>
        <Section title={`치수 — ${Math.round(spec.width * 1000)}mm${PRODUCTS[productId].motion === 'sliding_multi_panel' ? ' · ' + sizeZone(spec.width) : ''}`}>
          <input type="range" min={wMin} max={wMax} step={0.01} value={Math.min(wMax, Math.max(wMin, widthM))} aria-label="가로 치수"
            onChange={(e) => set({ widthM: Number(e.target.value) })} style={{ width: '100%', accentColor: '#c5a572' }} />
        </Section>
        <Section title="품질">
          <Chip active={quality === 'high'} onClick={() => set({ quality: 'high' })}>고급 유리</Chip>
          <Chip active={quality === 'lite'} onClick={() => set({ quality: 'lite' })}>간단</Chip>
        </Section>
        <button onClick={() => { navigator.clipboard.writeText(location.href) }}
          style={{ width: '100%', marginTop: 6, padding: '10px 0', borderRadius: 8, border: '1px solid #c5a572',
            background: '#f6efe3', color: '#2b2926', fontSize: 13, cursor: 'pointer' }}>
          이 구성 공유 링크 복사
        </button>
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: '#8a8478', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 11px', fontSize: 12, borderRadius: 16, cursor: 'pointer',
      border: active ? '1.5px solid #c5a572' : '1px solid #d9d4ca',
      background: active ? '#f6efe3' : '#fff', color: '#2b2926' }}>{children}</button>
  )
}
