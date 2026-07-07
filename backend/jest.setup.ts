// 테스트는 외부 API에 의존하지 않는다. API 키를 비워 airQuality 라우트가 Mock
// 클라이언트를 쓰도록 강제하고, UMAMI 미설정으로 stats가 {0,0}을 반환하게 한다.
// (라우트 모듈이 import 시점에 env를 읽으므로 setupFiles 단계에서 미리 지운다.)
delete process.env.AIR_KOREA_API_KEY
delete process.env.KMA_API_KEY
delete process.env.UV_API_KEY
delete process.env.UMAMI_WEBSITE_ID
