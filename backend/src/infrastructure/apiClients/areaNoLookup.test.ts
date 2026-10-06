import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { latLngToAreaNo } from './areaNoLookup'

/**
 * areaNo 테이블은 코드·이름·좌표를 손으로 맞춘 정적 표라, 한 줄을 끼워 넣거나 지우면
 * 코드 열과 이름 열이 어긋난다. 실제로 경기도 블록 전체가 몇 행씩 밀려 있었고,
 * '수원 권선구' 좌표에 성남시 코드가, '부천시'에 동두천시 코드가 붙어 다른 시의
 * 자외선지수를 가져왔다. 41211·41313처럼 존재하지 않는 코드도 섞여 NODATA가 돌아왔다.
 *
 * 타입 검사로는 잡히지 않고 런타임 오류도 나지 않는(그냥 다른 지역 값이 오는) 부류라,
 * 표의 구조적 성질을 테스트로 고정한다.
 */
const SOURCE = readFileSync(join(__dirname, 'areaNoLookup.ts'), 'utf-8')
const ENTRIES = [...SOURCE.matchAll(/\{ code: '(\d{10})', name: '([^']+)'/g)].map((m) => ({
  code: m[1],
  name: m[2],
}))

describe('AREA_TABLE 구조', () => {
  it('항목이 충분히 들어 있다', () => {
    expect(ENTRIES.length).toBeGreaterThan(100)
  })

  it('모든 코드가 10자리이고 시군구 코드 + 00000 형태다', () => {
    for (const { code, name } of ENTRIES) {
      expect(code).toMatch(/^\d{5}00000$/)
      expect(name.length).toBeGreaterThan(0)
    }
  })

  it('코드가 중복되지 않는다', () => {
    const seen = new Map<string, string>()
    for (const { code, name } of ENTRIES) {
      expect(seen.has(code)).toBe(false)
      seen.set(code, name)
    }
  })

  // 행정표준코드는 시도 → 시군구 순으로 증가하도록 부여된다. 표를 그 순서로 적어 두면
  // 한 행이 밀리는 순간 단조 증가가 깨진다 — 밀림을 잡는 가장 값싼 검사다.
  it('표에 적힌 순서대로 코드가 단조 증가한다', () => {
    const violations: string[] = []
    for (let i = 1; i < ENTRIES.length; i++) {
      if (ENTRIES[i].code <= ENTRIES[i - 1].code) {
        violations.push(`${ENTRIES[i - 1].name}(${ENTRIES[i - 1].code}) → ${ENTRIES[i].name}(${ENTRIES[i].code})`)
      }
    }
    expect(violations).toEqual([])
  })
})

describe('latLngToAreaNo', () => {
  // 밀림이 있으면 이 기대값들이 깨진다 (예전 표에서는 수원 권선구 좌표가 성남시 코드를 줬다).
  it.each([
    ['서울 강남구', 37.5172, 127.0473, '1168000000'],
    ['서울 중구', 37.5641, 126.9979, '1114000000'],
    ['부산 해운대구', 35.1631, 129.1635, '2635000000'],
    ['수원 팔달구', 37.2747, 127.0214, '4111500000'],
    ['성남 분당구', 37.3845, 127.1234, '4113500000'],
    ['부천시', 37.5034, 126.766, '4119000000'],
    ['고양 일산서구', 37.6756, 126.7514, '4128700000'],
    ['제주시', 33.4996, 126.5312, '5011000000'],
  ])('%s 좌표는 %s 코드를 반환한다', (_name, lat, lng, expected) => {
    expect(latLngToAreaNo(lat, lng)).toBe(expected)
  })

  it('표 밖의 좌표(동해상)도 가장 가까운 코드를 반환한다', () => {
    expect(latLngToAreaNo(37.5, 131.8)).toMatch(/^\d{5}00000$/)
  })
})
