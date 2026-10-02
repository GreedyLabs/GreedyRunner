import request from 'supertest'
import app from './app'
import { swaggerDocument } from './swagger'
import * as mockClient from './infrastructure/apiClients/mockAirQualityClient'

// jest.setup.ts가 API 키를 비우므로 airQuality 라우트는 Mock 클라이언트를 사용한다.
// 따라서 네트워크 없이 결정적으로 동작한다.

describe('GET /health', () => {
  it('200과 {status:ok}를 반환한다', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('GET /api/v1/air-quality/search', () => {
  it('q가 없으면 400', async () => {
    const res = await request(app).get('/api/v1/air-quality/search')
    expect(res.status).toBe(400)
    expect(res.body.error).toBeDefined()
  })

  it('q가 있으면 200과 results 배열', async () => {
    const res = await request(app).get('/api/v1/air-quality/search').query({ q: '강남' })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.results)).toBe(true)
    expect(res.body.results[0].shortName).toBe('강남구')
  })
})

describe('GET /api/v1/air-quality/by-coords', () => {
  it('좌표가 없으면 400', async () => {
    const res = await request(app).get('/api/v1/air-quality/by-coords')
    expect(res.status).toBe(400)
  })

  it('범위를 벗어난 좌표는 400', async () => {
    const res = await request(app).get('/api/v1/air-quality/by-coords').query({ lat: 999, lng: 127 })
    expect(res.status).toBe(400)
  })

  it('유효한 좌표는 200과 가장 가까운 지역', async () => {
    const res = await request(app).get('/api/v1/air-quality/by-coords').query({ lat: 37.5172, lng: 127.0473 })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe('station:강남구')
  })
})

describe('GET /api/v1/air-quality/:regionId', () => {
  it('200과 러닝 지수·24시간 예보를 반환한다', async () => {
    const res = await request(app).get(`/api/v1/air-quality/${encodeURIComponent('station:강남구')}`)
    expect(res.status).toBe(200)
    expect(res.body.regionName).toBe('서울 강남구')
    expect(res.body.hourlyForecast).toHaveLength(24)
    expect(res.body.current.runningIndex).toHaveProperty('score')
  })
})

describe('GET /api/v1/stats/visitors', () => {
  it('UMAMI 미설정 시 {today:0,total:0}', async () => {
    const res = await request(app).get('/api/v1/stats/visitors')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ today: 0, total: 0 })
  })
})

describe('알 수 없는 라우트', () => {
  it('정의되지 않은 경로는 404', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')
    expect(res.status).toBe(404)
  })

  // 기본 express 404는 HTML을 돌려주는데, 프론트엔드 apiFetch는 본문을 JSON으로 읽는다.
  // HTML이 오면 "HTTP 404"가 아니라 정체불명의 파싱 오류로 표시됐다.
  it('/api 하위 404는 JSON 본문을 준다', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')
    expect(res.type).toBe('application/json')
    expect(typeof res.body.error).toBe('string')
  })
})

