# GOAL-share-input-validation — 공유 링크 입력 검증으로 D1·D5 닫기

## 골 한 줄

```
공유 링크의 모든 필드를 카드 실재 여부·수치 유효성으로 검증해 조작되거나 낡은 링크가 앱을 죽이지 못하게 한다 — verified by `node --test` 케이스 전수 green + 카드 게이트·빌드·린트 green, while preserving 기존 v1·v2 정상 링크의 렌더 동일성. details in docs/goals/GOAL-share-input-validation.md
```

Codex 투입 시 앞에 `/골 ` 접두. 근거: `docs/status/AUDIT-2026-08-27.md` D1(치명)·D5(중간).

## 1. Outcome

`decodeHash()`가 스토어에 넣는 값이 **전부 실재하는 id이거나 유효 범위의 유한한 숫자**다. 하나라도 아니면 그 필드만 기본값으로 떨어지고, 나머지 정상 필드는 살아남는다.

완료 시 참이어야 할 것:

- 조작·손상된 해시 어떤 경우에도 `decodeHash()`가 예외를 던지지 않고, `App.tsx`가 `PRODUCTS[productId]`를 읽을 때 `undefined`가 될 수 없다.
- `widthM`이 숫자가 아니거나(문자열·null·객체) 유한하지 않으면(NaN·Infinity) 기본값 1.25로 떨어진다. UI에 `NaNmm`이 뜨는 경로가 사라진다.
- 정상 링크(v1·v2)의 디코드 결과는 **지금과 바이트 단위로 동일**하다.

## 2. Verification surface

전부 셸에서 실행 가능하고 특정 하네스에 의존하지 않는다. Node 24의 네이티브 TypeScript 실행을 쓰므로 **새 의존성이 0개**다(실증 완료 — `node --test`로 `generated/cards.ts` 직접 import 성공).

| 명령 | 기대 |
|---|---|
| `cd apps/web && node --test src/configurator/shareSchema.test.ts` | 아래 케이스 전수 pass, fail 0 |
| `node scripts/build-cards.mjs` | 기존 카드 게이트(Zod·교차검증·썸네일) green |
| `cd apps/web && npm run build` | `tsc -b` + `vite build` 통과 |
| `cd apps/web && npm run lint` | oxlint clean |

테스트가 반드시 덮어야 할 케이스:

1. **거부 — 없는 id 5종**: `productId`·`colorId`·`glassId`·`patternId`·`handleId` 각각에 카드에 없는 값 → 해당 필드만 기본값, 예외 없음
2. **거부 — widthM 비수치 5종**: `"abc"` · `null` · `{}` · `NaN` · `Infinity` → 1.25로 폴백
3. **거부 — 구조 손상**: 해시가 base64가 아님 / JSON이 아님 / 배열 / `null` / `v` 필드 없음 → 빈 객체 반환(기존 동작 유지)
4. **보존 — 정상 v2 링크**: 모든 필드 유효 → 입력과 동일한 객체
5. **보존 — 정상 v1 링크**: `v:1` → `v:2`로 승격되고 나머지 필드 그대로 (기존 호환 로직 유지)
6. **부분 보존**: 한 필드만 오염된 링크 → **오염된 필드만** 기본값, 나머지는 원본 유지 (통째로 버리지 않는다)
7. **`panelPatterns` 배열**: 원소에 없는 패턴 id가 섞이면 그 원소만 `null`로, 배열이 아니면 필드 폐기

아티팩트: `apps/web/src/configurator/shareSchema.ts` (검증 함수) + 같은 이름의 `.test.ts`.

운영 재현 확인(수동, 배포 후): 감사 리포트 D1의 링크를 열었을 때 콘솔 예외 0건이고 문이 렌더된다.

## 3. Constraints (후퇴 금지)

- **기존 공유 링크 호환.** `encodeHash`의 base64url 출력 형식을 바꾸지 않는다. 이미 고객·영업에 뿌려진 정상 링크가 계속 같은 화면을 띄워야 한다.
- **v1 링크 호환 유지** — `store.ts:32`의 v1→v2 승격 로직을 없애지 않는다.
- **로드 시 색상·유리 보정 유지** — `App.tsx:66`의 allowlist 보정은 그대로 동작해야 한다. 이번 검증은 그 앞단(존재 여부)이고, 보정은 뒷단(허용 여부)이라 역할이 다르다.
- **카드 데이터 무수정** — `data/`와 `generated/cards.ts`는 읽기만.
- **새 npm 의존성 0개.** 테스트 러너를 설치하지 않는다(Node 내장 `node --test` + 네이티브 TS로 충분함이 실증됨).
- CI green 유지.

## 4. Boundaries

**허용**

- `apps/web/src/configurator/shareSchema.ts` (신규) · `shareSchema.test.ts` (신규)
- `apps/web/src/configurator/store.ts` — `decodeHash()`가 위 검증을 통과시키도록
- `apps/web/package.json` — `"test"` 스크립트 1줄 추가
- `.github/workflows/ci.yml` — Node 20 → 24 (네이티브 TS 실행 요건) + 테스트 스텝 1개

**금지**

- `data/`, `scripts/build-cards.mjs`, `api/` 전체
- 씬·도어 렌더 코드(`scene/`, `door/`)
- `.env.local`, Vercel 설정, 배포 트리거

