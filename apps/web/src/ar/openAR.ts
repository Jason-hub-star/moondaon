import * as THREE from 'three'
import { detectInApp, escapeUrl, escapeHint, isIOSUA, type InAppKind } from './inAppBrowser'

/**
 * "실물 크기로 보기" — AR 내보내기 (수렴 결정 R2-07 + 완화책)
 * - iOS: USDZExporter → AR Quick Look. USDZ는 transmission 유리를 검정 처리하므로
 *   (three.js #21594) export 전에 opacity 근사 재질로 스왑한다. 애니메이션은 소실 —
 *   정적(닫힘) 모델로 기대 관리.
 * - 그 외: GLTFExporter → blob → model-viewer(WebXR/Scene Viewer) 오버레이.
 * 1 unit = 1m 규약 덕에 실물 스케일 그대로 나간다.
 *
 * 중문은 바닥에 놓는 가구가 아니라 **벽 개구부에 서는 물건**이라 세 겹의 처리가 붙는다:
 * ① 벽(vertical) 앵커 — 안 주면 바닥에 눕는다 ② 진입 전 정렬 가이드 — AR 세션 안에는
 * 우리 UI를 못 그리므로 들어가기 전이 유일한 기회다 ③ 인앱브라우저 차단 — 카톡 링크로 온
 * 손님은 AR이 아예 실행되지 않는다.
 */

const INK = '#f4f1ec'
const GOLD = '#c5a572'
const SCRIM = 'rgba(20,18,15,.94)'

export type ArSpec = { width: number; height: number }

export async function openAR(doorGroup: THREE.Object3D, spec: ArSpec) {
  // ① 인앱브라우저면 AR을 시작하지 않는다 — iOS 인앱(WKWebView)은 Quick Look을 실행하지
  //    못하면서 에러도 안 내고 USDZ를 깨진 글자로 보여준다. 그 화면을 손님에게 주는 것보다
  //    "사파리로 여세요" 한 장이 낫다.
  const inApp = detectInApp(navigator.userAgent)
  if (inApp) return showEscape(inApp)

  // ② 정렬 가이드를 먼저 띄우고, 그동안 export를 백그라운드로 굽는다 (읽는 시간이 곧 로딩 시간)
  const isIOS = isIOSUA(navigator.userAgent)
  // 가이드를 읽다 그냥 닫는 손님이 있으므로 여기서 rejection을 흡수한다(unhandled rejection 방지).
  // 실패는 null로 바꿔 "AR 시작"을 누른 순간에만 사용자에게 보인다.
  const baked = bake(doorGroup, isIOS).catch((e) => { console.error('[ar] export 실패', e); return null })
  showGuide(spec, isIOS, baked)
}

/** 유리 transmission → opacity 근사 스왑 (USDZ/GLB 공통 안전) + 포맷별 export */
async function bake(doorGroup: THREE.Object3D, isIOS: boolean): Promise<string> {
  const clone = doorGroup.clone(true)
  clone.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const m = mesh.material as THREE.MeshPhysicalMaterial
    if (m?.transmission > 0) {
      const swap = m.clone()
      swap.transmission = 0
      swap.transparent = true
      swap.opacity = Math.min(0.5, Math.max(0.2, 1 - (m.transmission ?? 0) * 0.75))
      mesh.material = swap
    }
  })
  const scene = new THREE.Scene()
  scene.add(clone)

  if (isIOS) {
    const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js')
    const buf = await new USDZExporter().parseAsync(scene, {
      // 벽 앵커. three의 기본값은 `horizontal`이라 옵션을 안 주면 중문이 **바닥에 눕는다**.
      // Object.assign이 얕은 병합이라 `ar`를 통째로 교체하므로 anchoring.type도 같이 준다.
      // 규약상 바운딩 박스의 뒷면(−Z)이 벽에 붙는다 — 씬 카메라가 +z에서 문을 보므로 문 정면이
      // +Z라 방향이 맞다. 실기기에서 문이 벽 속을 향하면 되돌릴 지점은 여기다.
      ar: { anchoring: { type: 'plane' }, planeAnchoring: { alignment: 'vertical' } },
      // Quick Look이 텍스처 repeat/offset을 뒤집어 해석하는 버그(Apple FB10036297·FB11442287)
      // 보정. 나무결 시트처럼 타일링하는 색상 카드가 어긋나 보이던 원인 후보다.
      quickLookCompatible: true,
    })
    return URL.createObjectURL(new Blob([buf], { type: 'model/vnd.usdz+zip' }))
  }

  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer
  return URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }))
}

/** 인앱브라우저 탈출 안내 — 자동 스킴을 쏘되, 막혔을 때를 대비해 화면은 남긴다 */
function showEscape(kind: InAppKind) {
  const auto = escapeUrl(kind, location.href)
  const overlay = scrim()
  overlay.innerHTML = `
    <div style="margin:auto;max-width:340px;padding:28px 24px;text-align:center;color:${INK};font:15px/1.7 system-ui">
      <div style="font-size:15px;font-weight:600;margin-bottom:10px">AR은 기본 브라우저에서 열립니다</div>
      <div style="opacity:.78;font-size:14px">지금 화면은 앱 안에 들어 있는 간이 브라우저라 카메라 AR을 실행할 수 없어요.
        ${auto ? '아래 버튼을 누르면 기본 브라우저로 넘어갑니다.' : escapeHint(kind)}</div>
      ${auto ? `<a id="ar-escape" href="${auto}" style="display:block;margin-top:18px;padding:12px;border-radius:10px;background:${GOLD};color:#2b2926;font-weight:600;text-decoration:none">기본 브라우저로 열기</a>
      <div style="margin-top:10px;font-size:12.5px;opacity:.6">넘어가지 않으면 ${escapeHint(kind)}</div>` : ''}
      <button id="ar-close" style="margin-top:14px;background:none;border:1px solid ${GOLD};color:${INK};border-radius:8px;padding:8px 18px;cursor:pointer">닫기</button>
    </div>`
  mount(overlay, () => {})
  // 자동 스킴은 비공식이라 언제든 막힐 수 있다. 실패해도 위 안내가 남아 있게 화면을 지우지 않는다.
  if (auto) location.href = auto
}

