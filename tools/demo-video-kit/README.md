# Demo Video Kit — AI 자율 데모 영상 자동 제작

AI가 **자기 도구(CLI/MCP)로 앱을 구동하며 화면을 캡처**하고, 그 위에 **TTS 내레이션 + 자막 + 타이틀/아웃트로 카드 + BGM**을 얹어 데모 영상을 자동 합성하는 스크립트 묶음.
원본: unityctl(URHYNIX) — "AI가 사람 손 없이 ctl 터미널로 Unity 로봇을 자율 조작" 시연영상. 하네스: `harnesses/ai-demo-video-production.md`.

## 파이프라인
```
앱 구동(자기 도구) ──┐
                    ├─ 화면/창 캡처(프레임) ─ 모션보간 30fps ─ footage
TTS 내레이션 ────────┘                                          │
   ↓ 정확한 자막 타이밍                                          ↓
타이틀/아웃트로 카드 + 자막 PNG + 터미널 패널 ─ ffmpeg 합성 ─ 최종 mp4
```

## 스크립트
| 파일 | 역할 | 출력 |
|---|---|---|
| `make_cards.py` | 타이틀/아웃트로 카드 (다크+액센트, 모노+산세리프) | `card_title.png`, `card_outro.png` |
| `make_narration.py [say\|<api>]` | 줄 단위 TTS → **정확한 자막 타이밍**(ASR 오인식 회피) + 발음정규화 사전 | `narration.wav`, `captions.json`, `*.srt` |
| `make_captions.py` | 자막 PNG 스트립 (로어서드, 표시 텍스트 분리) | `cap_NN.png` |
| `make_terminal.py` | "라이브 입력" 터미널 패널(단계 노출) | `term_NN.png` |
| `compose.py <footage>` | 1단 합성(전체화면 footage) | mp4 |
| `compose_v2.py <footage>` | 2단 합성(좌 터미널 + 우 앱 크롭) | mp4 |
| `record_<app>.sh` | 풀스크린 ffmpeg 녹화(사람이 앱 포커스 유지) | raw mp4 |

## 새 프로젝트에 맞게 바꿀 곳 (파라미터)
- **폰트**: `make_*`의 `MONO`/`PSB`/`PR` 경로 (현재 macOS Monaco + Pretendard). 없으면 설치/교체.
- **브랜드/문구**: `make_cards.py`(제목·태그라인·스탯), `make_terminal.py`의 `BLOCKS`(실제 구동 명령), `narration-ko.txt`(TTS)·`narration-display.txt`(자막).
- **발음 사전**: `make_narration.py`의 `PRON` — 약어 음차(예: `AI→에이아이`). 새 약어는 한 줄 추가.
- **TTS 엔진**: `say`(macOS 내장, 즉시) 또는 클론 TTS API(`tts_jisun` 참고 — MimikaStudio Chatterbox `language:"ko"`). API 주소·voice_name 교체.
- **BGM**: `compose*.py`의 `BGM` 경로 (라이선스 확인된 트랙).
- **앱 구동/캡처**: `record_*.sh`는 대상 앱의 CLI 명령으로 교체. 창 단독 캡처는 `screencapture -l <winID>`(macOS, 포커스 불필요) — winID는 Quartz로 매세션 재탐색.
- **레이아웃(v2)**: `compose_v2.py`의 `CROP`(앱 뷰포트 크롭 w:h:x:y), `ROB_*`(배치), `TERM_TS`(터미널 노출 타이밍), `CAP_CENTER_X`(자막 중심).

## 핵심 발견 (재사용 시 주의)
- **자막 텍스트는 whisper ASR 말고 원본**을 쓴다(TTS를 다시 ASR하면 약어·고유명사 오인식). 타이밍만 줄 단위 TTS 길이로 산출.
- **TTS용 텍스트 ≠ 자막 텍스트**: TTS는 음차(`170→백칠십`, 약어 한글화), 자막은 정식 표기.
- **ffmpeg가 libfreetype/libass 없이 빌드된 환경**이면 `drawtext`/`subtitles` 불가 → 모든 텍스트를 **Pillow PNG로 렌더 후 overlay**(이 kit의 전제).
- **창 단독 캡처 fps가 낮다**(~4-6fps) → `minterpolate=mci`로 30fps 보간(slow CG 모션에 잘 맞음). 빠른 모션엔 풀스크린 네이티브 녹화 권장.
- **내레이션 길이가 타임라인을 결정**. footage는 `-stream_loop`로 본편 길이에 맞춰 루프.
- 원격 데스크톱(NoMachine 등)에선 자동 앱 포커스가 안 먹음 → 사람이 포커스 유지하거나 창 단독 캡처로 우회.

## 의존성
`python3`(Pillow), `ffmpeg`, 폰트(모노+한글 산세리프), TTS(`say` 또는 클론 API), (자막 SRT 검증용) whisper-cpp. BGM 트랙.
