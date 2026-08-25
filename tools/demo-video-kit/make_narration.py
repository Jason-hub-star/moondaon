#!/usr/bin/env python3
"""줄 단위 내레이션 생성 + 정확한 자막 타이밍.
각 줄을 개별 TTS로 합성→길이 측정→누적 타이밍으로 narration.wav + captions.json + .srt 생성.
텍스트는 원본 그대로(whisper ASR 오인식 회피). 엔진: say(즉시) / jisun(Chatterbox API).

사용: python3 make_narration.py [say|jisun]
출력: <demo>/narration.wav, captions.json, narration.srt
"""
import os, sys, re, subprocess, wave, json, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = sys.argv[1] if len(sys.argv) > 1 else "say"
SRC = os.path.join(HERE, "narration-ko.txt")
GAP = 0.35  # 줄 사이 간격(초)

# 발음 정규화 사전 — TTS가 약어/영문을 잘못 읽는 패턴 차단(예: AI→"아이").
# 자막(display)에는 적용 안 함. 음성용 텍스트에만 적용. 긴 키부터 치환.
PRON = [
    ("unityctl", "유니티 컨트롤"),
    ("Jason-hub-star", "제이슨 허브 스타"),
    ("github", "깃허브"),
    ("Unity", "유니티"),
    ("MIT", "엠아이티"),
    ("API", "에이피아이"), ("CLI", "씨엘아이"), ("IPC", "아이피씨"),
    ("CI", "씨아이"), ("OS", "오에스"), ("UI", "유아이"),
    ("FR5", "에프알 오"), ("3D", "삼디"), ("2D", "이디"),
    ("AI", "에이아이"),
    ("com", "컴"),
]


def normalize_pron(text):
    """약어/영문을 한국어 음차로 치환. 한글 조사 인접(AI가)도 처리, 단어 내부는 보존."""
    for k, v in PRON:
        # 앞뒤가 영문/숫자가 아닐 때만 치환(단어 경계). 한글 조사·문장부호 인접은 매칭.
        text = re.sub(r"(?<![A-Za-z0-9])" + re.escape(k) + r"(?![A-Za-z0-9])", v, text)
    return text


def dur_wav(p):
    with wave.open(p) as w:
        return w.getnframes() / w.getframerate()


def tts_say(text, out):
    aiff = out + ".aiff"
    subprocess.run(["say", "-v", "Yuna", "-o", aiff, text], check=True)
    subprocess.run(["ffmpeg", "-y", "-i", aiff, "-ar", "24000", "-ac", "1", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(aiff)


def tts_jisun(text, out):
    body = json.dumps({"text": text, "voice_name": "jisun", "language": "ko",
                       "temperature": 0.8, "exaggeration": 0.5}).encode()
    req = urllib.request.Request("http://localhost:7693/api/chatterbox/generate",
                                 data=body, headers={"Content-Type": "application/json"})
    resp = json.load(urllib.request.urlopen(req, timeout=180))
    url = resp.get("audio_url")
    if not url:
        raise RuntimeError(f"no audio_url: {resp}")
    raw = out + ".raw.wav"
    urllib.request.urlretrieve("http://localhost:7693" + url, raw)
    subprocess.run(["ffmpeg", "-y", "-i", raw, "-ar", "24000", "-ac", "1", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.remove(raw)


def srt_ts(t):
    h = int(t // 3600); m = int((t % 3600) // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def main():
    lines = [l.strip() for l in open(SRC, encoding="utf-8") if l.strip()]
    tts = tts_say if ENGINE == "say" else tts_jisun
    parts, caps, t = [], [], 0.0
    for i, line in enumerate(lines):
        p = os.path.join(HERE, f".line_{i:02d}.wav")
        tts(normalize_pron(line), p)   # 음성: 발음 정규화 적용
        d = dur_wav(p)
        caps.append({"i": i, "text": line, "start": round(t, 3), "end": round(t + d, 3)})
        parts.append(p); t += d + GAP
    # concat (gap 무음 삽입)
    listf = os.path.join(HERE, ".concat.txt")
    sil = os.path.join(HERE, ".sil.wav")
    subprocess.run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=24000:cl=mono",
                    "-t", str(GAP), sil], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    with open(listf, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\nfile '{sil}'\n")
    raw = os.path.join(HERE, ".narration_raw.wav")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listf, "-c", "copy", raw],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    out = os.path.join(HERE, "narration.wav")
    subprocess.run(["ffmpeg", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "24000", "-ac", "1", out],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    json.dump({"engine": ENGINE, "captions": caps, "duration": round(t, 3)},
              open(os.path.join(HERE, "captions.json"), "w"), ensure_ascii=False, indent=2)
    with open(os.path.join(HERE, "narration.srt"), "w", encoding="utf-8") as f:
        for n, c in enumerate(caps, 1):
            f.write(f"{n}\n{srt_ts(c['start'])} --> {srt_ts(c['end'])}\n{c['text']}\n\n")
    # cleanup temp
    for p in parts + [listf, sil, raw]:
        try: os.remove(p)
        except OSError: pass
    print(f"engine={ENGINE} lines={len(lines)} duration={t:.1f}s -> narration.wav, captions.json, narration.srt")


if __name__ == "__main__":
    main()
