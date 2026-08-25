# Frontend Kit Template Instructions

이 폴더는 새 프론트엔드 프로젝트에서 AI 에이전트가 빠르게 고를 수 있는 기능 카탈로그다.

## Role

- `REGISTRY.md`: 사람이 훑는 선택표.
- `kit-registry.json`: 에이전트가 읽는 machine-readable 선택표.
- 실제 프로젝트의 라이브 `/kit`은 쇼룸, 이 폴더는 이식 가능한 부품 창고다.

## Rules

1. 새 기능은 고유 ID를 붙인다. 예: `K-HERO-01`, `K-FORM-01`.
2. 각 기능은 `whenToUse`, `avoidWhen`, `files`, `deps`, `promptSnippet`을 반드시 가진다.
3. 특정 프로젝트명, 절대 경로, 브랜드 카피는 `sourceProject`나 `notes`에만 둔다.
4. 이 폴더에는 큰 컴포넌트 구현을 넣기보다 선택 기준과 이식 경로를 먼저 둔다.
5. 구현 코드가 필요하면 각 프로젝트의 live `/kit`이나 source repo를 참조한다.
6. 자동 생성 항목(`status: "needs-curation"`)은 선택표에 보이더라도 사용 전에 사람이 `whenToUse`, `avoidWhen`, `promptSnippet`을 다듬는다.

## Sync

WEFLOW 같은 source project에서 live `/kit` 카드가 늘어나면 source project의 동기화 스크립트를 실행한다.

```bash
pnpm sync:frontend-kit
pnpm check:frontend-kit
```

- `sync:frontend-kit`: live `/kit`의 `<KitCard>`를 스캔해 `kit-registry.json`에 빠진 항목을 자동 추가한다.
- `check:frontend-kit`: registry가 최신인지 확인한다. 누락 항목이 있으면 실패한다.
- 자동 추가 항목은 `generatedBy`와 `registryKey`를 가진다. 사람이 큐레이션해 `status`를 바꾸면 다음 sync에서 보존된다.

## Agent Use

사용자가 "이 기능, 저 기능으로 만들어줘"라고 하면:

1. `kit-registry.json`에서 ID를 찾는다.
2. `files`와 `deps`를 확인한다.
3. 현재 프로젝트의 토큰/라우팅/컴포넌트 규칙에 맞게 이식한다.
4. 모바일 375, 태블릿 768, 데스크톱 1440에서 확인한다.
