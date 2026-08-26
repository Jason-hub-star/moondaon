---
name: 소품
description: 쇼룸 씬(Entryway) 소품·구조물 제작 절차 — A급(맨손 절차적)/B급(img2threejs 정밀) 결정 사다리, 검증된 렌더 하네스, 생성기 함정 회피, Entryway.tsx 이식 규칙. 트리거 — "소품 만들어", "씬에 ○○ 추가", "손잡이/식물/가구 모델", "현관 채워줘", "/소품".
---

# 소품 — 씬 소품 제작 파이프라인

2026-08-26 몬스테라 A/B 실측으로 확정된 절차다. 목적: 소품마다 도구를 다시 고민하지 않고, 등급 판정 → 제작 → 이식을 한 호흡에 끝낸다.

## 1. 등급 판정 (첫 번째로 성립하는 칸에서 멈춘다)

| 등급 | 조건 | 방법 | 실측 비용 |
|---|---|---|---|
| **X — 만들지 않음** | 파라메트릭 형상(문 본체처럼 치수가 변함) | 기존 `DoorModel` 방식 유지. 사진 복제는 고정 치수 1개만 나옴 | — |
| **A — 맨손 절차적** | 상자·원기둥 조합으로 충분 (신발장·방화문·거울·월패드·콘솔·액자), 또는 유리 너머 원경 소품 (신발·슬리퍼) | `Entryway.tsx` 스타일로 박스+재질 직접 작성 | 71줄·1.2k tri급, 몇 분 |
| **B — img2threejs 정밀** | 유기형·곡면·디테일이 있고 카메라 앞에서 잘 보임 (식물·손잡이·경첩·도어록) | 전역 `img2threejs` 스킬 + 아래 함정 회피 | 1.5k줄·12k tri급, A의 수십 배 |

레퍼런스 사진 기준: **물체 단독·무배경**이어야 결정 게이트(IoU) 통과 가능. 씬 사진이면 처음부터 "스타일화 근사 + request-input 마감"으로 계획하고 시각 판정을 스코어 권위로 삼는다.

## 2. B급 함정 3개 (전역 메모리 `img2threejs-traps`와 동일 — 요약)

1. **attachment가 있으면 형상이 endpoint 실린더로 대체된다** (빈 attachment도 발동). lathe/extrude 부품은 attachment를 빼고, strict가 attachment를 강제하는 프리미티브(cylinder·cone·capsule·tube·curve-sweep)·이름(stem·tube·branch…)을 피해 짓는다 (예: blade → lamina).
2. **재질 키는 `material`** (materialId 아님). 팔레트는 `colorVariation.palette` 배열 + 최상위 `baseColor` 필수 — 없으면 갈색 폴백. 평평한 마감은 solid albedo 경로(`referencePbr.targetThreshold`를 confidence보다 높게), 크롭 투영은 패턴 마감 전용.
3. **componentTree 전 항목이 메시로 렌더** — 조립 루트 컴포넌트 금지. 첫 부품을 parent 없이 둔다.

## 3. 렌더 하네스 (검증본 재사용)

`/private/tmp/...scratchpad/ab/harness/`가 원본. 새로 만들 때:

- 생성 TS → `typescript.transpileModule`(apps/web/node_modules/typescript)로 JS화
- `three.module.js` + **`three.core.js`**(분할 구조) + `jsm/{controls,environments,postprocessing,shaders}` 복사
- importmap: `{"three":"./three.module.js","three/examples/jsm/":"./jsm/"}`
- 텍스처 비동기 → **rAF 렌더 루프 필수** (단발 렌더는 검정), `pbr/` 추출물도 복사
- `python3 -m http.server`로 서빙, 크롬 `zoom` 캡처로 게이트 증거 수집

## 4. 이식 규칙 (SSOT: sceneProps.tsx)

- **소품 목록·위치·회전은 `scene/sceneProps.tsx`의 `SCENE_PROPS` 배열이 유일한 자리다.** 렌더러는 같은 파일 `RENDERERS`에 컴포넌트 하나로 추가하고, 배열에 엔트리 한 줄을 더한다. Entryway.tsx에 소품을 직접 넣지 않는다 (Entryway는 구조물 전용)
- 문폭 연동 소품은 `anchor: 'doorL' | 'doorR'`로 x 오프셋 표현. 현관 바닥 소품은 타일 단차 y=-0.045 동기
- **위치 조절은 dev 서버 `?edit=1`** — 소품 클릭 → 기즈모(g 이동/r 회전/Esc 해제) → 놓으면 갱신된 배열이 클립보드·콘솔로 나옴 → sceneProps.tsx에 붙여넣기가 저장. 편집기는 `import.meta.env.DEV` 분기라 프로덕션 번들에 코드가 존재하지 않는다(사용자 비노출 — 검증: dist grep 0건)
- 소품 재질은 sceneProps.tsx의 `pm()` 싱글턴에 합류 (중복 MeshStandardMaterial 생성 금지)
- **품질 토글 준수**: `quality === 'lite'`면 B급 대신 A급(또는 생략). 12k tri는 소품 1~2개까지만
- 문이 주인공 — 소품 채도·명도는 배경 팔레트(#f1eae0 계열) 안에서. 텍스처는 `public/textures/`에 추가
- 완료 게이트: 실렌더 스크린샷 확인 + 모바일(52vh 캔버스) 프레임 확인

## 다음

이식까지 끝나면 `vercel-deploy-verify`(ㄱ 배포)로 운영 반영을 확정하고, 씬 로드맵은 `docs/ref/SCENE-PLAN.md`에서 다음 물건을 집는다.
