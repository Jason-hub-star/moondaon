---
id: l-shape-3track
name: 3연동 기역자 중문
motion: sliding_multi_panel_corner
panels: 3
frameDepthM: 0.117
stileWidthM: 0.019
stileDepthM: 0.032
widthRangeM: [1.2, 2.0]
maxHeightM: 2.3
sizeZonesMm: [[1200, 1400], [1401, 1600], [1601, 1800], [1801, 2000]]
jambM: 0.04
overlapM: 0.03
railIds: [flat-7, raised-20]
fixedPanels: [2]
colorCats: [basic-op, basic-sheet, wood-sheet, marble-sheet]
measured: [panels, frameDepthM, stileWidthM, stileDepthM]
confirmWith:
  sizeZonesMm: 'ㄱ자 구간별 사이즈 — 3연동 표를 준용했다'
  widthRangeM: 'ㄱ자 구간별 사이즈 — 팜플렛에 표가 없어 3연동 기준 적용'
  maxHeightM: 'ㄱ자 최대높이 — 팜플렛 미표기'
  jambM: '문틀 정면폭 — 팜플렛 미표기, 렌더 근사'
  overlapM: '3연동 겹침폭 — 실측치 없음(30mm 추정, 60mm는 이음매 이중바 유발)'
phase: P3
source: 리플렛_텍스트_정리.json + 실물 확인(측면 픽스)
---
