---
id: louver
name: 간살 도어
motion: louver_sliding
panels: 3
frameDepthM: 0.117
stileWidthM: 0.019
stileDepthM: 0.032
widthRangeM: [1.0, 1.5]
maxHeightM: 2.3
sizeZonesMm: [[1000, 1100], [1201, 1300], [1301, 1400], [1401, 1500]]
trackPitchM: 0.033
jambM: 0.04
overlapM: 0.03
louverBarM: 0.03
louverGapM: 0.035
railIds: [flat-7, raised-20]  # approx — 간살 페이지에 하부 표기 없음, 3연동 기준
glassIds: [clear, bronze, aqua, clear-satin, bronze-satin]  # 팜플렛 5종
colorCats: [wood-sheet]  # 간살 페이지 컬러 = 우드 주문제 시트만
measured: [widthRangeM, maxHeightM]
confirmWith:
  trackPitchM: '연동 트랙 피치 — 문틀 깊이 117mm 안 3트랙 실측치 없음(33mm 근사)'
  sizeZonesMm: '간살 구간표의 1101~1200 공백 — 팜플렛 인쇄 누락인가 실제 미운영인가'
  panels: '간살 기본 운영이 3연동인가 원슬인가 — 팜플렛은 둘 다 적었다'
  frameDepthM: '간살 문틀 폭 — 팜플렛 미표기, 3연동 기준 적용'
  railIds: '간살 하부레일 운영 — 팜플렛 미표기'
  jambM: '문틀 정면폭 — 팜플렛 미표기, 렌더 근사'
  overlapM: '3연동 겹침폭 — 실측치 없음(30mm 추정, 60mm는 이음매 이중바 유발)'
  louverBarM: '간살 바 폭 — 팜플렛은 간격 30~40mm만 적었다'
  louverGapM: '간살 간격 — 팜플렛 30~40mm 범위 중 35mm로 근사'
phase: P4
source: 리플렛_텍스트_정리.json
---

