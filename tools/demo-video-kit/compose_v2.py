#!/usr/bin/env python3
"""최종 합성 v2 — 좌측 ctl 터미널 + 우측 로봇 3D(크롭) 2단 레이아웃.
타이틀 + 본편(로봇 크롭 우측 + 터미널 단계노출 좌측 + 자막 우측하단) + 아웃트로 + 내레이션 + BGM.
자막 PNG는 우측정렬(CAP_CENTER_X=1320)로 미리 렌더되어 있어야 함.

사용: python3 compose_v2.py <robot_seq.mp4> [bgm.mp3] [out.mp4]
"""
import os, sys, json, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
FOOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "robot_seq3.mp4")
BGM = sys.argv[2] if len(sys.argv) > 2 else "/Users/family/jason/vibehub-media/assets/bgm/05-bright-tech.mp3"
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "unityctl_demo_jisun.mp4")
TITLE = os.path.join(HERE, "card_title.png")
OUTRO = os.path.join(HERE, "card_outro.png")
NARR = os.path.join(HERE, "narration.wav")
W, H, FPS = 1920, 1080, 30
T_TITLE, T_OUTRO = 2.5, 2.5
BG = "0x0d1117"
# 로봇 3D 크롭(robot_seq 1920x1206 기준) + 우측 배치
CROP = "710:1007:96:157"     # w:h:x:y (x5%~42%, y13%~96.5%)
ROB_H = 900                  # 배치 높이
ROB_Y = 20
# 터미널 7상태 노출 시작시각(본편 t 기준; 시퀀스 전환 ~18s에 맞춤)
TERM_TS = [0.0, 1.5, 3.0, 5.0, 6.5, 18.0, 19.5]


def probe_dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "quiet", "-show_entries",
                  "format=duration", "-of", "csv=p=0", p]).decode().strip())


def main():
    caps = json.load(open(os.path.join(HERE, "captions.json")))["captions"]
    body = probe_dur(NARR) + 0.4
    total = T_TITLE + body + T_OUTRO
    nterm = sum(1 for i in range(len(TERM_TS)) if os.path.exists(os.path.join(HERE, f"term_{i:02d}.png")))
    ncap = sum(1 for i in range(len(caps)) if os.path.exists(os.path.join(HERE, f"cap_{i:02d}.png")))
    rob_w = int(round(710 * ROB_H / 1007 / 2) * 2)
    rob_x = 736 + (W - 736 - rob_w) // 2   # 우측 영역 중앙

    inp = ["-loop", "1", "-t", f"{T_TITLE}", "-i", TITLE,
           "-stream_loop", "-1", "-t", f"{body}", "-i", FOOT,
           "-loop", "1", "-t", f"{T_OUTRO}", "-i", OUTRO,
           "-i", NARR,
           "-stream_loop", "-1", "-t", f"{total}", "-i", BGM]
    term_base = 5
    for i in range(nterm):
        inp += ["-loop", "1", "-t", f"{body}", "-i", os.path.join(HERE, f"term_{i:02d}.png")]
    cap_base = term_base + nterm
    for i in range(ncap):
        inp += ["-loop", "1", "-t", f"{body}", "-i", os.path.join(HERE, f"cap_{i:02d}.png")]

    fc = []
    fc.append(f"color=c={BG}:s={W}x{H}:d={body},fps={FPS}[bg]")
    fc.append(f"[0:v]scale={W}:{H},setsar=1,fps={FPS}[v0]")
    fc.append(f"[2:v]scale={W}:{H},setsar=1,fps={FPS}[v2]")
    # 로봇: 크롭 → 스케일 → 우측 배치
    fc.append(f"[1:v]crop={CROP},scale={rob_w}:{ROB_H},setsar=1,fps={FPS}[rob]")
    fc.append(f"[bg][rob]overlay={rob_x}:{ROB_Y}[b0]")
    cur = "b0"
    # 터미널 단계 노출
    for i in range(nterm):
        t0 = TERM_TS[i]
        t1 = TERM_TS[i + 1] if i + 1 < nterm else body
        nxt = f"t{i}"
        fc.append(f"[{cur}][{term_base+i}:v]overlay=0:0:enable='between(t,{t0:.2f},{t1:.2f})'[{nxt}]")
        cur = nxt
    # 자막 노출
    for i in range(ncap):
        c = caps[i]
        nxt = f"c{i}"
        fc.append(f"[{cur}][{cap_base+i}:v]overlay=0:0:enable='between(t,{c['start']:.3f},{c['end']:.3f})'[{nxt}]")
        cur = nxt
    fc.append(f"[{cur}]trim=0:{body},setpts=PTS-STARTPTS[vbody]")
    fc.append(f"[v0][vbody][v2]concat=n=3:v=1:a=0[vout]")
    fc.append(f"[3:a]adelay={int(T_TITLE*1000)}|{int(T_TITLE*1000)},apad[narr]")
    fc.append(f"[4:a]volume=0.10,afade=t=in:st=0:d=1,afade=t=out:st={total-3:.2f}:d=3[bgm]")
    fc.append(f"[narr][bgm]amix=inputs=2:duration=first:dropout_transition=3,"
              f"atrim=0:{total},loudnorm=I=-15:TP=-1.5:LRA=11[aout]")

    cmd = ["ffmpeg", "-y", *inp, "-filter_complex", ";".join(fc),
           "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-r", str(FPS), "-t", f"{total}", OUT]
    print(f"robot={os.path.basename(FOOT)} body={body:.1f}s total={total:.1f}s term={nterm} caps={ncap} rob={rob_w}x{ROB_H}@{rob_x}")
    r = subprocess.run(cmd, stderr=subprocess.PIPE)
    if r.returncode != 0:
        sys.stderr.write(r.stderr.decode()[-2500:]); sys.exit(1)
    print("OK ->", OUT)


if __name__ == "__main__":
    main()
