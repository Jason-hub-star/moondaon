# GOAL-scene-cozy — 씬을 "쇼룸"에서 "사람 사는 아파트"로

## 골 한 줄

```
Entryway 씬의 모든 소품 원점이 기본 카메라 시선축 30° 안에 들고 거실·현관에 생활감 소품과 명암 대비가 생긴 상태 — verified by `cd apps/web && npm test`(frame.test 전건 green) + `npm run build` + `npm run lint` 무경고, while preserving 도어 개구부(x ±0.625) 무침범·소품 tri 30k 이하·도어 색상 12종 식별성. details in docs/goals/GOAL-scene-cozy.md
```

## 1. Outcome

완료 시 아래가 모두 참이다.

1. **프레임 게이트** — `SCENE_PROPS` 전 항목의 기본 카메라 이탈각 ≤ 30.0°. 착수 시점 FAIL 5건(floor-lamp 54.3° · console 46.5° · window 34.5° · mirror 34.4° · rug 33.7°)이 0건.
2. **카메라 SSOT** — 카메라 position·target·fov 리터럴이 `props.data.ts` 한 곳에만 존재. `App.tsx`에 좌표 하드코딩 0.
3. **제거 4건 반영** — 빈 단색 액자 2개 · 걸레받이 `#cbb499` · 월패드 개구부 인접 배치 · 거울, 넷 다 코드에서 사라지거나 대체됨.
4. **신설 소품 ≥ 6종** — 소파(짙은 값 앵커) · 바닥까지 커튼 · 담요/쿠션 · 신발 2~3켤레 · 벽 후크+코트 · 신발장 상부 소품.
5. **명암 대비** — `ambientLight.intensity` ≤ 0.35 이고, 짙은 값 재질(리니어 밝기 ≤ 0.25)이 최소 1개 프레임 안에 존재.

## 2. Verification surface

| # | 명령 | 기대 |
|---|---|---|
| V1 | `cd apps/web && npm test` | 전건 green. `frame.test.ts`가 소품별 이탈각을 출력하고 30° 초과 0건 |
| V2 | `cd apps/web && npm run build` | `tsc -b` 타입 에러 0 + vite build 성공 |
| V3 | `cd apps/web && npm run lint` | oxlint **error 0** · warning ≤ 13 (P-E1 착수 시점 기존치 — 신규 경고 0의 뜻) |
| V4 | `grep -c "1.8, 1.5, 3.4" apps/web/src/App.tsx` | `0` (카메라 하드코딩 제거 확인) |
| V5 | `grep -rn "#cbb499\|'mirror'" apps/web/src/scene/` | 매치 0 (제거 4건 중 코드 잔존 확인분) |

**아티팩트**: `docs/ref/SCENE-PLAN.md` P-E 표의 각 phase가 `완료`로 갱신 + 실행 기록 1줄.

**자동 증거가 못 덮는 것(의도적)** — "포근해 보이는가", "문이 여전히 주인공인가"는 정성 판정이라 골 **밖**에 둔다. 각 phase 끝 실렌더 스크린샷을 주인님께 제시하고 승인받는다. 골의 완료 판정에는 쓰지 않는다.

## 3. Constraints (후퇴 금지)

- **문이 주인공** — 신설 소품이 개구부(`x ∈ [-doorW/2, +doorW/2]`, 기본 ±0.625)를 지오메트리로 침범하지 않는다.
- **현관 저대비 유지** — 신발장·방화문 흰색 도장(2026-08-27 주인님 피드백)은 되돌리지 않는다. 짙은 값 앵커는 **거실 쪽**에만 둔다.
- **성능** — 소품 합계 tri 30k 이하(P-D 계약). `quality: 'lite'` 경로 회귀 없음.
- **제품 식별성 > 무드** — 어두워진 뒤에도 도어 색상 12종·유리 종류가 UI에서 고른 대로 구별돼야 한다. 무드를 위해 식별성을 깎지 않는다.
- **기존 스위트 green 유지** — `shareSchema.test.ts` 포함 전건.
- **dev 전용 코드는 dev 전용으로** — `?edit=1` 편집기·`scene-save` 미들웨어가 프로덕션 번들에 들어가지 않는다.

