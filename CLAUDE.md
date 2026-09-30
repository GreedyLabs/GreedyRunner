# GreedyRunner 프로젝트 가이드라인

모든 Claude 세션과 에이전트가 따라야 할 공통 규칙입니다.

## 프로젝트 구조

pnpm workspaces 기반 모노레포입니다.

```
GreedyRunner/
  frontend/            # @greedy-runner/frontend — React 18 + TypeScript + Vite + Tailwind CSS
    src/
      presentation/    # 페이지·컴포넌트·레이아웃
      application/     # 커스텀 훅 (프론트엔드의 훅은 전부 여기에 둔다)
      domain/          # 타입 정의
      infrastructure/  # 백엔드 API 클라이언트
      lib/             # 순수 함수 (등급 분류·팁·SEO·포맷)
  backend/             # @greedy-runner/backend  — Node.js + Express + TypeScript
    src/
      api/             # 라우트 핸들러
      domain/          # 엔티티 + 유즈케이스 (러닝 지수 알고리즘)
      infrastructure/  # 외부 Open API 클라이언트
      schemas/         # Zod 요청 검증
  package.json         # 루트 워크스페이스 (scripts 정의)
  pnpm-workspace.yaml  # 워크스페이스 패키지 선언
  running-index-algorithm.md   # 점수 계산의 기준 문서
  CLAUDE.md
  .gitignore
```

## 기술 스택

### Frontend (`frontend/`)
- **프레임워크:** React 18, TypeScript 5.x, Vite 5.x
- **라우팅:** react-router-dom 7
- **상태 관리:** 직접 만든 훅(`src/application/hooks/`). **데이터 페칭 라이브러리를 쓰지 않는다.**
  - TanStack Query·Zustand를 도입하지 않기로 결정했다. 따라서 요청 취소·순서 보증·캐시
    공유는 훅 안에서 직접 구현한다 — 새 훅을 만들 때 아래 세 가지를 빠뜨리지 말 것:
    1. 시퀀스 가드 (`latestRequestRef`) — 늦게 온 옛 응답이 최신 화면을 덮지 않게
    2. `AbortController` — 버려질 요청이 상류 호출 한도를 태우지 않게
    3. 캐시가 필요하면 **모듈 스코프**에 둔다 (`useRef`에 두면 훅 인스턴스마다 갈라진다)
  - 참고 구현: `useAirQuality.ts`, `useRegionSearch.ts`
- **스타일링:** Tailwind CSS 3.x (`darkMode: 'class'`, 색은 `index.css`의 CSS 변수로만 정의)
- **PWA:** vite-plugin-pwa (generateSW). 라우트는 빌드 시 프리렌더된다.
- **테스트:** Vitest. 컴포넌트 테스트·e2e는 없다 (React Testing Library·Playwright 미설치)

### Backend (`backend/`)
- **런타임:** Node.js + TypeScript
- **프레임워크:** Express
- **유효성 검사:** Zod
- **개발 서버:** tsx (watch 모드)
- **테스트:** Jest + Supertest
- **린트:** ESLint (flat config, `eslint.config.mjs`). `no-explicit-any`는 오류다.
- **런타임:** Node >= 20 (전역 `fetch` 의존)

## 모든 에이전트가 따라야 할 공통 규칙

1. **타입 안정성:** 모든 코드에 TypeScript 타입 정의, `any` 사용 금지
2. **코드 품질:** ESLint 및 Prettier 규칙 준수
3. **접근성:** WCAG 2.1 AA 기준 준수
4. **테스트:** 새로운 기능에 대한 테스트 작성. push 전에 루트에서 `pnpm run verify`를 돌린다
   (타입 검사 + 린트 + 양쪽 패키지 테스트). CI도 같은 명령을 게이트로 쓴다.
5. **문서화:** 복잡한 로직에 대한 주석 및 문서
6. **Git 워크플로우:** 의미 있는 커밋 메시지, feature 브랜치 사용
7. **상류 Open API 호출:** 반드시 `infrastructure/apiClients/openApiResponse.ts`의
   `fetchOpenApi` + `assertOpenApiOk`를 거친다. `fetch` → `res.json()`을 직접 쓰지 말 것 —
   공공데이터포털은 HTTP 200에 XML 에러 봉투를 돌려주므로 `res.json()`이 던지거나
   `json.response.header`가 TypeError를 낸다.
8. **결측값:** 측정값의 `null`은 "측정 불가"이고 `0`은 "실제 청정값"이다. 절대 `0`으로
   폴백하지 말 것 — 점수가 100점에 가까워지는 심각한 왜곡이 생긴다.

