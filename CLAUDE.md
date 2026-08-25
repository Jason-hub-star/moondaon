# 문다온 3D 쇼룸 (금강이지스)

프로젝트 루트의 짧은 진입점이다.

## Loading Order

**항상 읽기 (합계 20KB 상한 — 넘으면 문서를 쪼갠다)**

1. `CLAUDE.md`
2. `AGENTS.md`
3. `AGENT.md`
4. `docs/status/PROJECT-STATUS.md` — 현재 방향·블로커만. 진행 이력이 쌓이면 `docs/status/STATUS-LOG.md`로 분리한다.

**Grep Only (전문 자동 로드 금지)**

아래는 프로젝트가 자라면 반드시 커진다. 통째로 읽지 말고 `rg`로 해당 구간만 연다.

- `docs/ref/PROJECT-PLAN.md` · `docs/ref/ARCHITECTURE.md` · `docs/ref/SCHEMA.md` · `docs/ref/PRD.md`
- `docs/ref/STACK-PROFILES.md` — 스택을 실제로 고르거나 바꿀 때만
- `docs/status/WORK-BOARD.md` · `docs/status/DOC-SYNC-MATRIX.md`
- `.claude/skills/README.md` — 스킬을 찾을 때만

## 세션 비용 규칙

에이전트 비용은 모델 등급이 아니라 **컨텍스트 크기 × 턴 수**로 결정된다. 매 턴 전체 입력이 다시 청구되므로, 진입 문서 하나가 커지면 그 세션의 모든 턴이 비싸진다.

1. **20KB 상한.** 위 "항상 읽기" 합계가 20KB를 넘으면 문서를 쪼갠다. 상한을 늘리지 않는다.
2. **큰 문서는 `rg` → `offset`/`limit`.** heading·ID로 위치를 찾은 뒤 그 구간만 읽는다.
3. **같은 파일을 다시 읽지 않는다.** 편집 직후 확인용 재read 금지 — 하네스가 파일 상태를 추적한다. (실측: 중복 read가 세션 Read 호출의 25~45%였다.)
4. **누적 로그는 본문에서 분리한다.** 상태 문서는 "최신 2세션"만 본문에 두고 나머지는 `*-LOG.md`로 내린다. 방치하면 63KB짜리 배턴 파일이 매 세션 로드된다(실측 사례).
5. **컴팩트는 절약이 아니다.** 요약이 파일 내용을 지워 재읽기를 유발하고, 프롬프트 캐시(읽기 0.1×)를 통째로 깨뜨린다. 컴팩트 전에 결론·수치를 문서에 먼저 기록한다.
6. **낭비는 추측하지 말고 측정한다.** `python3 .claude/hooks/token-audit.py`

## 모델 라우팅

| 작업 | 담당 |
|---|---|
| 설계·근본원인·PASS/FAIL 판정 | 메인 모델이 직접 (위임하면 근거가 요약되며 증거가 깎인다) |
| 넓은 탐색 (파일 위치·호출처) | `Explore` 서브에이전트 — 결론만 회수 |
| 수치 산출물 해석·다중 리포트 대조 | 중간 등급 서브에이전트 |
| 긴 로그 요약·기계적 리팩터·2차 의견 | Codex 등 별도 토큰풀 |

서브에이전트 결과는 **근거로 쓰되 판정은 메인이 한다.** 실측 사례에서 서브에이전트의 주장 4개 중 2개가 틀렸고, 원본을 직접 열어야 잡혔다.

## Hard Rules

1. 읽기 전 편집 금지
2. 중요한 액션 전 목적 명시
3. 추측보다 구현과 실행 결과 우선
4. 검증 없는 완료 선언 금지
5. 문서 드리프트 방치 금지
6. 파일이 300줄 근처면 분리를 검토
7. 새 폴더가 경계를 가지면 로컬 `AGENTS.md` 또는 `CLAUDE.md` 추가
8. 새 요청은 `/intake` 또는 `task-intake-router` 우선
9. 완료 전 `evidence-review` 또는 `Evidence Status` 갱신
10. Ops Extension 사용 시 daily, board, matrix 동기화
