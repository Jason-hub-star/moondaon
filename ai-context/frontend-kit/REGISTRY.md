# Frontend Kit Registry

> AI 에이전트에게 "이 기능, 이 기능, 저 기능을 써서 만들어줘"라고 지시하기 위한 프론트엔드 부품 선택표.

이 레지스트리는 실제 컴포넌트 구현 저장소가 아니라, **기능을 빠르게 훑고 선택하는 카탈로그**다. 라이브 미리보기는 각 프로젝트의 `/kit`에 두고, 이곳에는 이식 가능한 ID·용도·의존성·프롬프트를 둔다.

## 빠른 사용법

사용자는 기능 ID만 골라 말하면 된다.

```text
K-HERO-01, K-BG-01, K-PRICE-01, K-FORM-01, K-CTA-01 조합으로 랜딩 만들어줘.
톤은 프리미엄 미니멀, 모바일 먼저.
```

에이전트는 `kit-registry.json`에서 ID를 찾고, `files`·`deps`·`promptSnippet`을 기준으로 현재 프로젝트에 맞게 이식한다.

## 자동 동기화

source project의 live `/kit`에 새 `<KitCard>`가 추가되면 아래 명령으로 `kit-registry.json`이 자동 확장된다.

```bash
pnpm sync:frontend-kit
pnpm check:frontend-kit
```

자동 추가된 항목은 `status: "needs-curation"`으로 들어간다. 바로 사용할 수는 있지만, 범용 템플릿으로 오래 쓸 항목은 사람이 `whenToUse`, `avoidWhen`, `promptSnippet`을 다듬고 `proven` 또는 `candidate`로 승격한다.

## 추천 조합

| 목적 | 조합 |
|---|---|
| 전환형 서비스 랜딩 | `K-HERO-01` · `K-BG-01` · `K-FEATURE-01` · `K-PRICE-01` · `K-FORM-01` · `K-CTA-01` |
| 포트폴리오/사례 중심 | `K-HERO-02` · `K-CARD-02` · `K-FILTER-01` · `K-MOTION-02` · `K-CTA-01` |
| 예약/문의 중심 | `K-HERO-02` · `K-FORM-02` · `K-CONTACT-01` · `K-STICKY-01` |
| 프리미엄 브랜드 페이지 | `K-BG-01` · `K-CARD-01` · `K-MOTION-01` · `K-TRUST-01` · `K-CTA-01` |

## Catalog

| ID | 이름 | 분류 | 용도 | 상태 |
|---|---|---|---|---|
| `K-HERO-01` | HeroVideo | Hero | 영상/포스터 중심 첫 화면 | WEFLOW proven |
| `K-HERO-02` | PageHero | Hero | 내부 페이지 공통 상단 | WEFLOW proven |
| `K-BG-01` | BrandDepthBackground | Background | subtle grid + depth 배경 | WEFLOW proven |
| `K-BG-02` | MeshGradientBackground | Background | 동적인 브랜드 무드 배경 | WEFLOW proven |
| `K-CARD-01` | PremiumCardSurface | Surface | 전환 핵심 카드 깊이감 | WEFLOW proven |
| `K-CARD-02` | SpotlightCard | Surface | hover 시 주목 카드 강조 | WEFLOW proven |
| `K-CTA-01` | CTASection | CTA | 페이지 말미 전환 섹션 | WEFLOW proven |
| `K-STICKY-01` | FloatingCTA | CTA | 모바일/데스크톱 고정 문의 액션 | WEFLOW proven |
| `K-FORM-01` | DiagnoseWizard | Form | 5단계 무료진단/문의 폼 | WEFLOW proven |
| `K-FORM-02` | ReservationForm | Form | 예약 폼 | candidate |
| `K-PRICE-01` | PricingQuickCompare | Pricing | 플랜 비교 + 선택 상세 | WEFLOW proven |
| `K-FILTER-01` | TagFilter | Filter | 사례/후기/블로그 필터 | WEFLOW proven |
| `K-MOTION-01` | DeveloperBuildBoard | Motion | 제작 신뢰·검수 흐름 표시 | WEFLOW proven |
| `K-MOTION-02` | TiltCard | Motion | 사례/서비스 카드 입체 hover | WEFLOW proven |
| `K-MOTION-03` | ServiceSuccessStack | Motion | 서비스 성공 패턴 sticky stack | WEFLOW proven |
| `K-MOTION-04` | PauseMarquee | Motion | 후기/로고/태그 흐름 | WEFLOW proven |
| `K-MOTION-05` | StaggerReveal | Motion | 헤딩 단어별 등장 | WEFLOW proven |
| `K-TRUST-01` | ReviewCard + RatingStars | Trust | 후기 신뢰 요소 | WEFLOW proven |
| `K-CONTENT-01` | FaqAccordion | Content | FAQ 접힘/펼침 | WEFLOW proven |
| `K-CONTENT-02` | BlogList + Pagination | Content | 글 목록/페이지네이션 | candidate |

## Selection Heuristics

## Media Notes

- `K-HERO-01` HeroVideo는 poster-first 패턴을 기본으로 한다.
- Hero poster는 framework image optimizer로 우선 렌더하고, LCP라면 preload/fetch priority를 명시한다.
- Background video는 desktop + non-reduced-motion에서만 mount하는 구조를 선호한다.
- Autoplay decorative video는 `muted`, `playsInline`, `preload="metadata"`를 기본으로 한다.
- 같은 poster를 optimized image와 `<video poster>` 양쪽에 걸어 중복 다운로드시키지 않는다.
- `video`, `poster`, `thumbnail`은 data/props로 분리해 파일이 교체돼도 최적화 규칙이 유지되게 한다.
- Hero poster는 100-300KB, hero video는 2-4MB를 1차 목표로 본다.

- **첫 화면이 약하다**: `K-HERO-01` 또는 `K-HERO-02` + `K-BG-01`.
- **페이지가 평면적이다**: `K-CARD-01`, `K-CARD-02`를 먼저 적용한다.
- **문의 전환이 목적이다**: `K-FORM-01`, `K-CTA-01`, `K-STICKY-01`을 한 묶음으로 쓴다.
- **가격이 복잡하다**: `K-PRICE-01`로 먼저 비교 구조를 만든 뒤 상세 카드를 붙인다.
- **콘텐츠가 많다**: `K-FILTER-01`, `K-CONTENT-01`, `K-CONTENT-02`를 쓴다.
- **브랜드 신뢰가 부족하다**: `K-TRUST-01`, `K-MOTION-01`, `K-MOTION-04`를 쓴다.

## Maintenance

- 사람이 보는 요약은 이 파일에 둔다.
- 상세 이식 정보는 `kit-registry.json`에 둔다.
- 자동 동기화 항목은 `kit-registry.json`에 먼저 들어가며, 이 요약 표에는 핵심 proven/candidate만 올린다.
- live preview가 생기면 `livePreview`를 각 프로젝트 `/kit#id`로 채운다.
- 새 프로젝트로 복사할 때는 브랜드명, 라우트, 토큰명, 패키지 의존성을 반드시 현지화한다.
