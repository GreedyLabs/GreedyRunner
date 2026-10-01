import { describe, expect, it } from 'vitest'
import { RUNNING_TIPS } from './runningTips'

/**
 * 팁 데이터의 불변 조건.
 *
 * 팁은 손으로 적는 배열이고 하나하나가 색인되는 페이지가 된다(/tips/{id}).
 * id가 겹치면 한 URL이 두 글을 가리키고, 슬러그가 깨지면 링크가 죽고,
 * 마크업을 잘못 쓰면 상세 페이지에서 표나 제목이 엉뚱하게 렌더된다.
 * 타입 검사로는 전부 통과하는 종류라 값으로 고정한다.
 *
 * 렌더러가 지원하는 마크업은 RunningTipPage.tsx 기준이다.
 *   - 빈 줄: 단락 구분
 *   - `|`로 시작하는 블록: 표 (첫 줄이 헤더, `|---|` 구분선은 제거됨)
 *   - `- `로 시작하는 줄: 목록
 *   - 줄 전체가 `**...**`: 섹션 제목(h2)
 *   - 인라인 `**굵게**`, `[텍스트](url)`
 */
const CATEGORIES = ['페이스', '기상', '영양', '장비', '회복', '호흡'] as const

describe('RUNNING_TIPS — 식별자와 필수 필드', () => {
  it('팁이 비어 있지 않다', () => {
    expect(RUNNING_TIPS.length).toBeGreaterThan(0)
  })

  it('id가 중복되지 않는다', () => {
    const ids = RUNNING_TIPS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('제목이 중복되지 않는다', () => {
    const titles = RUNNING_TIPS.map(t => t.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  // id가 그대로 URL이 되므로 인코딩이 필요한 문자가 들어가면 안 된다.
  it('id가 소문자 케밥케이스 슬러그다', () => {
    const bad = RUNNING_TIPS.filter(t => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id))
    expect(bad.map(t => t.id)).toEqual([])
  })

  it('모든 필수 텍스트 필드가 비어 있지 않다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(tip.title.trim(), tip.id).not.toBe('')
      expect(tip.summary.trim(), tip.id).not.toBe('')
      expect(tip.detail.trim(), tip.id).not.toBe('')
      expect(tip.emoji.trim(), tip.id).not.toBe('')
    }
  })

  it('카테고리가 허용된 값이다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(CATEGORIES, tip.id).toContain(tip.category)
    }
  })
})

describe('RUNNING_TIPS — 날짜', () => {
  it('publishedAt이 YYYY-MM-DD 형식이고 실제 날짜다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(tip.publishedAt, tip.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(tip.publishedAt)), tip.id).toBe(false)
    }
  })

  // sitemap의 lastmod와 Article의 dateModified가 발행일보다 앞서면 색인에서 신뢰를 잃는다.
  it('updatedAt이 있으면 형식이 맞고 publishedAt보다 앞서지 않는다', () => {
    for (const tip of RUNNING_TIPS) {
      if (!tip.updatedAt) continue
      expect(tip.updatedAt, tip.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(tip.updatedAt >= tip.publishedAt, `${tip.id}: updatedAt < publishedAt`).toBe(true)
    }
  })
})

describe('RUNNING_TIPS — 요약문', () => {
  // 메타 디스크립션으로 쓰인다. 너무 짧으면 검색 결과에서 설명이 되지 않고,
  // 너무 길면 어차피 잘린다(seo.ts의 truncateDescription이 155자로 자른다).
  it('요약문 길이가 40~200자 사이다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(tip.summary.length, `${tip.id} (${tip.summary.length}자)`).toBeGreaterThanOrEqual(40)
      expect(tip.summary.length, `${tip.id} (${tip.summary.length}자)`).toBeLessThanOrEqual(200)
    }
  })

  it('요약문에 줄바꿈이 없다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(tip.summary.includes('\n'), tip.id).toBe(false)
    }
  })
})

describe('RUNNING_TIPS — 본문 마크업', () => {
  // 명백한 빈 껍데기 항목을 걸러내는 용도다. 기존 글 중 가장 짧은 것이 269자여서
  // 그보다 아래로 잡았다 — 글의 질을 재는 기준이 아니라 "본문을 안 쓴 채로 추가하는 것"을
  // 막는 하한선이다.
  it('본문이 빈 껍데기가 아니다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(tip.detail.length, `${tip.id} (${tip.detail.length}자)`).toBeGreaterThan(250)
    }
  })

  // 템플릿 리터럴 안의 ${...}는 의도치 않은 보간이 된다.
  it('본문에 템플릿 보간 구문이 없다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(tip.detail.includes('${'), tip.id).toBe(false)
    }
  })

  // 렌더러는 `**`를 쌍으로 찾는다. 홀수면 굵게 표시가 깨진다.
  it('굵게 표시(**)가 짝을 이룬다', () => {
    for (const tip of RUNNING_TIPS) {
      const count = (tip.detail.match(/\*\*/g) ?? []).length
      expect(count % 2, `${tip.id}: ** ${count}개`).toBe(0)
    }
  })

  // 표의 각 행은 `|`로 시작하고 끝나야 셀 분리가 맞는다.
  it('표 행이 파이프로 시작하고 끝난다', () => {
    for (const tip of RUNNING_TIPS) {
      for (const line of tip.detail.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('|')) continue
        expect(trimmed.endsWith('|'), `${tip.id}: ${trimmed.slice(0, 40)}`).toBe(true)
      }
    }
  })

  // 렌더러의 인라인 정규식은 URL에 닫는 괄호를 허용하지 않는다.
  it('링크 문법이 렌더러가 읽을 수 있는 형태다', () => {
    for (const tip of RUNNING_TIPS) {
      for (const [, label, url] of tip.detail.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
        expect(label.trim(), tip.id).not.toBe('')
        expect(url, `${tip.id}: ${url}`).toMatch(/^https?:\/\//)
      }
      // 링크로 보이지만 닫는 괄호가 없는 깨진 형태를 잡는다.
      const openBrackets = (tip.detail.match(/\]\(/g) ?? []).length
      const closed = [...tip.detail.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].length
      expect(closed, `${tip.id}: 깨진 링크`).toBe(openBrackets)
    }
  })

  it('본문이 빈 줄로 시작하거나 끝나지 않는다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(tip.detail, tip.id).toBe(tip.detail.trim())
    }
  })
})

describe('RUNNING_TIPS — 카테고리 분포', () => {
  // 목록 페이지가 카테고리 필터를 제공하므로, 비어 있는 카테고리가 있으면
  // 필터를 눌렀을 때 결과가 0건인 탭이 생긴다.
  it('모든 카테고리에 최소 한 개의 팁이 있다', () => {
    for (const category of CATEGORIES) {
      const count = RUNNING_TIPS.filter(t => t.category === category).length
      expect(count, `${category} 카테고리가 비어 있다`).toBeGreaterThan(0)
    }
  })
})
