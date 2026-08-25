import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { SlidingDoor3 } from './door/SlidingDoor3'
import { SLIM_3TRACK } from './door/types'
import { Entryway } from './scene/Entryway'
import { useConfig, sizeZone } from './configurator/store'
import {
  COLORS, GLASSES, PATTERNS, HANDLES,
  type ColorId, type GlassId, type PatternId, type HandleId,
} from './generated/cards'

const COLOR_GROUPS: { label: string; category: (typeof COLORS)[ColorId]['category'] }[] = [
  { label: '기본색상 (기본운영)', category: 'basic-op' },
  { label: '베이직색상 (주문제 시트)', category: 'basic-sheet' },
  { label: '우드색상 (주문제 시트)', category: 'wood-sheet' },
]

export default function App() {
  const { t, colorId, glassId, patternId, handleId, widthM, quality, set } = useConfig()
  const spec = { ...SLIM_3TRACK, width: widthM }
  const pattern = PATTERNS[patternId]
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#faf9f7', color: '#2b2926', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas shadows camera={{ position: [1.8, 1.5, 3.4], fov: 45 }}>
          <color attach="background" args={['#f4f1ec']} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2.5, 2.6, 3]} intensity={1.6} castShadow />
          <directionalLight position={[-2, 2.5, -2]} intensity={0.5} />
          <pointLight position={[0, 2.4, -1]} intensity={8} color="#fff4e0" />
          <Entryway doorW={spec.width} doorH={spec.height} />
          <SlidingDoor3 spec={spec} colorId={colorId} glassId={glassId}
            pattern={{ vLines: [...pattern.vLines], hLines: [...pattern.hLines], solidCells: pattern.solidCells.map((c) => [...c] as [number, number]) }}
            handleLengthM={HANDLES[handleId].lengthM} quality={quality} t={t} />
          <OrbitControls target={[0, 1.15, 0]} maxPolarAngle={Math.PI / 2} />
        </Canvas>
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13 }}>닫힘</span>
          <input type="range" min={0} max={1} step={0.01} value={t} aria-label="개폐"
            onChange={(e) => set({ t: Number(e.target.value) })} style={{ flex: 1, accentColor: '#c5a572' }} />
          <span style={{ fontSize: 13 }}>열림</span>
        </div>
      </div>
      <aside style={{ width: 300, padding: '20px 18px', borderLeft: '1px solid #e6e1d8', overflowY: 'auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px', letterSpacing: '0.06em' }}>문다온</h1>
        <p style={{ fontSize: 12, color: '#8a8478', margin: '0 0 18px' }}>초슬림 3연동 도어 · 1.9</p>
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
        <Section title={`치수 — ${Math.round(widthM * 1000)}mm · ${sizeZone(widthM)}`}>
          <input type="range" min={1.2} max={2.0} step={0.01} value={widthM} aria-label="가로 치수"
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
