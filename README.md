# Cinematic Interactions — Bedrock Edition

Java 모드 **Cinematic Interactions**에서 영감을 받아 Minecraft **Bedrock Edition**용으로 새로 만든 애드온입니다.
작업대·화로·모루 같은 작업 블록을 사용하면 카메라가 부드럽게 빠지면서 플레이어와 블록을 함께 담는
시네마틱 샷으로 바뀌고, 캐릭터가 블록에 맞는 동작을 합니다. 애니메이션은 다른 플레이어에게도 보입니다.

> 원작 Java 모드의 코드나 에셋은 들어 있지 않고, Bedrock 스크립트 API로 처음부터 다시 구현했습니다.

## 설치

1. [`dist/CinematicInteractions.mcaddon`](dist/CinematicInteractions.mcaddon)을 다운로드해서 실행하면 Minecraft로 가져와집니다.
   (`.mcpack` 두 개를 따로 가져와도 됩니다.)
2. 월드 설정 → **행동 팩**에서 *Cinematic Interactions (BP)*를 켭니다. 리소스 팩은 자동으로 함께 켜집니다.
3. 필요 버전: **Bedrock 1.21.90 이상**. 실험적 기능은 켤 필요 없습니다.

## 지원 블록

| 블록 | 동작 |
| --- | --- |
| 제작대, 베틀, 지도 제작대 | 양손으로 번갈아 작업 |
| 화로, 훈연기, 용광로 | 연료를 밀어 넣는 동작 |
| 모루(모든 단계), 대장장이 작업대 | 망치질 |
| 마법부여대 | 양손을 책 위에 띄움 |
| 독서대 | 책을 들고 페이지 넘김 |
| 신호기 | 빛줄기를 올려다보며 손을 듦 |
| 숫돌 | 손잡이 돌리기 |
| 석재 절단기 | 양손으로 돌을 밀기 |
| 양조기 | 젓고 따르기 |
| 주크박스 | 음반 넣기 (약 2.5초) |
| 모닥불, 영혼 모닥불 | 손 녹이기 (약 4초) |

화면(UI)이 열리는 블록은 화면을 닫고 움직이거나 시점을 돌리면 카메라가 플레이어 눈 위치로 부드럽게 돌아옵니다.
웅크린 상태로 클릭하면 연출이 나오지 않습니다. 피해를 입으면 연출이 바로 끝납니다.

## 설정 (채팅 명령어, 치트 필요)

| 명령어 | 설명 |
| --- | --- |
| `/scriptevent ci:toggle` | 연출 켜기/끄기 |
| `/scriptevent ci:style orbit` | 기본: 플레이어 비스듬히 뒤쪽에서 담는 샷 |
| `/scriptevent ci:style shoulder` | 어깨 너머 클로즈업 |
| `/scriptevent ci:style front` | 앞쪽에서 플레이어 얼굴을 담는 샷 |
| `/scriptevent ci:hud` | 연출 중 HUD 숨기기 켜기/끄기 |

설정은 플레이어마다 저장됩니다. 카메라는 벽에 막히지 않는 각도를 자동으로 고르고, 맞는 각도가 없으면 어깨 너머 샷으로 바꿉니다.

## Java 버전과 다른 점

Bedrock API에서 할 수 없는 기능은 빠져 있습니다.

- **제작대에 재료가 남는 기능은 없습니다.** Bedrock 스크립트로는 제작 화면 안의 칸을 읽을 수 없습니다.
- **Left Alt 인벤토리 패널은 없습니다.** Bedrock 기본 화면이 그대로 열립니다.
- 1인칭 팔 애니메이션 대신 3인칭 시네마틱 카메라로 전신 동작을 보여 줍니다(내 스킨 그대로 보입니다).
- 화면이 닫혔는지 알려 주는 이벤트가 없어서, 플레이어가 다시 움직이거나 시점을 돌리면 화면이 닫힌 것으로 처리합니다.

## 구조

```
CinematicInteractions_BP/   행동 팩 (scripts/main.js — 카메라·연출 로직)
CinematicInteractions_RP/   리소스 팩 (animations/cinematic.animation.json — 플레이어 애니메이션)
tools/gen_animations.py     애니메이션 JSON 생성
tools/make_icon.py          팩 아이콘 생성
tools/build.py              dist/ 에 .mcpack / .mcaddon 빌드
```

수정한 뒤에는 `python3 tools/gen_animations.py && python3 tools/build.py`로 다시 빌드하세요.
