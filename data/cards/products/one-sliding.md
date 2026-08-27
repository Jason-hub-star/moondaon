---
id: one-sliding
name: 원슬라이딩 1SD/2SD/4SD
motion: sliding_single_panel
panels: 1
frameDepthM: 0.045
stileWidthM: 0.019
stileDepthM: 0.032
widthRangeM: [0.8, 2.4]
maxHeightM: 2.3
jambM: 0.04
railIds: [slim-25x5]  # 팜플렛 명시 1종 (수동 원슬은 무레일 표기 없음)
colorIds: [white, black, champagne-gold]  # 도장 기본운영 3색
colorCats: [wood-sheet]
measured: [frameDepthM, stileWidthM, stileDepthM]
confirmWith:
  railIds: '수동 원슬에 무레일 운영이 있는가 — 자동 원슬만 "6MM / 무레일"로 적혀 있다'
  panels: '원슬 1SD/2SD/4SD 패널 수 — 현재 1짝 고정으로 단순화'
  widthRangeM: '원슬 구간별 사이즈 — 팜플렛에 표가 없다'
  maxHeightM: '원슬 최대높이 — 팜플렛 미표기'
  jambM: '문틀 정면폭 — 팜플렛 미표기, 렌더 근사'
phase: P2
source: 리플렛_텍스트_정리.json
---

