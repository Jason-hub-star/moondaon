# src Local Agent Entry

이 폴더는 프로젝트의 공용 애플리케이션 소스 루트다.

## Read Before Editing

1. 상위 `AGENTS.md`
2. 상위 `CLAUDE.md`
3. `docs/ref/ARCHITECTURE.md`
4. `docs/status/PROJECT-STATUS.md`

## Folder Role

- 공용 소스 코드
- 여러 기능이 만나는 경계
- 재사용 가능한 도메인/유틸/컴포넌트

## Local Rules

1. 공용 코드면 중복보다 재사용을 우선한다.
2. 파일이 300줄 근처면 역할 분리를 먼저 검토한다.
3. 새 하위 경계가 생기면 그 아래에 다시 로컬 `AGENTS.md` 또는 `CLAUDE.md`를 둘지 검토한다.
4. 계약을 바꾸면 `ARCHITECTURE.md` 또는 관련 ref 문서를 같이 본다.

## Typical Companion Skills

- `doc-sync`
- `api-contract-guard`
- `big-task`