## 파일 명명 규칙

### Frontend
| 구분 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 | PascalCase | `UserProfile.tsx` |
| 훅 | camelCase + use 접두사 | `useAuth.ts` |
| 유틸리티 | camelCase | `formatDate.ts` |
| 상수 | UPPER_SNAKE_CASE | `API_BASE_URL` |
| 테스트 | 동일 이름 + `.test` | `UserProfile.test.tsx` |

> 훅은 `src/application/hooks/`에만 둔다. `src/hooks/`를 새로 만들지 말 것.

### Backend
| 구분 | 규칙 | 예시 |
|---|---|---|
| 파일 | camelCase | `airQuality.ts` |
| 인터페이스/타입 | PascalCase | `AirQualityMetrics` |
| 함수/변수 | camelCase | `getRunningIndex` |
| 상수 | UPPER_SNAKE_CASE | `REGION_BASE` |
| 라우터 | camelCase + Router 접미사 | `airQualityRouter` |
| 테스트 | 동일 이름 + `.test` | `airQuality.test.ts` |

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/v1/air-quality/search?q=강남` | 지역 검색 → `Region[]` |
| GET | `/api/v1/air-quality/by-coords?lat=&lng=` | 좌표 → 가장 가까운 측정소 `Region` |
| GET | `/api/v1/air-quality/:regionId?lat=&lng=` | 대기질 + 러닝 지수. 좌표는 선택이지만 **쌍으로** 줘야 한다(하나만 주면 400) |
| GET | `/api/v1/stats/visitors` | 방문자 수 (Umami) |
| GET | `/health` | 헬스체크 |
| GET | `/docs` | Swagger |

`regionId` 형식은 두 가지다 — `tm:{tmX}:{tmY}`(검색 결과)와 `station:{측정소명}`(좌표 조회 결과).
mock 클라이언트도 같은 형식을 쓴다. 오류 응답은 원인별로 나뉜다: 429(호출 한도 초과),
500(서비스키 설정), 503(자료 미발표), 502(상류 장애), 504(응답 지연), 404(지역 없음).

## 프로젝트 시작하기

```bash
# 루트에서 전체 의존성 설치
pnpm install

# 동시 실행 (frontend + backend)
pnpm dev

# 개별 실행
pnpm frontend:dev    # http://localhost:5173
pnpm backend:dev     # http://localhost:8000

# 빌드
pnpm build           # 전체 빌드
pnpm frontend:build
pnpm backend:build

# 검증 (push 전에 반드시)
pnpm run verify      # typecheck + lint + test (양쪽 패키지)
pnpm run typecheck
pnpm run lint
pnpm run test
```

## Mock → 실제 API 전환 포인트

- **Backend:** `backend/src/infrastructure/apiClients/mockAirQualityClient.ts`
  — `AIR_KOREA_API_KEY` 미설정 시 자동으로 실제 클라이언트 대신 사용됨 ([airQuality.ts](backend/src/api/v1/routes/airQuality.ts))
- **mock은 실 클라이언트와 같은 계약을 지켜야 한다.** regionId 형식, `hourlyForecast[0]`이
  현재 시각 바인 것, `bestRunningHours`의 점수 내림차순, `getRunningIndex`에 `hour`를 넘기는 것.
  계약이 갈리면 로컬과 테스트가 운영에 없는 동작을 검증하게 된다.
  (`mockAirQualityClient.test.ts`가 이 계약을 고정한다)
- mock 모드는 화면만으로 구분되지 않는다 — 기동 로그의
  `[air-quality] AIR_KOREA_API_KEY 미설정 → Mock 데이터 사용`으로 확인한다.
- 프론트엔드는 항상 백엔드 API(`airQualityApi.ts`)를 통해 데이터를 받으며, 별도 mock 레이어는 두지 않는다.
  러닝 지수 알고리즘은 `backend/src/domain/useCases/getRunningIndex.ts` **한 곳에서만** 관리된다.
  점수의 기준 문서는 [running-index-algorithm.md](running-index-algorithm.md)이고,
  `getRunningIndex.test.ts`의 '문서 고정' 블록이 문서의 수치를 값으로 붙들고 있다 —
  알고리즘을 바꾸면 문서와 그 테스트를 함께 고친다.

## 참고 리소스

- [React 공식 문서](https://react.dev)
- [Express 공식 문서](https://expressjs.com)
- [Zod 문서](https://zod.dev)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
