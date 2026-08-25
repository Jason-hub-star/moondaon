# backend Local Agent Entry

이 폴더는 서버, 워커, 계약, 저장 계층 경계를 관리한다.

## Read Before Editing

1. 상위 `AGENTS.md`
2. 상위 `CLAUDE.md`
3. `docs/ref/ARCHITECTURE.md`
4. `docs/ref/SCHEMA.md`
5. `docs/status/PROJECT-STATUS.md`

## Folder Role

- API / worker / domain service / persistence
- 외부 시스템 및 스키마 계약 관리

## Local Rules

1. 외부 API, 모델명, 컬럼명은 추정으로 하드코딩하지 않는다.
2. schema/model 변경이면 `SCHEMA.md`와 `doc-sync`를 같이 본다.
3. 워커/파이프라인 변경이면 영향 범위를 먼저 좁힌다.
4. 공용 계약을 바꾸면 프론트 또는 다른 소비자 영향도 함께 점검한다.

## Typical Companion Skills

- `api-contract-guard`
- `doc-sync`
- `code-review-graph-ops`
- `migration-manifest`
