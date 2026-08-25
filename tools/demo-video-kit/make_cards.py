#!/usr/bin/env python3
"""타이틀/아웃트로 카드 렌더 (1920x1080, GitHub 다크 + 청록 액센트).
ffmpeg가 libfreetype 없이 빌드돼 drawtext 불가 → Pillow로 직접 렌더.
출력: <demo>/card_title.png, <demo>/card_outro.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080
BG = (13, 17, 23)        # #0d1117 GitHub dark
ACCENT = (54, 197, 209)  # #36c5d1 cyan (ctl 터미널 톤)
FG = (230, 237, 243)     # #e6edf3
MUTED = (139, 148, 158)  # #8b949e

MONO = "/System/Library/Fonts/Monaco.ttf"
PSB = "/Users/family/Library/Fonts/Pretendard-SemiBold.otf"
PM = "/Users/family/Library/Fonts/Pretendard-Medium.otf"


def font(path, size):
    return ImageFont.truetype(path, size)


def ctext(d, y, text, f, fill):
    w = d.textbbox((0, 0), text, font=f)[2]
    d.text(((W - w) / 2, y), text, font=f, fill=fill)


def cline(d, y, w, h=4, color=ACCENT):
    d.rectangle([(W - w) / 2, y, (W + w) / 2, y + h], fill=color)


def title_card(out):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    ctext(d, 330, "unityctl", font(MONO, 150), (255, 255, 255))
    cline(d, 540, 360)
    ctext(d, 600, "AI에게 Unity를 다룰 손을 준다", font(PSB, 58), FG)
    ctext(d, 700, "사람 손 없이 — AI가 Unity 로봇을 직접 조작한다", font(PM, 34), MUTED)
    img.save(out)
    print("title ->", out)


def outro_card(out):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    ctext(d, 330, "unityctl", font(MONO, 130), (255, 255, 255))
    cline(d, 520, 360)
    ctext(d, 580, "MIT 오픈소스 · 170+ 명령 · 887 테스트 · 3-OS CI", font(PSB, 46), FG)
    ctext(d, 680, "AI와 로보틱스, 게임 개발이 만나는 자리", font(PM, 34), MUTED)
    img.save(out)
    print("outro ->", out)


if __name__ == "__main__":
    title_card(os.path.join(HERE, "card_title.png"))
    outro_card(os.path.join(HERE, "card_outro.png"))
