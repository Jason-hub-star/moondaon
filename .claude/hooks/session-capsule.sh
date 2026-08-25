#!/bin/sh
# 세션 진입 캡슐 — "지금 어디 · 다음 뭐 · 얼마나 묵었나"를 세션 시작에 자동으로 띄운다.
#
# 왜 필요한가 (2026-07-25 실측): 진입 문서를 사람이 매번 지정하면 (a) 경로를 일일이 대야 하고
# (b) 배턴이 묵은 걸 모른 채 낡은 전제로 작업한다. 실제로 한 프로젝트의 SCOUT이 27일 묵었는데
# state=DONE 이라 최신으로 착각될 상태였다. 훅은 그 두 가지를 공짜로 해결한다.
#
# 원칙: 세션 시작을 절대 막지 않는다(무슨 일이 있어도 exit 0). 출력은 20줄을 넘기지 않는다.

emit_status() {
  f="$1"; label="$2"
  [ -f "$f" ] || return 0
  printf '[%s]\n' "$label"
  # 상태 신호로 쓰이는 줄만 발췌 — 문서 전문을 로드하지 않는 게 목적이다.
  grep -m6 -E '^(state|status|task|next|다음|블로커|blocker):|^\*\*(ACTIVE|다음|블로커)' "$f" \
    | cut -c1-110 | sed 's/^/  /'
  # 신선도: 마지막 커밋 시각 기준으로 며칠 묵었는지
  if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
    last=$(git log -1 --format=%ct -- "$f" 2>/dev/null)
    if [ -n "$last" ]; then
      age=$(( ( $(date +%s) - last ) / 86400 ))
      [ "$age" -gt 7 ] && printf '  [!] %d일 묵음 — 최신 상태인지 먼저 확인할 것\n' "$age"
    fi
  fi
}

emit_status "docs/status/SCOUT.md" "배턴"
emit_status "docs/status/PROJECT-STATUS.md" "프로젝트 상태"

# 미백업 경고 — 로컬에만 쌓인 커밋은 디스크 고장 시 전량 손실이다.
if git rev-parse --git-dir >/dev/null 2>&1; then
  if [ -z "$(git remote 2>/dev/null)" ]; then
    n=$(git rev-list --count HEAD 2>/dev/null || echo 0)
    [ "$n" -gt 0 ] && printf '[!] 원격 없음 — 커밋 %s개가 무백업 상태\n' "$n"
  else
    ahead=$(git log @{u}.. --oneline 2>/dev/null | wc -l | tr -d ' ')
    [ "${ahead:-0}" -gt 5 ] && printf '[!] 미푸시 %s커밋 — 백업되지 않았다\n' "$ahead"
  fi
fi

printf '규칙: 큰 문서는 rg로 구간만 연다(전문 자동 로드 금지). 낭비 실측 = python3 .claude/hooks/token-audit.py\n'
exit 0
