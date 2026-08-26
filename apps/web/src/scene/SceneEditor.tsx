import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Html, TransformControls, useHelper } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { BoxHelper, type Object3D } from 'three'
import { setWallParams, useWallParams, WALL_LIMITS, type SceneProp, type WallParams } from './sceneProps'

/**
 * dev 전용 씬 편집기 (?edit=1) — 프로덕션 번들에 존재하지 않는다.
 * 선택: 좌측 목록 클릭(가림·크기 무관) 또는 씬에서 소품 클릭 · g=이동 / r=회전 · Esc=해제
 * 편집: ⌘Z 되돌리기 / ⇧⌘Z 다시 · ⌘D 복제 · Delete 삭제 · 90° 회전 버튼 · 좌표 직접 입력
 * 저장: 변경 즉시 /__scene-save가 sceneProps.tsx 마커 블록을 재작성(실패 시 클립보드 폴백).
 * vite 플러그인이 저장 직후 HMR을 억제하므로 화면이 새로고침되지 않는 것이 정상이다.
 */

const WALL_LABELS: Record<keyof WallParams, string> = {
  vestMargin: '현관 여유폭(편측)', vestDepth: '현관 깊이', wallH: '천장고', step: '타일 단차',
}

function serializeProps(list: SceneProp[]) {
  return 'export const SCENE_PROPS: SceneProp[] = ' + JSON.stringify(list, null, 2)
    .replace(/"([a-zA-Z]+)":/g, '$1:').replace(/"/g, "'")
}
function serializeWalls(wp: WallParams) {
  const r3 = (v: number) => Math.round(v * 1000) / 1000
  return `export const WALL_PARAMS = { vestMargin: ${r3(wp.vestMargin)}, vestDepth: ${r3(wp.vestDepth)}, wallH: ${r3(wp.wallH)}, step: ${r3(wp.step)} }`
}
const r3 = (v: number) => Math.round(v * 1000) / 1000

export default function SceneEditor({ props, setProps, selected, setSelected, doorW, openCorner = false }: {
  props: SceneProp[]
  setProps: (p: SceneProp[]) => void
  selected: string | null
  setSelected: (id: string | null) => void
  doorW: number
  openCorner?: boolean
}) {
  const scene = useThree((s) => s.scene)
  const [mode, setMode] = useState<'translate' | 'rotate'>('translate')
  const [status, setStatus] = useState('')
  const [histLen, setHistLen] = useState<[number, number]>([0, 0])
  const wp = useWallParams()
  const wallTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wallBaseline = useRef<WallParams | null>(null) // 슬라이더 드래그 세션당 히스토리 1회
  const dragStart = useRef<{ p: [number, number, number]; r: [number, number, number] } | null>(null)

  type Snapshot = { props: SceneProp[]; walls: WallParams }
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const syncHist = () => setHistLen([undoStack.current.length, redoStack.current.length])
  const pushHistory = (snap: Snapshot) => {
    undoStack.current.push(snap)
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
    syncHist()
  }

  const save = (body: { props?: string; walls?: string }, okMsg: string) => {
    fetch('/__scene-save', { method: 'POST', body: JSON.stringify(body) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); setStatus(okMsg) })
      .catch(() => {
        navigator.clipboard?.writeText(body.props ?? body.walls ?? '').catch(() => {})
        setStatus('저장 실패 — 클립보드에 복사됨')
      })
  }

  /** 소품 변경 단일 진입점 — 히스토리·저장이 항상 함께 간다 (FR5Web edit() 패턴) */
  const mutateProps = (next: SceneProp[], okMsg: string) => {
    pushHistory({ props, walls: wp })
    setProps(next)
    save({ props: serializeProps(next) }, okMsg)
  }

  const applySnapshot = (snap: Snapshot, okMsg: string) => {
    setProps(snap.props)
    setWallParams(snap.walls)
    setSelected(null)
    save({ props: serializeProps(snap.props), walls: serializeWalls(snap.walls) }, okMsg)
  }
  const undo = () => {
    const snap = undoStack.current.pop()
    if (!snap) { setStatus('되돌릴 것 없음'); return }
    redoStack.current.push({ props, walls: wp })
    syncHist()
    applySnapshot(snap, '되돌림·저장됨')
  }
  const redo = () => {
    const snap = redoStack.current.pop()
    if (!snap) return
    undoStack.current.push({ props, walls: wp })
    syncHist()
    applySnapshot(snap, '다시 적용·저장됨')
  }

  const removeSelected = () => {
    if (!selected) return
    mutateProps(props.filter((p) => p.id !== selected), `${selected} 삭제·저장됨`)
    setSelected(null)
  }

  const duplicateSelected = () => {
    const src = props.find((p) => p.id === selected)
    if (!src) return
    let n = 2, id = `${src.id}-2`
    while (props.some((p) => p.id === id)) id = `${src.id}-${++n}`
    const copy: SceneProp = { ...src, id, position: [r3(src.position[0] + 0.2), src.position[1], r3(src.position[2] + 0.2)] }
    mutateProps([...props, copy], `${id} 복제·저장됨`)
    setSelected(id)
  }

  const rotate90 = () => {
    const entry = props.find((p) => p.id === selected)
    if (!entry) return
    const [rx, ry, rz] = entry.rotation ?? [0, 0, 0]
    mutateProps(props.map((p) => p.id !== selected ? p : { ...p, rotation: [rx, r3(ry + Math.PI / 2), rz] }), `${selected} 90° 회전·저장됨`)
  }

  const setAxis = (axis: 0 | 1 | 2, v: number) => {
    const entry = props.find((p) => p.id === selected)
    if (!entry || Number.isNaN(v)) return
    const position = [...entry.position] as [number, number, number]
    position[axis] = r3(v)
    mutateProps(props.map((p) => p.id !== selected ? p : { ...p, position }), `${selected} 좌표 저장됨`)
  }

  // 단축키는 1회 등록 — 최신 클로저를 ref로 우회
  const fns = useRef({ undo, redo, removeSelected, duplicateSelected })
  fns.current = { undo, redo, removeSelected, duplicateSelected }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) fns.current.redo(); else fns.current.undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); fns.current.duplicateSelected() }
      if (e.key === 'Delete' || e.key === 'Backspace') fns.current.removeSelected()
      if (e.key === 'Escape') setSelected(null)
      if (e.key === 'g') setMode('translate')
      if (e.key === 'r') setMode('rotate')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSelected])

  const target: Object3D | undefined = selected ? scene.getObjectByName(`prop:${selected}`) : undefined
  const targetRef = useRef<Object3D | null>(null)
  targetRef.current = target ?? null
  useHelper(target ? (targetRef as unknown as React.RefObject<Object3D>) : false, BoxHelper, '#ffb020')

  const selEntry = props.find((p) => p.id === selected)

  const commit = () => {
    if (!target || !selected || !selEntry) return
    const dx = selEntry.anchor === 'doorL' ? -doorW / 2 : selEntry.anchor === 'doorR' ? doorW / 2 : 0
    const s = dragStart.current
    dragStart.current = null
    // 이동 문턱 — 클릭만 하고 놓으면 커밋하지 않아 undo 스택을 오염시키지 않는다 (FR5Web SLOP 패턴)
    if (s) {
      const dp = Math.hypot(target.position.x - s.p[0], target.position.y - s.p[1], target.position.z - s.p[2])
      const dr = Math.abs(target.rotation.x - s.r[0]) + Math.abs(target.rotation.y - s.r[1]) + Math.abs(target.rotation.z - s.r[2])
      if (dp < 0.005 && dr < 0.005) return
    }
    const position = [r3(target.position.x - dx), r3(target.position.y), r3(target.position.z)] as [number, number, number]
    const rotation = [r3(target.rotation.x), r3(target.rotation.y), r3(target.rotation.z)] as [number, number, number]
    mutateProps(props.map((p) => p.id !== selected ? p : openCorner
      ? { ...p, modes: { ...p.modes, openCorner: { ...p.modes?.openCorner, position, rotation } } }
      : { ...p, position, rotation }), openCorner ? `${selected} ㄱ자 배치 저장됨` : `${selected} 저장됨`)
  }

  const onWall = (k: keyof WallParams, v: number) => {
    if (!wallBaseline.current) {
      wallBaseline.current = wp
      pushHistory({ props, walls: wp })
    }
    setWallParams({ [k]: v })
    clearTimeout(wallTimer.current)
    wallTimer.current = setTimeout(() => {
      wallBaseline.current = null
      save({ walls: serializeWalls({ ...wp, [k]: v }) }, '벽 파라미터 저장됨')
    }, 800)
  }

  const btn = (active: boolean, danger = false): CSSProperties => ({
    display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px', border: 'none',
    borderRadius: 4, cursor: 'pointer', fontSize: 12, lineHeight: 1.6,
    background: danger ? '#6e3a3a' : active ? '#3a6ea5' : '#333', color: active || danger ? '#fff' : '#ddd',
  })
  const chip = (active = false, danger = false): CSSProperties => ({ ...btn(active, danger), width: 'auto', display: 'inline-block' })

  return (
    <>
      {target && (
        <TransformControls object={target} mode={mode}
          translationSnap={0.01} rotationSnap={Math.PI / 180}
          onMouseDown={() => { if (target) dragStart.current = { p: [target.position.x, target.position.y, target.position.z], r: [target.rotation.x, target.rotation.y, target.rotation.z] } }}
          onMouseUp={commit} />
      )}
      <Html calculatePosition={() => [0, 0]} style={{ pointerEvents: 'none' }} zIndexRange={[100, 100]}>
        <div style={{
          pointerEvents: 'auto', position: 'fixed', left: 12, top: 76, width: 208,
          maxHeight: '78vh', overflowY: 'auto', background: 'rgba(20,22,26,0.92)', color: '#ddd',
          borderRadius: 10, padding: '10px 10px 12px', font: '12px/1.5 system-ui, sans-serif',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>씬 편집 (dev){openCorner ? ' — ㄱ자 모드 배치' : ''}</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button style={{ ...chip(), color: histLen[0] ? '#ddd' : '#666' }} onClick={undo}>↩ 되돌리기{histLen[0] ? ` ${histLen[0]}` : ''}</button>
            <button style={{ ...chip(), color: histLen[1] ? '#ddd' : '#666' }} onClick={redo}>↪ 다시{histLen[1] ? ` ${histLen[1]}` : ''}</button>
          </div>
          {props.map((p) => (
            <button key={p.id} style={{ ...btn(p.id === selected), background: p.id === selected ? '#3a6ea5' : 'transparent' }} onClick={() => setSelected(p.id)}>{p.id}</button>
          ))}
          {selected && selEntry && (
            <div style={{ margin: '8px 0', borderTop: '1px solid #444', paddingTop: 8 }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                <button style={chip(mode === 'translate')} onClick={() => setMode('translate')}>이동 g</button>
                <button style={chip(mode === 'rotate')} onClick={() => setMode('rotate')}>회전 r</button>
                <button style={chip()} onClick={rotate90}>90°</button>
                <button style={chip()} onClick={duplicateSelected}>복제 ⌘D</button>
                <button style={chip(false, true)} onClick={removeSelected}>삭제</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['x', 'y', 'z'] as const).map((ax, i) => (
                  <label key={`${selected}-${ax}`} style={{ flex: 1 }}>
                    {ax}
                    <input type="number" step={0.01} defaultValue={selEntry.position[i]}
                      style={{ width: '100%', background: '#222', color: '#ddd', border: '1px solid #444', borderRadius: 4, padding: '1px 4px' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== selEntry.position[i]) setAxis(i as 0 | 1 | 2, v) }} />
                  </label>
                ))}
              </div>
              {selEntry.anchor && <div style={{ color: '#987', marginTop: 4 }}>x는 {selEntry.anchor} 앵커 기준 오프셋</div>}
            </div>
          )}
          <div style={{ fontWeight: 700, margin: '10px 0 4px' }}>벽 (실측 범위 내)</div>
          {(Object.keys(WALL_LIMITS) as (keyof WallParams)[]).map((k) => (
            <label key={k} style={{ display: 'block', marginBottom: 6 }}>
              {WALL_LABELS[k]} <span style={{ color: '#9bc' }}>{(wp[k] * 1000).toFixed(0)}mm</span>
              <input type="range" style={{ width: '100%' }} min={WALL_LIMITS[k][0]} max={WALL_LIMITS[k][1]}
                step={0.005} value={wp[k]} onChange={(e) => onWall(k, Number(e.target.value))} />
            </label>
          ))}
          <div style={{ color: '#8c8', minHeight: 16 }}>{status}</div>
        </div>
      </Html>
    </>
  )
}
