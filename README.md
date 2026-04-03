# GreedyRunner

대기질과 기상 데이터를 종합하여 **달리기 최적 타이밍**을 안내하는 서비스입니다.

러닝 지수(0~100)를 실시간으로 계산하고, 24시간 타임라인에서 최적의 러닝 시간대를 추천합니다.

## 주요 기능

- **러닝 지수** - PM2.5, PM10, 오존 + 기온, 습도, 강수를 반영한 0~100점 종합 점수
- **24시간 타임라인** - 시간대별 러닝 적합도를 바 차트로 시각화, 시간대 클릭 시 상세 조회
- **대기질 상세** - 4개 오염물질(PM2.5, PM10, O3, NO2)을 6단계로 분류하여 표시
- **지역 검색 & GPS** - 주소 검색 또는 현재 위치 기반 자동 조회
- **최적 시간 추천** - 점수 60점 이상 시간대 중 상위 3개를 자동 추천

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
```

- `AIR_KOREA_API_KEY` - [에어코리아 오픈 API](https://www.data.go.kr/)에서 발급
- `KMA_API_KEY` - [기상청 오픈 API](https://www.data.go.kr/)에서 발급 (기상 데이터 포함 시)

### 설치 및 실행

```bash
# Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173

# Backend
cd backend
npm install
npm run dev        # http://localhost:8000
```

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
├── running-index-algorithm.md         # 러닝 지수 알고리즘 상세 문서
└── CLAUDE.md                          # 개발 가이드라인
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/air-quality/search?q=강남` | 지역 검색 |
| GET | `/api/v1/air-quality/by-coords?lat=&lng=` | 좌표 기반 조회 |
| GET | `/api/v1/air-quality/:regionId` | 지역별 대기질 + 러닝 지수 |
| GET | `/health` | 헬스체크 |
| GET | `/docs` | Swagger API 문서 |

## 러닝 지수 알고리즘

```
점수 = 100 - (대기질 페널티 + 기상 페널티)
```

| 가중치 배분 | 항목 | 비율 |
|-------------|------|------|
| 대기질 (70%) | PM2.5 | 35% |
| | PM10 | 20% |
| | 오존 | 15% |
| 기상 (30%) | 기온 | 15% |
| | 습도 | 10% |
| | 강수 | 5% |

| 점수 | 상태 | 의미 |
|------|------|------|
| 80~100 | 달리기 최적 | 지금 바로 달리세요! |
| 60~79 | 달리기 좋음 | 좋은 환경입니다 |
| 40~59 | 주의 필요 | 짧은 러닝 권장 |
| 20~39 | 달리기 자제 | 실내 운동 권장 |
| 0~19 | 달리기 금지 | 야외 활동 자제 |

> 상세 알고리즘은 [running-index-algorithm.md](running-index-algorithm.md)를 참고하세요.
