import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 프론트엔드·백엔드 도메인 타입의 드리프트 감지.
 *
 * 두 패키지가 같은 API 계약을 **각자 손으로** 선언하고 있다. 공유 패키지도 생성 단계도
 * 없어서, 한쪽 필드를 고치면 다른 쪽은 컴파일러가 아무 말도 하지 않는다. 지금은 두 파일이
 * 일치하지만(precipitation 별칭과 serviceStatus 옵셔널만 의도적으로 다름), 갈라지는 순간
 * 프론트엔드는 오지 않는 필드를 읽거나 오는 필드를 무시하게 된다.
 *
 * 공유 패키지를 만드는 것이 근본 해결이지만, 그 전까지는 이 테스트가 갈림을 잡는다.
 */
const FRONTEND_TYPES = join(__dirname, '../../../../frontend/src/domain/entities/airQuality.types.ts')
const BACKEND_TYPES = join(__dirname, 'airQuality.ts')
const FRONTEND_REGION = join(__dirname, '../../../../frontend/src/domain/entities/region.types.ts')
const BACKEND_REGION = join(__dirname, 'region.ts')
// PrecipitationType은 백엔드에서 weather.ts가 선언하고 airQuality.ts가 재수출한다.
const BACKEND_WEATHER = join(__dirname, 'weather.ts')

/** 인터페이스 본문에서 필드 이름을 뽑는다. */
function fieldNames(source: string, interfaceName: string): string[] {
  const match = new RegExp(`interface ${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(source)
  if (!match) throw new Error(`${interfaceName} 인터페이스를 찾지 못했다`)
  return match[1]
    .split('\n')
    .map((line) => line.split('//')[0].trim())
    .map((line) => /^(\w+)\??\s*:/.exec(line)?.[1])
    .filter((name): name is string => !!name)
    .sort()
}

/** 유니언 타입의 멤버를 뽑는다. */
function unionMembers(source: string, typeName: string): string[] {
  const match = new RegExp(`type ${typeName}\\s*=\\s*([^\\n]+)`).exec(source)
  if (!match) throw new Error(`${typeName} 타입을 찾지 못했다`)
  return match[1]
    .split('|')
    .map((m) => m.trim().replace(/['";]/g, ''))
    .filter(Boolean)
    .sort()
}

// 프론트엔드 패키지 없이도 백엔드를 단독으로 테스트할 수 있어야 한다.
const frontendAvailable = existsSync(FRONTEND_TYPES) && existsSync(FRONTEND_REGION)
const describeContract = frontendAvailable ? describe : describe.skip

describeContract('프론트엔드 ↔ 백엔드 도메인 타입 계약', () => {
  const fe = readFileSync(FRONTEND_TYPES, 'utf-8')
  const be = readFileSync(BACKEND_TYPES, 'utf-8')

  it.each([
    'AirQualityMetrics',
    'RunningIndex',
    'WeatherInfo',
    'HourlyForecast',
    'StationFallback',
    'ServiceStatus',
    'AirQualityData',
  ])('%s의 필드 집합이 같다', (name) => {
    expect(fieldNames(fe, name)).toEqual(fieldNames(be, name))
  })

  it('RunningStatus의 멤버가 같다', () => {
    expect(unionMembers(fe, 'RunningStatus')).toEqual(unionMembers(be, 'RunningStatus'))
  })

  it('PrecipitationType의 멤버가 같다', () => {
    expect(unionMembers(fe, 'PrecipitationType')).toEqual(
      unionMembers(readFileSync(BACKEND_WEATHER, 'utf-8'), 'PrecipitationType')
    )
  })

  it('Region의 필드 집합이 같다', () => {
    expect(fieldNames(readFileSync(FRONTEND_REGION, 'utf-8'), 'Region')).toEqual(
      fieldNames(readFileSync(BACKEND_REGION, 'utf-8'), 'Region')
    )
  })
})
