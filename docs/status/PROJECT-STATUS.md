# PROJECT-STATUS — 문다온 3D 쇼룸

- 갱신: 2026-08-26 (세션 마감 — 배포 완료)
- 방향: 중문 디지털트윈 — 고객 커스텀 컨피규레이터 + 영상AI 레퍼런스 캡처, Vite+React+r3f
- 스펙 정본: `docs/archive/GRILL-중문디지털트윈.md` 결정 요약표 + `docs/ref/PATTERN-MAP.md`(패턴 매핑) + `docs/ref/rnd/PATTERN-V2-CONVERGE-LOOP-2026-08-26.md`(v2 수렴)
- 현재 상태: **P1~P11 완료 · 운영 배포 중** — https://moondaon-showroom.vercel.app (Vercel moondaon-showroom, push마다 CI+자동 배포). 패턴 38종·제품 11종·색상 36종, 게이트 3종(교차검증·CI·SVG 썸네일), 모바일 반응형(QA ?mobile=1). 이력 상세: `STATUS-LOG.md`
- 블로커: 없음
- 대기 항목:
  - **킬-실험 2 (주인님 실행)**: ~/Downloads의 moondaon_*.mp4 + 프롬프트 페어를 영상AI에 레퍼런스 투입 → 프롬프트-only 대비 비교. 결과로 캡처 파이프라인 투자 지속 판정
  - **아이폰 AR 실기기 테스트**: 이제 운영 URL로 가능 — 아이폰에서 https://moondaon-showroom.vercel.app → "실물 크기로 보기" → Quick Look (텍스처 USDZ 반영도 확인)
  - **사업 확인 (배포 후 잔여)**: 팜플렛 사진·문다온 브랜드 웹 게재 권리 — 주인님 지시로 배포 선행. 문제 시 Vercel 비공개 전환으로 즉시 내림
  - **문다온 확인 2건**: S127↔S128 나르본오크 시트코드 · 3연동 겹침폭 실측(현재 30mm approx)
- 주문가능성 제약 완료 (2026-08-26): 제품 카드 `glassIds`·`colorIds`·`colorCats` allowlist + UI 필터 + 전환 시 자동 보정 + 교차검증 게이트(존재하지 않는 id 차단 — 음성테스트 PASS). 간살 유리5·우드만 / 스윙 유리5·1S 950mm 클램프 / 원슬·베젤 도장3(샴페인골드 카드 신규)+우드 — 실렌더 검증. 스윙 유리 5종은 간살 세트 동일 추정(approx)
- 다음 액션: ① 킬-실험 2 결과 수령 → 품질 상향 우선순위 ② v3 후보(3연동 관통 아치 패널 슬라이스·조합 프리셋) 착수 여부 ③ 문다온 확인 3건(시트코드 S127/S128·겹침폭·스윙 유리 5종 명단)
