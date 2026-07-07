import request from 'supertest'
import app from './app'

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
    expect(res.body.id).toBe('seoul-gangnam')
  })
})

describe('GET /api/v1/air-quality/:regionId', () => {
  it('200과 러닝 지수·24시간 예보를 반환한다', async () => {
    const res = await request(app).get('/api/v1/air-quality/seoul-gangnam')
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
})
