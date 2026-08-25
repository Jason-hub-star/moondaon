#!/usr/bin/env python3
"""터미널 패널 PNG(누적 상태) 렌더 — 1920x1080 RGBA, 좌측에 ctl 명령 터미널.
명령이 단계별로 나타나 "라이브 입력" 느낌. 우측(로봇 영역)은 투명.
출력: term_00.png .. term_NN.png (state k = 명령블록 1..k+1 표시)
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080
MONO = "/System/Library/Fonts/Monaco.ttf"
PSB = "/Users/family/Library/Fonts/Pretendard-SemiBold.otf"
PR = "/Users/family/Library/Fonts/Pretendard-Regular.otf"

# 패널 박스
PX, PY, PW, PH = 56, 120, 680, 840
BG = (10, 14, 20, 235)       # 터미널 다크
BAR = (22, 27, 34, 255)      # 타이틀바
CYAN = (54, 197, 209, 255)
GREEN = (63, 185, 80, 255)
WHITE = (230, 237, 243, 255)
MUTED = (139, 148, 158, 255)
FS = 19
LH = 30

# (명령, 결과, 마커종류) — 실제 구동 명령 기반. marker: "done"/"play"
BLOCKS = [
    ("$ unityctl status", "Unity 6000.3 · IPC 연결됨", "done"),
    ("$ exec SetMockModeForDebug(true)", "mock = True", "done"),
    ("$ exec ConnectDefaultForDebug()", "ConnectedServoOff", "done"),
    ('$ exec SelectTeachingSequence("PendantV3Points")', "3 points 로드", "done"),
    ("$ exec RunSelectedTeachingSequenceLoop()", "시퀀스 재생 중…", "play"),
    ('$ exec SelectTeachingSequence("PendantV3RecordedPath")', "4 points 로드", "done"),
    ("$ exec RunSelectedTeachingSequenceLoop()", "시퀀스 재생 중…", "play"),
]


def marker(d, x, y, kind):
    if kind == "play":  # 청록 삼각형(재생)
        d.polygon([(x, y), (x, y + 14), (x + 12, y + 7)], fill=CYAN)
    else:               # 초록 원(완료)
        d.ellipse([x, y, x + 13, y + 13], outline=GREEN, width=2)
        d.line([x + 3, y + 7, x + 6, y + 10], fill=GREEN, width=2)
        d.line([x + 6, y + 10, x + 11, y + 3], fill=GREEN, width=2)


def render(nblocks, out, cursor=True):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    monos = ImageFont.truetype(MONO, FS - 3)
    psb = ImageFont.truetype(PSB, 20)
    pr = ImageFont.truetype(PR, FS - 2)   # 결과(한글) 줄
    # 패널 + 타이틀바
    d.rounded_rectangle([PX, PY, PX + PW, PY + PH], radius=16, fill=BG)
    d.rounded_rectangle([PX, PY, PX + PW, PY + 44], radius=16, fill=BAR)
    d.rectangle([PX, PY + 28, PX + PW, PY + 44], fill=BAR)
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([PX + 20 + i * 26, PY + 15, PX + 34 + i * 26, PY + 29], fill=c)
    d.text((PX + 120, PY + 12), "unityctl — AI control", font=psb, fill=MUTED)
    # 본문
    x, y = PX + 24, PY + 66
    for b in range(min(nblocks, len(BLOCKS))):
        cmd, res, kind = BLOCKS[b]
        d.text((x, y), "$", font=monos, fill=CYAN)
        d.text((x + 16, y), cmd[1:].lstrip(), font=monos, fill=WHITE)
        y += LH
        marker(d, x + 16, y + 3, kind)
        d.text((x + 38, y), res, font=pr, fill=(CYAN if kind == "play" else GREEN))
        y += LH + 12
    if cursor and nblocks <= len(BLOCKS):
        d.rectangle([x, y + 2, x + 11, y + FS], fill=CYAN)
    img.save(out)


def main():
    for k in range(1, len(BLOCKS) + 1):
        render(k, os.path.join(HERE, f"term_{k-1:02d}.png"))
    print(f"rendered {len(BLOCKS)} terminal states (term_00..term_{len(BLOCKS)-1:02d})")


if __name__ == "__main__":
    main()
