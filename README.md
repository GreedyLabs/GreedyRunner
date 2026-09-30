# GreedyRunner

대기질과 기상 데이터를 종합하여 **달리기 최적 타이밍**을 안내하는 서비스입니다.

러닝 지수(0~100)를 실시간으로 계산하고, 24시간 타임라인에서 최적의 러닝 시간대를 추천합니다.

## 주요 기능

- **러닝 지수** - PM2.5, PM10, 오존 + 기온, 습도, 강수를 반영한 0~100점 종합 점수
- **24시간 타임라인** - 시간대별 러닝 적합도를 바 차트로 시각화, 시간대 클릭 시 상세 조회
- **대기질 상세** - 4개 오염물질(PM2.5, PM10, O3, NO2)을 6단계로 분류하여 표시
- **지역 검색 & GPS** - 주소 검색 또는 현재 위치 기반 자동 조회
- **최적 시간 추천** - 점수 60점 이상 시간대 중 상위 3개를 점수 순으로 추천

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript, Zod |
| 대기질 데이터 | 에어코리아 실시간 측정정보 API |
| 기상 데이터 | 기상청 초단기실황 / 단기예보 API |

## 시작하기

### 환경변수 설정

```bash
# backend/.env
PORT=8000
AIR_KOREA_API_KEY=your_key_here   # 필수 - 없으면 mock 데이터로 동작
KMA_API_KEY=your_key_here          # 선택 - 없으면 대기질만으로 점수 계산
CORS_ALLOWED_ORIGINS=              # 선택 - 쉼표로 구분. localhost·사설망·ngrok은 기본 허용
UMAMI_URL=http://umami:3000        # 선택 - 방문자 통계
UMAMI_WEBSITE_ID=                  # 선택 - 비어 있으면 /stats/visitors가 0을 반환
UMAMI_USERNAME=
UMAMI_PASSWORD=
```

- `AIR_KOREA_API_KEY` - [공공데이터포털](https://www.data.go.kr/)에서 발급.
  에어코리아 대기오염정보·측정소정보와 기상청 생활기상지수(자외선)에 **공용으로** 쓴다.
  포털이 주는 두 값 중 **디코딩 키**를 넣어야 한다 — 인코딩 키를 넣으면 이중 인코딩되어
  모든 호출이 `SERVICE_KEY_IS_NOT_REGISTERED`를 받는다(시간이 지나도 회복되지 않는다).
- `KMA_API_KEY` - [기상청 API 허브](https://apihub.kma.go.kr/)에서 발급 (기상 데이터 포함 시).
  공공데이터포털 키와 다른 키다.

> 키가 없으면 백엔드가 기동 로그에 `[air-quality] AIR_KOREA_API_KEY 미설정 → Mock 데이터 사용`을
> 남기고 mock 클라이언트로 동작한다. 그럴듯한 숫자가 나오므로 화면만으로는 구분되지 않는다 —
> 실제 데이터가 나오지 않으면 이 로그를 먼저 확인할 것.

### 설치 및 실행

```bash
# Frontend
cd frontend
pnpm install
pnpm run dev        # http://localhost:5173

# Backend
cd backend
pnpm install
pnpm run dev        # http://localhost:8000
```

### 검증

```bash
pnpm run verify     # 타입 검사 + 린트 + 테스트 (양쪽 패키지)
```

CI(`.github/workflows/deploy.yml`)도 같은 명령을 게이트로 씁니다 — 통과하지 않으면
빌드·배포가 진행되지 않습니다.

> API 키 없이도 mock 데이터로 전체 기능을 확인할 수 있습니다.

## 프로젝트 구조

```
GreedyRunner/
├── frontend/                          # React SPA
│   └── src/
│       ├── presentation/              # 페이지 & 컴포넌트
│       ├── application/               # 커스텀 훅
│       ├── domain/                    # 타입 정의 & 비즈니스 로직
│       └── infrastructure/            # API 클라이언트
├── backend/                           # Express API 서버
│   └── src/
│       ├── api/                       # 라우트 핸들러
│       ├── domain/                    # 엔티티 & 유즈케이스
│       ├── infrastructure/            # 외부 API 클라이언트
│       └── schemas/                   # Zod 유효성 검사
├── running-index-algorithm.md         # 러닝 지수 알고리즘 상세 문서 (점수 계산의 기준 문서)
├── backend/measuring-station-api.md   # 에어코리아 Open API 요청 규격
└── CLAUDE.md                          # 개발 가이드라인
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/air-quality/search?q=강남` | 지역 검색 |
| GET | `/api/v1/air-quality/by-coords?lat=&lng=` | 좌표 기반 조회 |
| GET | `/api/v1/air-quality/:regionId?lat=&lng=` | 지역별 대기질 + 러닝 지수 (좌표를 주면 기상·자외선 포함) |
| GET | `/api/v1/stats/visitors` | 방문자 수 (Umami 연동, 미설정 시 0) |
| GET | `/health` | 헬스체크 |
| GET | `/docs` | Swagger API 문서 |

## 러닝 지수 알고리즘

```
점수 = 100 - (대기질 페널티 + 기상 페널티)
```

| 가중치 배분 | 항목 | 자외선 있음 | 자외선 없음 |
|-------------|------|------|------|
| 대기질 (70%) | PM2.5 | 35% | 35% |
| | PM10 | 20% | 20% |
| | 오존 | 15% | 15% |
| 기상 (30%) | 기온 | 10% | 12% |
| | 습도 | 5% | 8% |
| | 풍속 | 5% | 5% |
| | 강수 | 5% | 5% |
| | 자외선 | 5% | — |

기상 데이터(`KMA_API_KEY`)가 없으면 대기질만으로 계산합니다 (PM2.5 50%, PM10 30%, 오존 20%).
가중 합산 외에 복합 악화 보정, 강수·습열 강제 감점, 극단값 상한, 야간 감점이 함께 적용됩니다.

| 점수 | 상태 | 의미 |
|------|------|------|
| 80~100 | 달리기 최적 | 지금 바로 달리세요! |
| 60~79 | 달리기 좋음 | 좋은 환경입니다 |
| 40~59 | 주의 필요 | 짧은 러닝 권장 |
| 20~39 | 달리기 자제 | 실내 운동 권장 |
| 0~19 | 달리기 금지 | 야외 활동 자제 |

> 상세 알고리즘은 [running-index-algorithm.md](running-index-algorithm.md)를 참고하세요.
