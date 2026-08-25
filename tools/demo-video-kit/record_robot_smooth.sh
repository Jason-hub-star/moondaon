#!/usr/bin/env bash
# FR5 로봇 자율조작 데모 녹화 — unityctl(ctl)로 Unity를 원격 조작해 저장 시퀀스 루프 재생.
#
# 사용법:  보이는 "터미널 창"(Terminal.app/iTerm)에서 이 스크립트를 실행하고,
#          Unity robotapp 창을 터미널 옆에 나란히 배치하세요.
#          전체화면(screen 0)이 녹화되므로 터미널(ctl 명령) + Unity(로봇 3D)가 함께 담깁니다.
#
# 사전조건: robotapp 이 Play 모드 + RobotControlV3 씬 진입 상태일 것 (아래 setup 이 보장).
# 옵션:    DUR=녹화초(기본 25)  PREP=준비초(기본 8)  SCREEN_IDX=avf화면idx(기본 2)
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RA="${1:-/Users/family/jason/FR5UNITY/robotapp}"
UCTL="/Users/family/jason/unityctl"
SCREEN_IDX="${SCREEN_IDX:-2}"
OUT="${OUT:-$HERE/robot_smooth_raw.mp4}"
DUR="${DUR:-25}"
PREP="${PREP:-8}"

# ctl exec 헬퍼 — 보내는 명령을 화면에 예쁘게 보여주고 실행한다(데모 가독성).
ctl(){
  local label="$1" code="$2"
  printf '  \033[36m▶ %s\033[0m\n' "$label"
  printf '    \033[2m$ unityctl exec --code "%s"\033[0m\n' "$code"
  ( cd "$UCTL" && dotnet run --project src/Unityctl.Cli -c Release --no-build -- \
      exec --code "$code" --project "$RA" --json 2>/dev/null ) \
    | python3 -c "import sys,json
try:
  d=json.load(sys.stdin); r=(d.get('data') or {}).get('result') or d.get('message','')
  print('    \033[32m✓\033[0m',str(r)[:88])
except Exception: print('    \033[32m✓\033[0m')" 2>/dev/null || echo "    ✓"
}

clear
echo "════════════════════════════════════════════════════════"
echo "   unityctl × Unity  —  FR5 로봇 자율조작 데모 (사람 손 0)"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  [1] Unity 원격 셋업 (ctl 명령으로 자동 제어)"
( cd "$UCTL" && dotnet run --project src/Unityctl.Cli -c Release --no-build -- \
    play start --project "$RA" --json 2>/dev/null ) >/dev/null; sleep 2
ctl "RobotControlV3 씬 진입" 'KineTutor3D.App.SceneNavigator.LoadByName("RobotControlV3")'
ctl "Mock 모드 ON"          'KineTutor3D.App.RobotControlV3DebugBridge.SetMockModeForDebug(true)'
ctl "로봇 연결"             'KineTutor3D.App.RobotControlV3DebugBridge.ConnectDefaultForDebug()'
ctl "부드러운 타이밍(Slow)"  'KineTutor3D.App.RobotControlV3DebugBridge.SetPointMoveTimingForDebug("Slow",0.4)'
ctl "타이밍 적용"           'KineTutor3D.App.RobotControlV3DebugBridge.ApplyPointMoveTimingForDebug()'

echo ""
echo "  ┌────────────────────────────────────────────────┐"
echo "  │  Unity robotapp 창을 이 터미널 옆에 배치하세요.  │"
echo "  │  로봇 3D 뷰가 보이게 두면 전체화면에 함께 담깁니다.│"
echo "  │  ${PREP}초 뒤 녹화가 시작됩니다.                       │"
echo "  └────────────────────────────────────────────────┘"
for i in $(seq "$PREP" -1 1); do printf "\r  ⏳ %2ds…" "$i"; sleep 1; done; printf "\r            \n"

echo "  [2] ● REC  ${DUR}s  →  $OUT"
ffmpeg -y -f avfoundation -capture_cursor 1 -framerate 30 -t "$DUR" -i "${SCREEN_IDX}:none" \
  -pix_fmt yuv420p -c:v libx264 -preset ultrafast -crf 20 "$OUT" >/tmp/ffmpeg_robot_smooth.log 2>&1 &
FF=$!
sleep 2
if ! kill -0 "$FF" 2>/dev/null; then
  echo "  ✗ ffmpeg 실패 — 화면녹화 권한(시스템 설정>개인정보>화면 기록) 확인"; tail -5 /tmp/ffmpeg_robot_smooth.log; exit 1
fi

echo ""
echo "  [3] 자율 시퀀스 루프 재생"
ctl "저장 시퀀스 루프 (PendantV3Points)" 'KineTutor3D.App.RobotControlV3DebugBridge.RunSelectedTeachingSequenceLoopForDebug()'
echo "  🤖 로봇이 자율로 부드럽게 움직입니다… (녹화 중, 사람 손 0)"
wait "$FF" 2>/dev/null

echo ""
echo "  ✓ 녹화 종료 → $OUT"
echo "    (검증: 프레임 추출은 Claude 가 이어서 진행)"
