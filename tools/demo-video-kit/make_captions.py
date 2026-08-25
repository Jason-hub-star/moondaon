#!/usr/bin/env python3
"""자막 PNG 스트립 렌더 (1920x1080 RGBA 투명, 하단 3분의 1 로어서드).
ffmpeg가 drawtext 불가 → PIL로 캡션 PNG를 만들어 overlay로 합성.
타이밍은 captions.json, 표시 텍스트는 narration-display.txt(깔끔한 표기).
출력: cap_00.png ... cap_NN.png
"""
import os, json, textwrap
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080
PSB = "/Users/family/Library/Fonts/Pretendard-SemiBold.otf"
FG = (255, 255, 255, 255)
BAR = (13, 17, 23, 200)       # 반투명 다크 백킹
ACCENT = (54, 197, 209, 255)  # 청록 좌측 바
FSIZE = 42
MAXW = 1060  # 텍스트 최대 폭(px) — 우측 로봇 영역 폭에 맞춤
CENTER_X = int(os.environ.get("CAP_CENTER_X", "1320"))  # 자막 중심 x (기본: 우측 영역 중앙)
BOTTOM_Y = int(os.environ.get("CAP_BOTTOM_Y", "1010"))  # 자막 바 하단 y


def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textbbox((0, 0), t, font=font)[2] <= maxw:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def render(text, out):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(PSB, FSIZE)
    lines = wrap(d, text, f, MAXW)
    lh = FSIZE + 18
    block_h = lh * len(lines)
    pad_x, pad_y = 48, 28
    # 가장 넓은 줄 기준 바 폭
    tw = max(d.textbbox((0, 0), ln, font=f)[2] for ln in lines)
    bar_w = tw + pad_x * 2 + 12
    bar_h = block_h + pad_y * 2
    x0 = CENTER_X - bar_w / 2
    y0 = BOTTOM_Y - bar_h  # 하단 기준
    # 백킹 바 (라운드)
    d.rounded_rectangle([x0, y0, x0 + bar_w, y0 + bar_h], radius=18, fill=BAR)
    # 좌측 청록 액센트 바
    d.rounded_rectangle([x0, y0, x0 + 8, y0 + bar_h], radius=4, fill=ACCENT)
    # 텍스트 (중앙 정렬)
    for i, ln in enumerate(lines):
        lw = d.textbbox((0, 0), ln, font=f)[2]
        d.text((CENTER_X - lw / 2 + 6, y0 + pad_y + i * lh), ln, font=f, fill=FG)
    img.save(out)


def main():
    disp = [l.strip() for l in open(os.path.join(HERE, "narration-display.txt"), encoding="utf-8") if l.strip()]
    caps = json.load(open(os.path.join(HERE, "captions.json")))["captions"]
    n = min(len(disp), len(caps))
    for i in range(n):
        render(disp[i], os.path.join(HERE, f"cap_{i:02d}.png"))
    print(f"rendered {n} caption PNGs (cap_00..cap_{n-1:02d})")


if __name__ == "__main__":
    main()
