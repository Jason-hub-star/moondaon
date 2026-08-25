#!/usr/bin/env python3
"""세션 트랜스크립트에서 토큰 낭비 지표를 집계한다 (수동 실행, 훅 아님).

  python3 .claude/hooks/token-audit.py          # 최근 5세션
  python3 .claude/hooks/token-audit.py 10       # 최근 10세션

지표 3개 — 하네스 개선 before/after 비교용:
  1. 중복 Read %   : 같은 파일을 2회 이상 읽은 비율 (컴팩트 후 재읽기가 주원인)
  2. 대형 read     : 20KB 이상 파일을 offset/limit 없이 통째로 읽은 횟수
  3. 세션 총 Read  : 절대량
"""
import json, glob, os, sys, collections

PROJ = os.path.expanduser("~/.claude/projects/" + os.getcwd().replace("/", "-"))
BIG = 20 * 1024


def audit(path):
    reads, big = collections.Counter(), []
    for line in open(path, errors="ignore"):
        try:
            obj = json.loads(line)
        except ValueError:
            continue
        for c in (obj.get("message") or {}).get("content") or []:
            if not (isinstance(c, dict) and c.get("type") == "tool_use" and c.get("name") == "Read"):
                continue
            inp = c.get("input") or {}
            fp = inp.get("file_path", "?")
            reads[fp] += 1
            # offset/limit 없이 읽은 대형 파일만 낭비로 센다
            if not inp.get("limit") and not inp.get("offset"):
                try:
                    if os.path.getsize(fp) >= BIG:
                        big.append(fp)
                except OSError:
                    pass
    total = sum(reads.values())
    dup = sum(v - 1 for v in reads.values() if v > 1)
    return total, dup, reads, big


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    files = sorted(glob.glob(PROJ + "/*.jsonl"), key=os.path.getmtime)[-n:]
    if not files:
        print("트랜스크립트 없음:", PROJ)
        return
    print(f"{'session':10} {'Read':>5} {'중복':>5} {'중복%':>6} {'대형통독':>8}")
    for f in files:
        total, dup, reads, big = audit(f)
        pct = dup * 100 // total if total else 0
        print(f"{os.path.basename(f)[:8]:10} {total:5} {dup:5} {pct:5}% {len(big):8}")
        for fp, v in reads.most_common(3):
            if v > 2:
                print(f"           └ {v}x {os.path.basename(fp)}")


if __name__ == "__main__":
    main()
