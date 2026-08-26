import { PATTERNS, PATTERN_THUMBS, type PatternId } from '../generated/cards'

/** 패턴 선택 칩 — 카드에서 자동 생성된 SVG 미니어처(시각 게이트 겸용) + 이름 */
export function PatternChip({ id, active, onClick }: { id: PatternId; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={PATTERNS[id].name}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 7px',
        borderRadius: 10, cursor: 'pointer',
        border: active ? '1.5px solid #c5a572' : '1px solid #d9d4ca',
        background: active ? '#f6efe3' : '#fff', color: '#2b2926' }}>
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(PATTERN_THUMBS[id])}`} alt=""
        style={{ width: 26, height: 44 }} />
      <span style={{ fontSize: 10, maxWidth: 62, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {PATTERNS[id].name}</span>
    </button>
  )
}
