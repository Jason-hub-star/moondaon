import { useEffect, useMemo } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { Object3D } from 'three'
import type { SceneProp } from './sceneProps'

/**
 * dev 전용 소품 편집기 (?edit=1) — 이 모듈은 프로덕션 번들에 존재하지 않는다.
 * 조작: 소품 클릭=선택 · g=이동 / r=회전 · Esc=해제. 놓으면 갱신된 SCENE_PROPS 배열이
 * 콘솔+클립보드로 나온다 → sceneProps.tsx에 붙여넣는 것이 저장이다 (저장소는 git).
 */
export default function SceneEditor({ props, setProps, selected, setSelected, doorW }: {
  props: SceneProp[]
  setProps: (p: SceneProp[]) => void
  selected: string | null
  setSelected: (id: string | null) => void
  doorW: number
}) {
  const scene = useThree((s) => s.scene)
  const mode = useMemo(() => ({ current: 'translate' as 'translate' | 'rotate' }), [])

  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__SCENE_EDITOR__ = true
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
      if (e.key === 'g') mode.current = 'translate'
      if (e.key === 'r') mode.current = 'rotate'
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, setSelected])

  const target: Object3D | undefined = selected ? scene.getObjectByName(`prop:${selected}`) : undefined
  if (!target || !selected) return null

  const commit = () => {
    const entry = props.find((p) => p.id === selected)
    if (!entry) return
    const dx = entry.anchor === 'doorL' ? -doorW / 2 : entry.anchor === 'doorR' ? doorW / 2 : 0
    const r3 = (v: number) => Math.round(v * 1000) / 1000
    const next = props.map((p) => p.id !== selected ? p : {
      ...p,
      position: [r3(target.position.x - dx), r3(target.position.y), r3(target.position.z)] as [number, number, number],
      rotation: [r3(target.rotation.x), r3(target.rotation.y), r3(target.rotation.z)] as [number, number, number],
    })
    setProps(next)
    const code = 'export const SCENE_PROPS: SceneProp[] = ' + JSON.stringify(next, null, 2)
      .replace(/"([a-zA-Z]+)":/g, '$1:').replace(/"/g, "'")
    console.log('[scene-editor]\n' + code)
    navigator.clipboard?.writeText(code).catch(() => {})
  }

  return (
    <TransformControls object={target} mode={mode.current}
      translationSnap={0.01} rotationSnap={Math.PI / 180}
      onMouseUp={commit} />
  )
}
