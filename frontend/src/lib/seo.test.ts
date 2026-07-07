import { describe, expect, it } from 'vitest'
import { getIndexableRoutes, getSeoMeta, renderHeadTags, SITE } from './seo'
import { RUNNING_TIPS } from './runningTips'

describe('getSeoMeta', () => {
  it('홈은 자기 자신을 canonical로 가진다', () => {
    const meta = getSeoMeta('/')
    expect(meta.canonicalPath).toBe('/')
    expect(meta.noindex).toBeUndefined()
    expect(meta.title).toContain('달려도 되나요?')
    expect(meta.jsonLd.some(b => b['@type'] === 'WebApplication')).toBe(true)
  })

  it('러닝 팁 상세는 고유 title/canonical/Article JSON-LD를 가진다', () => {
    const tip = RUNNING_TIPS[0]
    const meta = getSeoMeta(`/tips/${tip.id}`)
    expect(meta.title).toContain(tip.title)
    expect(meta.canonicalPath).toBe(`/tips/${tip.id}`)
    expect(meta.ogType).toBe('article')
    const article = meta.jsonLd.find(b => b['@type'] === 'Article')
    expect(article).toBeDefined()
    expect(article?.datePublished).toBe(tip.publishedAt)
    expect(meta.jsonLd.some(b => b['@type'] === 'BreadcrumbList')).toBe(true)
  })

  it('모든 팁이 서로 다른 title/canonical을 가진다', () => {
    const titles = new Set<string>()
    const canonicals = new Set<string | null>()
    for (const tip of RUNNING_TIPS) {
      const meta = getSeoMeta(`/tips/${tip.id}`)
      titles.add(meta.title)
      canonicals.add(meta.canonicalPath)
    }
    expect(titles.size).toBe(RUNNING_TIPS.length)
    expect(canonicals.size).toBe(RUNNING_TIPS.length)
  })

  it('끝 슬래시가 있어도 같은 메타를 반환한다', () => {
    expect(getSeoMeta('/tips/')).toEqual(getSeoMeta('/tips'))
  })

  it('알 수 없는 경로는 noindex이며 canonical이 없다', () => {
    const meta = getSeoMeta('/no-such-page')
    expect(meta.noindex).toBe(true)
    expect(meta.canonicalPath).toBeNull()
  })

  it('존재하지 않는 팁 slug는 404 메타를 반환한다', () => {
    const meta = getSeoMeta('/tips/definitely-not-a-tip')
    expect(meta.noindex).toBe(true)
  })

  it('설명문은 메타 디스크립션 길이 제한을 지킨다', () => {
    for (const tip of RUNNING_TIPS) {
      expect(getSeoMeta(`/tips/${tip.id}`).description.length).toBeLessThanOrEqual(155)
    }
  })
})

describe('renderHeadTags', () => {
  it('canonical과 robots 태그를 올바르게 출력한다', () => {
    const html = renderHeadTags(getSeoMeta('/outfit'))
    expect(html).toContain(`rel="canonical" href="${SITE.origin}/outfit"`)
    expect(html).toContain('content="index, follow"')
    expect(html).toContain('og:url')
  })

  it('404 메타는 noindex를 출력하고 canonical/og를 생략한다', () => {
    const html = renderHeadTags(getSeoMeta('/no-such-page'))
    expect(html).toContain('noindex, nofollow')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('og:url')
  })

  it('JSON-LD의 닫는 스크립트 태그를 이스케이프한다', () => {
    const html = renderHeadTags(getSeoMeta('/'))
    const scripts = html.match(/<script data-seo type="application\/ld\+json">.*?<\/script>/g)
    expect(scripts?.length).toBeGreaterThan(0)
    for (const s of scripts ?? []) {
      const body = s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
      expect(body).not.toContain('</script')
      expect(() => JSON.parse(body)).not.toThrow()
    }
  })

  it('모든 태그에 data-seo 마커가 붙는다 (런타임 일괄 교체용)', () => {
    const html = renderHeadTags(getSeoMeta('/tips'))
    for (const line of html.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('<')) expect(trimmed).toContain('data-seo')
    }
  })
})

describe('getIndexableRoutes', () => {
  it('정적 6개 + 팁 전체를 포함하고 lastmod는 ISO 날짜다', () => {
    const routes = getIndexableRoutes()
    expect(routes).toHaveLength(6 + RUNNING_TIPS.length)
    for (const staticPath of ['/', '/hours', '/gear', '/tip', '/outfit', '/tips']) {
      expect(routes.map(r => r.path)).toContain(staticPath)
    }
    for (const { lastmod } of routes) {
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
