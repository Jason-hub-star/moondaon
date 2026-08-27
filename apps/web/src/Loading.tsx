import { useEffect, useState } from 'react'
import * as THREE from 'three'

/**
 * 감사 D4 — 첫 방문 시 4~6초간 캔버스가 완전 백지였다.
 *
 * 백지 구간은 두 토막이다: ① 번들(1.1MB) 내려받고 파싱하는 동안 — 여긴 React가 아직 없으므로
 * `index.html`의 `#boot`가 덮는다 ② React는 떴는데 텍스처가 아직인 동안 — 여길 이 오버레이가 덮는다.
 * 둘의 생김새를 같게 맞춰 교대가 안 보이게 한다.
 */

/** 부팅 화면 팔레트 — index.html의 #boot 인라인 스타일과 **같은 값**을 쓴다 */
const BG = '#f4f1ec'
const INK = '#2b2926'
const ACCENT = '#c5a572'

/**
 * 씬 준비 상태. 텍스처는 `TextureLoader`로 명령형 로드라 Suspense가 못 잡는다 —
 * three의 `DefaultLoadingManager`가 그 로더들의 공통 집계기라 여기서 진행률을 받는다.
 */
export function useSceneReady() {
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    // React가 실제로 그려진 뒤 #boot를 걷는다. 여기(항상 도는 훅)에 두어야 텍스처가
    // 캐시돼 로딩 오버레이가 아예 안 뜨는 재방문에서도 부팅 화면이 남지 않는다
    document.getElementById('boot')?.remove()
    const m = THREE.DefaultLoadingManager
    const done = () => { setProgress(1); setReady(true) }
    m.onProgress = (_url, loaded, total) => setProgress(total ? loaded / total : 0)
    m.onLoad = done
    m.onError = done // 텍스처 하나가 죽어도 화면은 열어준다
    // 안전판: 로드가 하나도 없거나(단색 구성) 이벤트를 놓치면 로딩 화면에 갇힌다.
    // 갇히는 건 백지보다 나쁘므로 반드시 연다
    const t = setTimeout(done, 8000)
    return () => {
      clearTimeout(t)
      m.onProgress = () => {}
      m.onLoad = () => {}
      m.onError = () => {}
    }
  }, [])
  return { ready, progress }
}

/** 캔버스 위 로딩 덮개 — 번들은 떴는데 텍스처가 아직인 구간을 덮는다 */
export function SceneLoading({ progress }: { progress: number }) {
  return (
    <div aria-live="polite" style={{
      position: 'absolute', inset: 0, zIndex: 5, background: BG,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, color: INK, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' }}>문다온</div>
      <div style={{ fontSize: 13, opacity: 0.6 }}>3D 쇼룸 준비 중…</div>
      <div style={{ width: 148, height: 3, borderRadius: 2, background: '#e6e1d8', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.round(Math.max(0.08, progress) * 100)}%`, height: '100%',
          background: ACCENT, transition: 'width .25s ease',
        }} />
      </div>
    </div>
  )
}
