// 테스트는 외부 API에 의존하지 않는다. API 키를 비워 airQuality 라우트가 Mock
// 클라이언트를 쓰도록 강제하고, UMAMI 미설정으로 stats가 {0,0}을 반환하게 한다.
// (라우트 모듈이 import 시점에 env를 읽으므로 setupFiles 단계에서 미리 지운다.)
delete process.env.AIR_KOREA_API_KEY
delete process.env.KMA_API_KEY
delete process.env.UMAMI_WEBSITE_ID
// UV_API_KEY는 지우지 않는다 — 코드가 읽지 않는 이름이다. 자외선지수는 공공데이터포털
// 키(AIR_KOREA_API_KEY)를 공용으로 쓴다. 여기서 지우고 있으면 "UV는 별도 키로 켜진다"는
// 잘못된 전제를 테스트 설정이 보증하는 셈이 된다.
