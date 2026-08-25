# 문다온 3D 쇼룸 (금강이지스) Agent Entry

## Loading Order

1. `AGENTS.md`
2. `AGENT.md`
3. `CLAUDE.md`
4. `ai-context/START-HERE.md`
5. `docs/status/PROJECT-STATUS.md`
6. `docs/ref/PROJECT-PLAN.md`
7. `docs/ref/STACK-PROFILES.md`
8. `docs/ref/ARCHITECTURE.md`
9. 필요 시 `docs/status/WORK-BOARD.md`, `docs/status/DOC-SYNC-MATRIX.md`
10. `.claude/skills/README.md`
11. 필요 시 `docs/ref/PRD.md`, `docs/ref/SCHEMA.md`

## Rules

1. 수정 전에 파일을 읽는다.
2. 변경 목적을 먼저 적는다.
3. 구현 후 검증한다.
4. 문서 동기화를 같이 끝낸다.
5. 파괴적 조작은 명시 요청 없이 하지 않는다.
6. 파일이 300줄에 가까워지면 분리를 검토한다.
7. 역할 경계가 생기는 새 폴더면 로컬 `AGENTS.md` 또는 `CLAUDE.md` 추가를 검토한다.
8. 새 요청이 복잡하거나 사용자가 `스킬라우팅해줘`라고 하면 `/intake`, `task-intake-router`, 또는 skill routing template로 먼저 라우팅한다. 단순 1-step 작업은 바로 처리한다.
9. 완료 전 `Evidence Status`를 갱신한다.
10. Ops Extension 사용 시 `WORK-BOARD.md`, `DOC-SYNC-MATRIX.md`, `docs/daily/*`를 같이 맞춘다.
11. 문서 업데이트는 "상태판 정리 + 일지 누적"으로 한다. `PROJECT-STATUS.md`와 보드는 최신 사실만 얇게 유지하고, 긴 변경 서술·증거·회고는 `docs/daily/` 또는 `docs/weekly/`로 보낸다.
