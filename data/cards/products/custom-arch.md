---
id: custom-arch
name: 커스텀 아치도어 (3연동)
motion: sliding_multi_panel
panels: 3
frameDepthM: 0.117
stileWidthM: 0.019
stileDepthM: 0.032
widthRangeM: [1.2, 2.0]
maxHeightM: 2.3
sizeZonesMm: [[1200, 1400], [1401, 1600], [1601, 1800], [1801, 2000]]
jambM: 0.04
overlapM: 0.03
railIds: [flat-7, raised-20]  # approx — 커스텀 페이지에 하부 표기 없음, 3연동 기준
colorCats: [basic-op, basic-sheet, wood-sheet, marble-sheet]
measured: [panels]
confirmWith:
  sizeZonesMm: '커스텀 아치 구간별 사이즈 — 3연동 표를 준용했다'
  jambM: '문틀 정면폭 — 팜플렛 미표기, 렌더 근사'
  overlapM: '3연동 겹침폭 — 실측치 없음(30mm 추정, 60mm는 이음매 이중바 유발)'
phase: P5
source: 리플렛_텍스트_정리.json custom_arch
---