/**
 * AR 진입 전 정렬 가이드 (iOS·안드로이드 공통).
 * AR 세션에 들어가면 화면은 OS(Quick Look·Scene Viewer) 것이라 우리 UI가 개입할 수 없다.
 * "어디에 서서 무엇을 비추라"를 말할 수 있는 유일한 순간이 여기다.
 */
function showGuide(spec: ArSpec, isIOS: boolean, baked: Promise<string | null>) {
  const mm = (m: number) => `${Math.round(m * 1000).toLocaleString()}mm`
  const overlay = scrim()
  overlay.innerHTML = `
    <div style="margin:auto;max-width:360px;padding:26px 24px;color:${INK};font:15px/1.7 system-ui">
      <div style="font-weight:600;margin-bottom:4px">실물 크기로 보기</div>
      <div style="font-size:22px;letter-spacing:-.02em;color:${GOLD};margin-bottom:18px">폭 ${mm(spec.width)} × 높이 ${mm(spec.height)}</div>
      <ol style="margin:0;padding-left:20px;font-size:14px;opacity:.86">
        <li style="margin-bottom:8px">설치할 <b>문틀 정면 2m쯤</b>에 서세요.</li>
        <li style="margin-bottom:8px">벽이 화면에 차도록 잡고, 휴대폰을 <b>천천히 좌우로</b> 움직이세요. 벽을 인식하는 과정입니다.</li>
        <li>문이 벽에 붙으면 <b>손가락으로 끌어</b> 개구부에 맞추세요.</li>
      </ol>
      <div style="margin-top:14px;font-size:12.5px;opacity:.58">닫힌 상태로 보여집니다. 열리는 모습은 이 화면(3D)에서 확인해 주세요.</div>
      <button id="ar-go" style="width:100%;margin-top:20px;padding:13px;border:none;border-radius:10px;background:${GOLD};color:#2b2926;font:600 15px system-ui;cursor:pointer">AR 시작</button>
      <button id="ar-close" style="width:100%;margin-top:8px;background:none;border:1px solid rgba(197,165,114,.5);color:${INK};border-radius:10px;padding:10px;cursor:pointer">닫기</button>
    </div>`
  let url: string | null = null
  mount(overlay, () => { if (url) URL.revokeObjectURL(url) })

  const go = overlay.querySelector('#ar-go') as HTMLButtonElement
  go.addEventListener('click', async () => {
    go.disabled = true
    go.textContent = '모델 준비 중…'
    url = await baked
    if (!url) { go.textContent = '모델을 만들지 못했습니다 — 다시 시도해 주세요'; go.disabled = false; return }
    if (isIOS) return launchQuickLook(url, overlay)
    launchModelViewer(url, overlay)
  })
}

/** iOS — `<a rel="ar">` + 자식 <img>가 Quick Look 트리거 요건이다 */
function launchQuickLook(url: string, overlay: HTMLElement) {
  const a = document.createElement('a')
  a.rel = 'ar'
  a.href = url
  a.appendChild(document.createElement('img'))
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
    overlay.remove() // Quick Look에서 돌아오면 가이드가 아니라 쇼룸이 보여야 한다
  }, 30000)
}

/** 그 외 — model-viewer에 위임. ar-placement=wall이 Scene Viewer/WebXR의 벽 배치를 켠다 */
async function launchModelViewer(url: string, overlay: HTMLElement) {
  await import('@google/model-viewer')
  overlay.style.padding = '0' // 가이드용 완충 여백 — 전체화면 뷰어에선 뒤 화면이 띠로 새어 나온다
  overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;color:${INK};font:14px system-ui">
      <span>벽을 비춘 뒤 AR 버튼을 누르세요</span>
      <button id="ar-close" style="background:none;border:1px solid ${GOLD};color:${INK};border-radius:8px;padding:6px 14px;cursor:pointer">닫기</button>
    </div>
    <model-viewer src="${url}" ar ar-modes="webxr scene-viewer quick-look" ar-placement="wall" camera-controls
      style="flex:1;width:100%;background:#2b2926"></model-viewer>`
  overlay.querySelector('#ar-close')!.addEventListener('click', () => {
    overlay.remove()
    URL.revokeObjectURL(url)
  })
}

function scrim(): HTMLDivElement {
  const el = document.createElement('div')
  // padding으로 완충하지 않으면 작은 화면(SE급)에서 margin:auto 자식의 상단이 잘려 스크롤로도 못 본다
  el.style.cssText = `position:fixed;inset:0;background:${SCRIM};z-index:50;display:flex;flex-direction:column;overflow:auto;padding:12px 0`
  return el
}

/** 닫기 버튼을 현재 내용에 묶어 마운트 (내용이 바뀌면 각 화면이 다시 묶는다) */
function mount(overlay: HTMLElement, cleanup: () => void) {
  document.body.appendChild(overlay)
  overlay.querySelector('#ar-close')?.addEventListener('click', () => {
    overlay.remove()
    cleanup()
  })
}
