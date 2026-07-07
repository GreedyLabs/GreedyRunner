import {
  SearchQuerySchema,
  CoordsQuerySchema,
  RegionIdParamSchema,
  RegionIdQuerySchema,
} from './airQuality'

describe('SearchQuerySchema', () => {
  it('검색어가 있으면 통과한다', () => {
    const r = SearchQuerySchema.safeParse({ q: '강남' })
    expect(r.success).toBe(true)
  })

  it('빈 검색어는 거부한다', () => {
    const r = SearchQuerySchema.safeParse({ q: '' })
    expect(r.success).toBe(false)
  })

  it('q가 없으면 거부한다', () => {
    const r = SearchQuerySchema.safeParse({})
    expect(r.success).toBe(false)
  })
})

describe('CoordsQuerySchema', () => {
  it('문자열 좌표를 숫자로 변환(coerce)한다', () => {
    const r = CoordsQuerySchema.safeParse({ lat: '37.5', lng: '127.0' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.lat).toBe(37.5)
      expect(r.data.lng).toBe(127.0)
    }
  })

  it('위도 범위(-90~90)를 벗어나면 거부한다', () => {
    expect(CoordsQuerySchema.safeParse({ lat: '91', lng: '127' }).success).toBe(false)
    expect(CoordsQuerySchema.safeParse({ lat: '-91', lng: '127' }).success).toBe(false)
  })

  it('경도 범위(-180~180)를 벗어나면 거부한다', () => {
    expect(CoordsQuerySchema.safeParse({ lat: '37', lng: '181' }).success).toBe(false)
  })

  it('숫자로 변환할 수 없는 값은 거부한다', () => {
    expect(CoordsQuerySchema.safeParse({ lat: 'abc', lng: '127' }).success).toBe(false)
  })
})

describe('RegionIdParamSchema', () => {
  it('비어 있지 않은 regionId는 통과한다', () => {
    expect(RegionIdParamSchema.safeParse({ regionId: 'seoul-gangnam' }).success).toBe(true)
  })

  it('빈 regionId는 거부한다', () => {
    expect(RegionIdParamSchema.safeParse({ regionId: '' }).success).toBe(false)
  })
})

describe('RegionIdQuerySchema (선택적 좌표)', () => {
  it('좌표를 coerce하여 통과한다', () => {
    const r = RegionIdQuerySchema.safeParse({ lat: '35.1', lng: '129.0' })
    expect(r.success).toBe(true)
  })

  it('범위를 벗어난 좌표는 거부한다', () => {
    expect(RegionIdQuerySchema.safeParse({ lat: '200', lng: '129' }).success).toBe(false)
  })
})