## 5. Iteration policy

각 패스마다 §2의 명령 4개를 **전부** 실행한다. 실패한 항목만 골라 최소 변경으로 재시도하고, 통과한 항목은 다시 건드리지 않는다. 무진전 3패스면 blocked 판정.

검증 케이스를 통과시키려고 케이스를 무르게 고치지 않는다 — 기대값을 바꿔야 한다고 판단되면 그 자체를 blocked로 보고한다.

## 6. Blocked stop condition

- **CI를 Node 24로 못 올리는 사정이 드러나면** 멈추고 보고한다. 검증 명령이 CI에서 돌지 못하면 이 골은 완료 판정이 불가능하다.
- `generated/cards.ts`의 형태가 네이티브 TS 실행과 안 맞는 경우(enum·namespace 등장) — 현재는 맞음을 실증했으나 카드 생성기가 바뀌면 깨질 수 있다.
- 정상 링크 보존(§2 케이스 4·5)과 검증 강화가 충돌하면 — 설계 문제이므로 구현으로 밀지 않고 보고한다.

보고 형식: **재현됨 / 근사됨 / 막힘 / 불확실** 4분류.

**범위 밖(손대지 않는다)**: 감사 리포트의 D2(시점 뒤집힘)·D3(공유 카드 이미지 도용·무인증 업로드)·D4(첫 로딩 백지)·D6(견적 문구). 각각 별도 골이다 — 아래 사다리 참조.

## 사다리

이 골은 감사 후속 3개 중 첫 번째다. 직렬이 아니라 독립이므로 순서는 심각도순.

1. **GOAL-share-input-validation** ← 지금 이것 (D1 치명 + D5)
2. GOAL-orbit-recovery (D2) — 시점 하한 + 초기화 버튼
3. GOAL-og-abuse (D3) — 블롭 호스트 좁히기 + 업로드 자물쇠

## 7. 실행 기록

**2026-08-27 · Claude Code · 패스 3 · 판정 PASS (로컬). 운영 배포는 미완.**

| 패스 | 한 일 | 결과 |
|---|---|---|
| 1 | `shareSchema.ts`+테스트 신설, `store.ts`의 `decodeHash` 교체 | `node --test` 실패 — Node ESM이 확장자 없는 `../generated/cards`를 못 찾음 |
| 2 | 검증 모듈만 명시 확장자(`cards.ts`)로. `allowImportingTsExtensions`가 이미 켜져 있어 tsc도 통과 | 테스트 11/11 green. `tsc -b`가 테스트의 node 전역(`Buffer`·`node:test`)에서 TS2591 3건 |
| 3 | 테스트를 `tsconfig.app.json`에서 빼고 `tsconfig.node.json`(이미 `types:["node"]`)으로 옮김 | 검증 4종 전부 green |

**검증 증거**

- `node --test 'src/**/*.test.ts'` → tests 11 / pass 11 / **fail 0**
- `node scripts/build-cards.mjs` → `OK: colors 37, glasses 10, patterns 38, handles 2, products 11`
- `npm run build` → `tsc -b` 통과 + `✓ built in 960ms`
- `oxlint` → exit 0 (경고는 전부 손대지 않은 기존 파일)

**실렌더 판정** (`vite preview` + 실제 브라우저, 단위 테스트와 별개)

| 링크 | 이전 | 이후 |
|---|---|---|
| D1 (없는 productId) | 백지 + `TypeError: …reading 'widthRangeM'` | 문 렌더, 제품이 기본값으로 폴백, **콘솔 예외 0** |
| D5 (`widthM:"abc"`) | 씬 붕괴(3연동→외짝, 벽·소품 소실) + `치수 — NaNmm` | 3연동·벽·소품 정상, `치수 — 1250mm · A구간` |
| 정상 v2 (베젤·격자2×3·일체형·1600mm) | — | 지정대로 렌더. 회귀 없음 |
| 구버전 v1 링크 | — | v2로 승격되고 v2와 동일 렌더 |

`App.tsx:66`의 기존 색상 보정도 살아 있음을 확인 — 위 링크의 `navy`가 베젤 제품 allowlist에 없어 `black`으로 보정됐고, 해시도 그에 맞게 다시 쓰였다.

**부수 효과 (골 범위 안, 의도됨)**: 범위 밖 `widthM`이 이제 해시 단계에서 갇힌다. 감사 리포트가 "통과한 것"에 적어둔 *화면은 2000mm인데 저장값은 50* 불일치가 함께 사라졌다.

**남은 불확실성**

- CI는 로컬에서 못 돈다. Node 24 승격(`ci.yml`)이 실제로 green인지는 **push 후 확인해야 한다.**
- 운영(https://moondaon-showroom.vercel.app)에는 **아직 반영 전**이다. 배포 전까지 D1 링크는 운영에서 여전히 백지다.

## 참조 문서

- `docs/status/AUDIT-2026-08-27.md` — 결함 근거·재현 절차
- `docs/status/PROJECT-STATUS.md` — 현재 배포 상태
- `apps/web/src/configurator/store.ts:26-40` — 수정 대상
- `apps/web/src/App.tsx:45-72` — 크래시 지점(47행)과 기존 보정(66행)