describe('GET /api/v1/air-quality/:regionId 좌표 유효성', () => {
  // 예전에는 좌표 파싱이 실패하면 lat·lng을 둘 다 조용히 버려 200 + weather:'unavailable'을
  // 돌려줬다. 클라이언트 버그가 "기상 API가 간헐적으로 죽는다"처럼 보였다.
  it('lat만 보내면 400', async () => {
    const res = await request(app)
      .get(`/api/v1/air-quality/${encodeURIComponent('station:강남구')}`)
      .query({ lat: 37.5 })
    expect(res.status).toBe(400)
  })

  it('형식이 잘못된 좌표는 400', async () => {
    const res = await request(app)
      .get(`/api/v1/air-quality/${encodeURIComponent('station:강남구')}`)
      .query({ lat: 'abc', lng: '127.0' })
    expect(res.status).toBe(400)
  })

  it('좌표를 아예 안 보내면 200 (좌표는 선택적)', async () => {
    const res = await request(app).get(`/api/v1/air-quality/${encodeURIComponent('station:강남구')}`)
    expect(res.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// swagger 문서와 실제 응답의 드리프트 감지.
//
// swagger.ts는 손으로 쓴 객체라 응답 타입이 바뀌어도 컴파일러가 잡아 주지 않는다.
// 실제로 응답이 currentAirQuality/currentRunningIndex에서 current{}로 바뀐 뒤에도 문서는
// 옛 필드를 그대로 설명하고 있었고, bestRunningHours도 정수 배열이라고 적혀 있었다.
// 문서만 보고 붙인 클라이언트는 없는 필드를 읽게 된다.
// ─────────────────────────────────────────────────────────────────────────────
describe('swagger 문서 ↔ 실제 응답', () => {
  const GANGNAM = encodeURIComponent('station:강남구')

  it('AirQualityResponse의 속성 집합이 실제 응답의 키와 일치한다', async () => {
    const res = await request(app).get(`/api/v1/air-quality/${GANGNAM}`)
    expect(res.status).toBe(200)

    const documented = Object.keys(swaggerDocument.components.schemas.AirQualityResponse.properties)
    const actual = Object.keys(res.body)

    // 실제 응답의 모든 키가 문서에 있어야 한다 (문서 누락 감지)
    expect(actual.filter((k) => !documented.includes(k))).toEqual([])
    // 문서의 키 중 옵셔널이 아닌 것은 실제 응답에 있어야 한다.
    // stationFallback·serviceStatus.weather는 조건부이므로 제외한다.
    const optional = ['stationFallback']
    expect(documented.filter((k) => !optional.includes(k) && !actual.includes(k))).toEqual([])
  })

  it('current·hourlyForecast·bestRunningHours의 구조가 문서와 일치한다', async () => {
    const res = await request(app).get(`/api/v1/air-quality/${GANGNAM}`)
    const schemas = swaggerDocument.components.schemas

    expect(Object.keys(res.body.current).sort()).toEqual(
      Object.keys(schemas.AirQualityResponse.properties.current.properties)
        .filter((k) => k !== 'weather') // mock은 기상 데이터를 주지 않는다
        .sort()
    )

    const bar = res.body.hourlyForecast[0]
    const documentedBar = Object.keys(schemas.HourlyForecast.properties)
    expect(Object.keys(bar).filter((k) => !documentedBar.includes(k))).toEqual([])

    // bestRunningHours는 정수 배열이 아니라 객체 배열이다.
    expect(schemas.AirQualityResponse.properties.bestRunningHours.items.$ref).toBe(
      '#/components/schemas/BestRunningHour'
    )
    for (const best of res.body.bestRunningHours) {
      expect(Object.keys(best).sort()).toEqual(['hour', 'isNextDay'])
    }
  })

  it('문서화된 모든 경로가 실제로 라우팅된다', async () => {
    const paths = Object.keys(swaggerDocument.paths)
    expect(paths).toContain('/api/v1/stats/visitors')
    for (const path of paths) {
      if (path.includes('{')) continue // 경로 파라미터는 위 테스트가 다룬다
      const res = await request(app).get(path === '/api/v1/air-quality/search' ? `${path}?q=강남` : path)
      expect(res.status).not.toBe(404)
    }
  })
})

describe('CORS', () => {
  it('허용된 origin에는 Access-Control-Allow-Origin을 돌려준다', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('사설망 IP도 허용한다 (모바일 실기기에서 개발 서버 접속)', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://192.168.0.12:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://192.168.0.12:5173')
  })

  it('허용되지 않은 origin에는 헤더를 주지 않는다', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://not-allowed.example.com')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
    // 거부해도 요청 자체는 정상 처리된다 (예전에는 콜백에 Error를 넘겨 HTML 500이 나갔다)
    expect(res.status).toBe(200)
  })

  // Origin은 외부가 정하는 값이라, 거부될 때마다 그대로 기록하면 운영에서 스캐너·봇이
  // 로그를 채운다. 같은 origin은 한 번만 남긴다.
  it('같은 origin의 반복 거부는 한 번만 로그에 남긴다', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const origin = `https://repeat-${Date.now()}.example.com`

    await request(app).get('/health').set('Origin', origin)
    await request(app).get('/health').set('Origin', origin)
    await request(app).get('/health').set('Origin', origin)

    const corsWarnings = warn.mock.calls.filter((args) => String(args[0]).includes('[cors]'))
    expect(corsWarnings).toHaveLength(1)
    warn.mockRestore()
  })

  it('아주 긴 origin은 잘라서 기록한다', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    // Origin 헤더에 쓸 수 있는 문자로만 길게 만든다.
    const origin = `https://long-${Date.now()}-${'a'.repeat(500)}.example.com`

    await request(app).get('/health').set('Origin', origin)

    const line = warn.mock.calls.map((args) => String(args[0])).find((m) => m.includes('[cors]'))
    expect(line).toBeDefined()
    expect(line!.length).toBeLessThan(300)
    expect(line).toContain('생략')
    warn.mockRestore()
  })
})

describe('응답 캐시 TTL', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  /** 캐시는 Date.now()로 만료를 판단하므로 그것만 밀어 시간 경과를 흉내낸다. */
  function advanceClock(ms: number) {
    const target = Date.now() + ms
    jest.spyOn(Date, 'now').mockImplementation(() => target)
  }

  /**
   * 상류 호출 횟수를 직접 센다.
   *
   * 응답의 updatedAt을 비교하는 방식은 쓰지 않는다 — mock이 `new Date()`로 만드는 값이라
   * 두 요청이 같은 밀리초에 들어오면 캐시 적중과 구분되지 않아 테스트가 간헐적으로 통과한다.
   */
  function countUpstreamCalls() {
    return jest.spyOn(mockClient, 'getAirQuality')
  }

  // KMA_API_KEY가 없는 구성(README가 선택으로 둔 정상 구성)에서는 weather가 항상
  // 'unavailable'이다. 이것을 degraded로 묶으면 모든 응답이 1분만 캐싱되어 에어코리아
  // 호출이 5배로 늘어난다 — 호출 한도를 지키려던 캐시가 반대로 한도를 태운다.
  //
  // 90초는 degraded TTL(60초)보다 길고 정상 TTL(5분)보다 짧다.
  it("weather가 'unavailable'이면 60초가 지나도 상류를 다시 타지 않는다", async () => {
    const spy = countUpstreamCalls()
    const path = `/api/v1/air-quality/${encodeURIComponent('station:강남구')}?lat=37.51&lng=127.05`

    const first = await request(app).get(path)
    expect(first.status).toBe(200)
    expect(first.body.serviceStatus.weather).toBe('unavailable')
    expect(first.body.serviceStatus.airKorea).toBe('ok')
    expect(spy).toHaveBeenCalledTimes(1)

    advanceClock(90_000)

    expect((await request(app).get(path)).status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('정상 TTL(5분)이 지나면 상류를 다시 탄다', async () => {
    const spy = countUpstreamCalls()
    const path = `/api/v1/air-quality/${encodeURIComponent('station:마포구')}?lat=37.56&lng=126.90`

    expect((await request(app).get(path)).status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(1)

    advanceClock(6 * 60_000)

    expect((await request(app).get(path)).status).toBe(200)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
