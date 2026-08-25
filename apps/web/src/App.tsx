import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { SlidingDoor3 } from './door/SlidingDoor3'
import { SLIM_3TRACK } from './door/types'
import { Entryway } from './scene/Entryway'
import { useConfig, PATTERNS, type PatternId } from './configurator/store'
import { FRAME_COLORS, GLASSES, type FrameColorId, type GlassId } from './door/materials'

export default function App() {
  const { t, frameColor, glassId, patternId, quality, set } = useConfig()
  const spec = SLIM_3TRACK
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#faf9f7', color: '#2b2926', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas shadows camera={{ position: [1.8, 1.5, 3.4], fov: 45 }}>
          <color attach="background" args={['#f4f1ec']} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[2.5, 2.6, 3]} intensity={1.6} castShadow />\n          <pointLight position={[0, 2.4, -1]} intensity={8} color="#fff4e0" />
          <directionalLight position={[-2, 2.5, -2]} intensity={0.5} />
          <Entryway doorW={spec.width} doorH={spec.height} />
          <SlidingDoor3 spec={spec} frameColor={frameColor} glassId={glassId}
            pattern={PATTERNS[patternId].grid} quality={quality} t={t} />
          <OrbitControls target={[0, 1.15, 0]} maxPolarAngle={Math.PI / 2} />
        </Canvas>
        <div style={{ position: 'absolute', left: 24, right: 24, bottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13 }}>닫힘</span>
          <input type="range" min={0} max={1} step={0.01} value={t} aria-label="개폐"
            onChange={(e) => set({ t: Number(e.target.value) })} style={{ flex: 1, accentColor: '#c5a572' }} />
          <span style={{ fontSize: 13 }}>열림</span>
        </div>
      </div>
      <aside style={{ width: 280, padding: '20px 18px', borderLeft: '1px solid #e6e1d8', overflowY: 'auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px', letterSpacing: '0.06em' }}>문다온</h1>
        <p style={{ fontSize: 12, color: '#8a8478', margin: '0 0 20px' }}>초슬림 3연동 도어 · 1.9</p>
        <Section title="색상">
          {(Object.keys(FRAME_COLORS) as FrameColorId[]).map((id) => (
            <button key={id} onClick={() => set({ frameColor: id })} title={FRAME_COLORS[id].name}
              style={{ width: 34, height: 34, borderRadius: '50%', background: FRAME_COLORS[id].hex, cursor: 'pointer',
                border: frameColor === id ? '2px solid #c5a572' : '1px solid #d9d4ca' }} />
          ))}
        </Section>
        <Section title="유리">
          {(Object.keys(GLASSES) as GlassId[]).map((id) => (
            <Chip key={id} active={glassId === id} onClick={() => set({ glassId: id })}>{GLASSES[id].name}</Chip>
          ))}
        </Section>
        <Section title="디자인">
          {(Object.keys(PATTERNS) as PatternId[]).map((id) => (
            <Chip key={id} active={patternId === id} onClick={() => set({ patternId: id })}>{PATTERNS[id].name}</Chip>
          ))}
        </Section>
        <Section title="품질">
          <Chip active={quality === 'high'} onClick={() => set({ quality: 'high' })}>고급 유리</Chip>
          <Chip active={quality === 'lite'} onClick={() => set({ quality: 'lite' })}>간단</Chip>
        </Section>
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, color: '#8a8478', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 16, cursor: 'pointer',
      border: active ? '1.5px solid #c5a572' : '1px solid #d9d4ca',
      background: active ? '#f6efe3' : '#fff', color: '#2b2926' }}>{children}</button>
  )
}
