#!/usr/bin/env python3
"""최종 합성: 타이틀(2.5s) + 본편(footage+자막+내레이션) + 아웃트로(2.5s) + BGM.
ffmpeg가 drawtext/ass 불가 → 자막은 미리 렌더한 cap_NN.png를 overlay.
filter_complex를 코드로 생성(자막 10개 + concat + 오디오 믹스).

사용: python3 compose.py <footage.mp4> [bgm.mp3] [out.mp4]
"""
import os, sys, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
FOOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "robot_smooth_raw.mp4")
BGM = sys.argv[2] if len(sys.argv) > 2 else "/Users/family/jason/vibehub-media/assets/bgm/05-bright-tech.mp3"
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "unityctl_demo_final.mp4")
TITLE = os.path.join(HERE, "card_title.png")
OUTRO = os.path.join(HERE, "card_outro.png")
NARR = os.path.join(HERE, "narration.wav")
W, H, FPS = 1920, 1080, 30
T_TITLE, T_OUTRO = 2.5, 2.5
BG = "0x0d1117"


def probe_dur(p):
    out = subprocess.check_output(["ffprobe", "-v", "quiet", "-show_entries",
                                   "format=duration", "-of", "csv=p=0", p]).decode().strip()
    return float(out)


def main():
    caps = json.load(open(os.path.join(HERE, "captions.json")))["captions"]
    body = probe_dur(NARR) + 0.4  # 내레이션 끝 약간 여유
    total = T_TITLE + body + T_OUTRO
    ncap = sum(1 for i in range(len(caps)) if os.path.exists(os.path.join(HERE, f"cap_{i:02d}.png")))

    inp = ["-loop", "1", "-t", f"{T_TITLE}", "-i", TITLE,        # 0 title
           "-stream_loop", "-1", "-t", f"{body}", "-i", FOOT,     # 1 footage (loop)
           "-loop", "1", "-t", f"{T_OUTRO}", "-i", OUTRO,         # 2 outro
           "-i", NARR,                                            # 3 narration
           "-stream_loop", "-1", "-t", f"{total}", "-i", BGM]     # 4 bgm
    cap_base = 5
    for i in range(ncap):
        inp += ["-i", os.path.join(HERE, f"cap_{i:02d}.png")]     # 5.. captions

    fc = []
    # title/outro: scale+pad to canvas
    fc.append(f"[0:v]scale={W}:{H},setsar=1,fps={FPS}[v0]")
    fc.append(f"[2:v]scale={W}:{H},setsar=1,fps={FPS}[v2]")
    # footage: contain (fit) + pad with bg, no crop (콘텐츠 보존)
    fc.append(f"[1:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
              f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={BG},setsar=1,fps={FPS}[body0]")
    # overlay captions (timing = caption start/end within body)
    cur = "body0"
    for i in range(ncap):
        c = caps[i]
        nxt = f"bc{i}"
        fc.append(f"[{cur}][{cap_base+i}:v]overlay=0:0:"
                  f"enable='between(t,{c['start']:.3f},{c['end']:.3f})'[{nxt}]")
        cur = nxt
    fc.append(f"[{cur}]trim=0:{body},setpts=PTS-STARTPTS[vbody]")
    # concat title+body+outro
    fc.append(f"[v0][vbody][v2]concat=n=3:v=1:a=0[vout]")
    # audio: narration delayed by title, bgm low + fadeout
    fc.append(f"[3:a]adelay={int(T_TITLE*1000)}|{int(T_TITLE*1000)},apad[narr]")
    fc.append(f"[4:a]volume=0.10,afade=t=in:st=0:d=1,"
              f"afade=t=out:st={total-3:.2f}:d=3[bgm]")
    fc.append(f"[narr][bgm]amix=inputs=2:duration=first:dropout_transition=3,"
              f"atrim=0:{total},loudnorm=I=-15:TP=-1.5:LRA=11[aout]")

    cmd = ["ffmpeg", "-y", *inp, "-filter_complex", ";".join(fc),
           "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-r", str(FPS), "-t", f"{total}", OUT]
    print(f"footage={os.path.basename(FOOT)} body={body:.1f}s total={total:.1f}s caps={ncap}")
    r = subprocess.run(cmd, stderr=subprocess.PIPE)
    if r.returncode != 0:
        sys.stderr.write(r.stderr.decode()[-2000:])
        sys.exit(1)
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
