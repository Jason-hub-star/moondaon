# apps Local Agent Entry

이 폴더는 앱 단위 경계다.

## Read Before Editing

1. 상위 `AGENTS.md`
2. 상위 `CLAUDE.md`
3. 이 앱과 관련된 `docs/ref/*`
4. `docs/status/PROJECT-STATUS.md`

## Folder Role

- 여러 앱이 있을 경우 각 앱의 진입점
- app별 UI, API, 배포 surface 구분

## Local Rules

1. 앱 경계를 넘는 공통 로직은 `src/` 또는 공용 계층으로 올릴지 먼저 검토한다.
2. route/surface 변경이면 `doc-sync`를 반드시 후보에 넣는다.
3. 앱 전용 검증 명령은 이 폴더 문서에 추가한다.
4. 앱별 구조가 크게 달라지면 하위 앱 폴더에 추가 로컬 `AGENTS.md`를 둔다.

## Typical Companion Skills

- `design-to-code`
- `doc-sync`
- `parallel-qa`
