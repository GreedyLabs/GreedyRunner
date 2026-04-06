# GreedyRunner 프로젝트 가이드라인

모든 Claude 세션과 에이전트가 따라야 할 공통 규칙입니다.

## 프로젝트 구조

```
GreedyRunner/
  frontend/    # React 18 + TypeScript + Vite + Tailwind CSS
  backend/     # Node.js + Express + TypeScript
  CLAUDE.md
  .gitignore
```

## 기술 스택

### Frontend (`frontend/`)
- **프레임워크:** React 18, TypeScript 5.x, Vite 5.x
- **상태 관리:** TanStack Query, Zustand
- **스타일링:** Tailwind CSS 3.x
- **테스트:** Vitest, React Testing Library, Playwright

### Backend (`backend/`)
- **런타임:** Node.js + TypeScript
- **프레임워크:** Express
- **유효성 검사:** Zod
- **개발 서버:** tsx (watch 모드)
- **테스트:** Jest + Supertest

## 모든 에이전트가 따라야 할 공통 규칙

1. **타입 안정성:** 모든 코드에 TypeScript 타입 정의, `any` 사용 금지
2. **코드 품질:** ESLint 및 Prettier 규칙 준수
3. **접근성:** WCAG 2.1 AA 기준 준수
4. **테스트:** 새로운 기능에 대한 테스트 작성
5. **문서화:** 복잡한 로직에 대한 주석 및 문서
6. **Git 워크플로우:** 의미 있는 커밋 메시지, feature 브랜치 사용

## 파일 명명 규칙

### Frontend
| 구분 | 규칙 | 예시 |
|---|---|---|
| 컴포넌트 | PascalCase | `UserProfile.tsx` |
| 훅 | camelCase + use 접두사 | `useAuth.ts` |
| 유틸리티 | camelCase | `formatDate.ts` |
| 상수 | UPPER_SNAKE_CASE | `API_BASE_URL` |
| 테스트 | 동일 이름 + `.test` | `UserProfile.test.tsx` |

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
| GET | `/api/v1/air-quality/search?q=강남` | 지역 검색 |
| GET | `/api/v1/air-quality/by-coords?lat=&lng=` | 좌표 기반 조회 |
| GET | `/api/v1/air-quality/:regionId` | 지역 ID 기반 조회 |
| GET | `/health` | 헬스체크 |

## 프로젝트 시작하기

```bash
# Frontend
cd frontend
pnpm install
pnpm run dev        # http://localhost:5173

# Backend
cd backend
pnpm install
pnpm run dev    # http://localhost:8000
```

## Mock → 실제 API 전환 포인트

- **Frontend:** `frontend/src/infrastructure/api/mockAirQualityApi.ts`
- **Backend:** `backend/src/infrastructure/apiClients/mockAirQualityClient.ts`

## 참고 리소스

- [React 공식 문서](https://react.dev)
- [Express 공식 문서](https://expressjs.com)
- [Zod 문서](https://zod.dev)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
