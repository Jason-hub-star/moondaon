# ARCHITECTURE — 문다온 3D 쇼룸

## 스택
Vite + React + TypeScript + react-three-fiber(@react-three/fiber, drei) · 정적 배포(Vercel) · 서버 없음

## 데이터 흐름 (SSOT)
```
data/cards/*.md (frontmatter: 제품·색상·유리·패턴·손잡이)
  → scripts/build-cards.mjs (gray-matter + Zod 검증)
  → apps/web/src/generated/*.ts (gitignore, 빌드 산출물)
  → r3f 파라메트릭 빌더 (문틀/문짝/유리/간살 지오메트리 생성)
```
원자료: `assets/리플렛자료/` (HEIC 5장 + 리플렛_텍스트_정리.json — 카드의 출처, 런타임 미사용)

## 핵심 모듈 (apps/web/src/)
- `door/builder/` — 파라메트릭 지오메트리(프레임 압출·유리 패널·분할 그리드 셀·손잡이)
- `door/motion/` — 개폐모델 7종 훅. 자유도 1 파라미터 t(0~1) → 패널 위치/회전. 3연동=연동비율, 스윙=힌지 회전, 자동=ease-out
- `door/materials/` — 유리 10종 PBR 매핑표(MeshPhysicalMaterial transmission), 랩핑/도장/아노다이징
- `scene/` — 현관 목업(벽·바닥·조명·HDRI), 벽·바닥 마감 변경
- `configurator/` — 5축 커스텀 상태(zustand) ↔ URL 해시(base64url JSON)
- `capture/` — MediaRecorder canvas.captureStream 1080p30, 카메라 패스, video_prompt_template 페어 출력
- `ar/` — USDZExporter(유리 transmission→opacity 스왑) + GLTFExporter→blob→model-viewer

## 리스크와 완화 (조사 근거)
| 리스크 | 완화 |
|---|---|
| USDZ가 transmission 유리를 검정 처리 (three.js #21594) | export 전 재질 복제→opacity 근사로 스왑 |
| transmission 모바일 성능 | 품질 토글: 고품질 transmission ↔ 저사양 alpha·저해상 roughness |
| 아치 프로파일 실측치 없음 | 베지어 근사 + 카드 `unconfirmed`, 실측 들어오면 교체 |
| 패턴↔실사진 정확도 | 카메라 프리셋 비교 뷰가 검수 도구 겸용 |
