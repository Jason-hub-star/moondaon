import { useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import type { Group } from 'three'
import { CaptureRig } from './capture/CaptureRig'
import { useCapture, buildPrompt, CAPTURE_MS, type CameraPath } from './capture/capture'
import { openAR } from './ar/openAR'
import { OrbitControls } from '@react-three/drei'
import { DoorModel, specFrom } from './door/DoorModel'
import { Entryway } from './scene/Entryway'
import { useConfig, sizeZone } from './configurator/store'
import { GlassChip, HandleChip, PatternChip, ProductChip } from './configurator/PatternChip'
import {
  COLORS, GLASSES, PATTERNS, HANDLES, PRODUCTS,
  type ColorId, type GlassId, type PatternId, type HandleId, type ProductId,
} from './generated/cards'

/** P1~P2 노출 제품 (이후 페이즈에서 카드 phase로 자동 확장) */
const VISIBLE_PHASES = ['P1', 'P2', 'P3', 'P4', 'P5']

const COLOR_GROUPS: { label: string; category: (typeof COLORS)[ColorId]['category'] }[] = [
  { label: '기본색상 (기본운영)', category: 'basic-op' },
  { label: '베이직색상 (주문제 시트)', category: 'basic-sheet' },
  { label: '우드색상 (주문제 시트)', category: 'wood-sheet' },
  { label: '커스텀 마블 (주문제 시트)', category: 'marble-sheet' },
  { label: 'ABS 도어 컬러', category: 'abs' },
]

export default function App() {
  const { t, productId, colorId, glassId, patternId, handleId, widthM, quality, panelPatterns, set } = useConfig()
  const spec = specFrom(productId, widthM)
  const [wMin, wMax] = PRODUCTS[productId].widthRangeM
  const wallW = PRODUCTS[productId].motion === 'sliding_multi_panel_corner' ? (spec.width * 2) / 3 : spec.width
  const isAbs = PRODUCTS[productId].motion === 'abs_hinged'
  const isArch = productId === 'custom-arch'
  const colorGroups = COLOR_GROUPS.filter((g) => (isAbs ? g.category === 'abs' : g.category !== 'abs'))
  const motion = PRODUCTS[productId].motion
  const metaOf = (id: PatternId) => PATTERNS[id] as { archProfile?: number; spandrel?: string; motions?: readonly string[] }
  const patternIds = (Object.keys(PATTERNS) as PatternId[]).filter((id) => {
    const m = metaOf(id)
    if (m.motions && !m.motions.includes(motion)) return false
    if (isArch) return m.archProfile != null || id === 'open'
    return m.archProfile == null || m.spandrel != null // 통아치 문짝은 커스텀아치 전용
  })
  const fixedIdxs = (PRODUCTS[productId] as { fixedPanels?: readonly number[] }).fixedPanels ?? []
  // 자동재생 — 자동중문 감속(ease-out) 연출 (R2-06: 모션만)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)
  const doorRef = useRef<Group>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const capActive = useCapture((s) => s.active)
  const [compare, setCompare] = useState(false)
  const [capMenu, setCapMenu] = useState(false)
  const [capDone, setCapDone] = useState<{ url: string; prompt: string; base: string } | null>(null)
  const record = async (path: CameraPath) => {
    const canvas = canvasRef.current
    if (!canvas || capActive) return
    // 근본수정: MediaRecorder(webm) 제거 — WebCodecs+mp4-muxer로 항상 진짜 mp4 배출
    if (typeof VideoEncoder === 'undefined') {
      alert('이 브라우저는 mp4 캡처(WebCodecs)를 지원하지 않습니다. 크롬/엣지/사파리 최신 버전을 사용하세요.')
      return
    }
    setCapMenu(false); setPlaying(false)
    const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
    const w = canvas.width - (canvas.width % 2) // H.264 짝수 해상도 요구
    const h = canvas.height - (canvas.height % 2)
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' })
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => console.error('[capture] encoder', e),
    })
    const cfg = { codec: 'avc1.640033', width: w, height: h, bitrate: 8_000_000, framerate: 30 } as VideoEncoderConfig
    const sup = await VideoEncoder.isConfigSupported(cfg)
    console.log('[capture] config supported:', sup.supported, w, 'x', h)
    encoder.configure(cfg)
    const FRAME_US = 1_000_000 / 30
    let frame = 0
    let stopped = false
    const grab = () => {
      if (stopped) return
      try {
        if (encoder.encodeQueueSize < 8) { // 백프레셔 — 큐 폭주 시 프레임 스킵
          const vf = new VideoFrame(canvas, { timestamp: Math.round(frame * FRAME_US), duration: Math.round(FRAME_US) })
          encoder.encode(vf, { keyFrame: frame % 60 === 0 })
          vf.close()
          frame++
        }
      } catch (e) {
        console.error('[capture] grab failed at frame', frame, e)
        stopped = true
        return
      }
      setTimeout(grab, 1000 / 30)
    }
    useCapture.getState().begin(path)
    grab()
    setTimeout(async () => {
      stopped = true
      useCapture.getState().end()
      await encoder.flush()
      muxer.finalize()
      const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' })
      console.log('[capture] frames', frame, 'bytes', blob.size)
      const st = useConfig.getState()
      setCapDone({ url: URL.createObjectURL(blob), prompt: buildPrompt(st, path), base: `moondaon_${st.productId}_${path}` })
    }, CAPTURE_MS + 100)
  }
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
        <Canvas shadows camera={{ position: [1.8, 1.5, 3.4], fov: 45 }}
          gl={{ preserveDrawingBuffer: true }}
          onCreated={({ gl }) => { canvasRef.current = gl.domElement }}>
          <color attach="background" args={['#f4f1ec']} />
          <ambientLight intensity={0.55} color="#fff1e0" />
          <directionalLight position={[2.5, 2.6, 3]} intensity={1.35} color="#fff3e4" castShadow />
          <directionalLight position={[-2, 2.5, -2]} intensity={0.4} color="#e9edf7" />
          <pointLight position={[0, 2.4, -1]} intensity={8} color="#fff4e0" />
          {/* 다운라이트·코브 액센트 (Entryway v2 웜 무드) */}
          <pointLight position={[-1.1, 2.45, 1.6]} intensity={3.5} distance={4.5} color="#ffe6bd" />
          <pointLight position={[1.1, 2.45, 1.6]} intensity={3.5} distance={4.5} color="#ffe6bd" />
          <pointLight position={[-2.2, 2.4, 1.2]} intensity={2.5} distance={3.5} color="#ffd9a0" />
          <Entryway doorW={wallW} doorH={spec.height} />
          <group ref={doorRef}>
          <DoorModel productId={productId} widthM={widthM} colorId={colorId} glassId={glassId}
            patternId={patternId} panelPatternIds={panelPatterns ?? undefined}
            handleLengthM={HANDLES[handleId].lengthM} quality={quality} t={t} />
          </group>
          <CaptureRig />
          <OrbitControls target={[0, 1.15, 0]} maxPolarAngle={Math.PI / 2} enabled={!capActive} />
        </Canvas>
        <div style={{ position: 'absolute', top: 16, left: 24, display: 'flex', gap: 8 }}>
          <TopBtn onClick={() => { if (doorRef.current) openAR(doorRef.current) }}>실물 크기로 보기 (AR)</TopBtn>
          <TopBtn onClick={() => { setCompare((c) => !c); if (!compare) useCapture.getState().firePreset() }}>
            {compare ? '커스텀으로 돌아가기' : '제작사례와 비교'}</TopBtn>
          <div style={{ position: 'relative' }}>
            <TopBtn onClick={() => setCapMenu((m) => !m)}>{capActive ? '● 녹화 중…' : '캡처 (영상AI 레퍼런스)'}</TopBtn>
            {capMenu && !capActive && (
              <div style={{ position: 'absolute', top: 40, left: 0, background: '#fff', border: '1px solid #e6e1d8',
                borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
                {(['front', 'orbit', 'walk'] as CameraPath[]).map((p) => (
                  <Chip key={p} active={false} onClick={() => record(p)}>
                    {{ front: '정면 고정', orbit: '궤도 회전', walk: '워크스루' }[p]}</Chip>
                ))}
              </div>
            )}
          </div>
        </div>
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
      {capDone && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,18,15,.55)', zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#faf9f7', borderRadius: 14, padding: 22, width: 560, maxWidth: '92vw' }}>
            <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>캡처 완료 — 영상AI 레퍼런스 페어</h2>
            <video src={capDone.url} controls style={{ width: '100%', borderRadius: 8, background: '#000' }} />
            <pre style={{ fontSize: 11, background: '#f1ede6', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap',
              maxHeight: 150, overflowY: 'auto' }}>{capDone.prompt}</pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Chip active={false} onClick={() => {
                const a = document.createElement('a'); a.href = capDone.url; a.download = `${capDone.base}.mp4`; a.click()
              }}>영상 저장 (.mp4)</Chip>
              <Chip active={false} onClick={() => navigator.clipboard.writeText(capDone.prompt)}>프롬프트 복사</Chip>
              <Chip active onClick={() => { URL.revokeObjectURL(capDone.url); setCapDone(null) }}>닫기</Chip>
            </div>
          </div>
        </div>
      )}
      {compare ? (
        <aside style={{ width: 380, padding: '20px 18px', borderLeft: '1px solid #e6e1d8', overflowY: 'auto' }}>
          <h1 style={{ fontSize: 16, margin: '0 0 6px' }}>제작사례 (리플렛 실사진)</h1>
          <p style={{ fontSize: 12, color: '#8a8478', margin: '0 0 12px' }}>
            왼쪽 3D를 같은 앵글(정면)에 두고 색·패턴을 맞춰보세요. 이 비교가 신규 패턴 등록의 검수 도구입니다 (R1-09).</p>
          <img src="/cases/cases-3track.jpg" alt="3연동 제작사례" style={{ width: '100%', borderRadius: 8, marginBottom: 12 }} />
          <img src="/cases/cases-louver.jpg" alt="간살 제작사례" style={{ width: '100%', borderRadius: 8 }} />
        </aside>
      ) : (
      <aside style={{ width: 300, padding: '20px 18px', borderLeft: '1px solid #e6e1d8', overflowY: 'auto' }}>
        <h1 style={{ fontSize: 18, margin: '0 0 4px', letterSpacing: '0.06em' }}>문다온</h1>
        <p style={{ fontSize: 12, color: '#8a8478', margin: '0 0 14px' }}>{PRODUCTS[productId].name}</p>
        <Section title="제품">
          {(Object.keys(PRODUCTS) as ProductId[]).filter((id) => VISIBLE_PHASES.includes(PRODUCTS[id].phase)).map((id) => (
            <ProductChip key={id} id={id} active={productId === id} onClick={() => {
              const abs = PRODUCTS[id].motion === 'abs_hinged'
              const arch = id === 'custom-arch'
              const patch: Parameters<typeof set>[0] = { productId: id }
              if (abs !== (COLORS[colorId].category === 'abs')) patch.colorId = abs ? 'abs-white' : 'white'
              const cur = PATTERNS[patternId] as { archProfile?: number; spandrel?: string; motions?: readonly string[] }
              if (arch && cur.archProfile == null) patch.patternId = 'arch3'
              if (!arch && cur.archProfile != null && cur.spandrel == null) patch.patternId = 'open'
              if (cur.motions && !cur.motions.includes(PRODUCTS[id].motion)) patch.patternId = 'open'
              patch.panelPatterns = undefined
              set(patch)
            }} />
          ))}
        </Section>
        {colorGroups.map(({ label, category }) => (
          <Section key={category} title={label}>
            {(Object.keys(COLORS) as ColorId[]).filter((id) => COLORS[id].category === category).map((id) => (
              <button key={id} onClick={() => set({ colorId: id })} title={COLORS[id].name}
                style={{ width: 30, height: 30, borderRadius: '50%', background: COLORS[id].hex, cursor: 'pointer',
                  border: colorId === id ? '2px solid #c5a572' : '1px solid #d9d4ca' }} />
            ))}
          </Section>
        ))}
        {!isAbs && (
          <Section title="적용 유리 (5mm)">
            {(Object.keys(GLASSES) as GlassId[]).map((id) => (
              <GlassChip key={id} id={id} active={glassId === id} onClick={() => set({ glassId: id })} />
            ))}
          </Section>
        )}
        {!isAbs && (
          <Section title="디자인 / 디바이딩">
            {patternIds.map((id) => (
              <PatternChip key={id} id={id} active={patternId === id} onClick={() => set({ patternId: id })} />
            ))}
          </Section>
        )}
        {!isAbs && fixedIdxs.length > 0 && (
          <Section title="픽스창 패턴 (고정 패널)">
            {patternIds.map((id) => (
              <PatternChip key={id} id={id} active={(panelPatterns?.[fixedIdxs[0]] ?? patternId) === id} onClick={() => {
                const arr: (PatternId | null)[] = Array.from({ length: PRODUCTS[productId].panels }, (_, i) => panelPatterns?.[i] ?? null)
                for (const fi of fixedIdxs) arr[fi] = id
                set({ panelPatterns: arr })
              }} />
            ))}
          </Section>
        )}
        <Section title="손잡이">
          {(Object.keys(HANDLES) as HandleId[]).map((id) => (
            <HandleChip key={id} id={id} active={handleId === id} onClick={() => set({ handleId: id })} />
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
      )}
    </div>
  )
}

function TopBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 14px', fontSize: 13, borderRadius: 18, cursor: 'pointer',
      border: '1px solid #c5a572', background: 'rgba(255,255,255,.88)', color: '#2b2926' }}>{children}</button>
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