## 4. Boundaries

- **허용**: `apps/web/src/scene/**` · `apps/web/src/App.tsx`(조명·카메라 import만) · `apps/web/vite.config.ts`(scene-save 경로) · `apps/web/public/textures/**`(신규 텍스처) · `docs/ref/SCENE-PLAN.md` · `docs/status/PROJECT-STATUS.md`
- **금지**: `apps/web/src/door/**`(도어 본체·재질) · `apps/web/src/configurator/**` · `api/**` · `scripts/build-cards.mjs` · `data/**` 카드 정의
- 새 npm 의존성 추가 금지 — three/drei 기본 기능과 절차적 지오메트리로 해결한다.

## 5. Iteration policy

- 각 패스: V1~V5 전체 실행 → 실패 항목만 우선순위화(V1 > V2 > V3 > V4/V5) → 최소 변경으로 재시도.
- phase 단위 진행(`페이즈루프` 결합, P-E1~P-E6). phase 게이트 FAIL이면 그 phase 안에서 fix → 재검증. **FAIL인 채 다음 phase 진입 금지.**
- 좌표 조정은 추측하지 않는다 — 이탈각은 `frame.test`로 손계산 대신 측정하고, 배치는 `?edit=1` 기즈모 또는 계산값으로 정한다.
- 같은 phase에서 **무진전 3패스**면 blocked 판정.

## 6. Blocked stop condition

- 이탈각 ≤30°와 "문이 주인공"이 물리적으로 양립 불가한 소품이 나오면(예: 소파를 30° 안에 넣으면 반드시 개구부를 가림) → 멈추고 보고. 게이트 수치를 임의로 완화하지 않는다.
- 짙은 값 앵커 추가가 도어 색상 식별성을 깎는 게 실렌더에서 확인되면 → 멈추고 보고.
- 텍스처 등 외부 애셋(CC0)이 필요한데 확보 불가 → 절차적 근사로 대체하고 그 사실을 기록. 대체도 불가하면 blocked.
- 보고 형식: **재현됨 / 근사됨 / 막힘 / 불확실** 4분류.

## 7. 실행 기록 (실행 에이전트가 기록)

- 2026-08-27 Claude Code — 골 작성. 착수 전 측정: 이탈각 FAIL 5건, `ambientLight` 0.55, 프레임 내 최암부 = 몬스테라 잎.
- 2026-08-27 Claude Code — 패스 1 (페이즈루프 P-E1~E6, 전 phase PASS). **Outcome 5개 전부 참**:
  ① 이탈각 FAIL 0건(+세로 19° 조건 추가로 조임) ② 카메라 SSOT — `App.tsx` 하드코딩 0
  ③ 제거 4건 반영(액자는 승격, 월패드는 스위치 동반으로 대체 — 이탈 2건 SCENE-PLAN에 기록)
  ④ 신설 8종(소파·커튼·담요·쿠션·신발2켤레·코트후크·스위치·액자포스터) ⑤ `ambientLight` 0.32, 짙은 값 앵커 = 소파(`#6b6259`, 리니어 휘도 0.126) + 액자 프레임(`#4a3f34`)
  검증: V1 `npm test` 14/14 · V2 build 타입에러 0 · V3 oxlint error 0/warning 13(기준치 동일) · V4 grep 0 · V5 코드 잔존 0(주석 1건만)
  Constraints: 개구부 x ±0.625 무침범(소파 최근접 −1.49, 여유 0.865m) · 현관 저대비 유지 · 신규 tri 순 +156 · 도어 색상 식별성 실렌더 확인(black·pearl-white 2종 스팟체크)
  **막힘/불확실**: 정성 판정("포근한가", "문이 여전히 주인공인가")은 설계상 골 밖 — 주인님 승인 대기. 게이트가 가림을 못 재는 한계 잔존(SCENE-PLAN 기록).

## 참조 문서

- `docs/ref/SCENE-PLAN.md` — P-E 표(phase별 게이트 항목이 곧 이 골의 하위 DoD)
- `docs/ref/KKART-PATTERN.md` — 반복 소품·현관 구조 실측 근거
- `.claude/skills/소품/SKILL.md` — 소품 제작 절차
