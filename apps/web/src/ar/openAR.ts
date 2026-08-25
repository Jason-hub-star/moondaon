import * as THREE from 'three'

/**
 * "실물 크기로 보기" — AR 내보내기 (수렴 결정 R2-07 + 완화책)
 * - iOS: USDZExporter → AR Quick Look. USDZ는 transmission 유리를 검정 처리하므로
 *   (three.js #21594) export 전에 opacity 근사 재질로 스왑한다. 애니메이션은 소실 —
 *   정적(닫힘) 모델로 기대 관리.
 * - 그 외: GLTFExporter → blob → model-viewer(WebXR/Scene Viewer) 오버레이.
 * 1 unit = 1m 규약 덕에 실물 스케일 그대로 나간다.
 */
export async function openAR(doorGroup: THREE.Object3D) {
  const clone = doorGroup.clone(true)
  // 유리 transmission → opacity 근사 스왑 (USDZ/GLB 공통 안전)
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

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isIOS) {
    const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js')
    const buf = await new USDZExporter().parseAsync(scene)
    const url = URL.createObjectURL(new Blob([buf], { type: 'model/vnd.usdz+zip' }))
    const a = document.createElement('a')
    a.rel = 'ar'
    a.href = url
    a.appendChild(document.createElement('img')) // Quick Look 트리거 요건
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 30000)
    return
  }

  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer
  const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }))
  await import('@google/model-viewer')
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(20,18,15,.92);z-index:50;display:flex;flex-direction:column'
  overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;color:#f4f1ec;font:14px system-ui">
      <span>실물 크기로 보기 — AR 지원 기기에서 AR 버튼을 누르세요</span>
      <button id="ar-close" style="background:none;border:1px solid #c5a572;color:#f4f1ec;border-radius:8px;padding:6px 14px;cursor:pointer">닫기</button>
    </div>
    <model-viewer src="${url}" ar ar-modes="webxr scene-viewer quick-look" camera-controls
      style="flex:1;width:100%;background:#2b2926"></model-viewer>`
  document.body.appendChild(overlay)
  overlay.querySelector('#ar-close')!.addEventListener('click', () => {
    document.body.removeChild(overlay)
    URL.revokeObjectURL(url)
  })
}
