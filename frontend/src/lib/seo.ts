import { RUNNING_TIPS, type RunningTip } from './runningTips'

/**
 * 라우트별 SEO 메타데이터의 단일 소스.
 * - 런타임: <Seo /> 컴포넌트가 클라이언트 내비게이션 시 head를 갱신
 * - 빌드타임: scripts/prerender.mjs가 라우트별 정적 HTML의 head를 생성
 * 두 경로 모두 이 파일의 getSeoMeta/renderHeadTags를 사용하므로 드리프트가 없다.
 */

export const SITE = {
  origin: 'https://run.greedylabs.kr',
  name: 'GreedyRunner',
  alternateName: '달려도 되나요?',
  ogImage: 'https://run.greedylabs.kr/og-image.png',
  email: 'hailey@greedylabs.kr',
  publisher: 'GreedyLabs',
} as const

export interface SeoMeta {
  title: string
  description: string
  /** origin 제외 canonical 경로. null이면 canonical 태그를 출력하지 않음 (404 등) */
  canonicalPath: string | null
  /** 검색엔진 색인 차단 여부 (404 페이지 등) */
  noindex?: boolean
  keywords?: string
  ogType: 'website' | 'article'
  /** Article인 경우 발행/수정일 (ISO date) */
  publishedAt?: string
  updatedAt?: string
  jsonLd: Record<string, unknown>[]
}

const HOME_TITLE = '달려도 되나요? — 러닝 날씨 & 대기질 확인 | GreedyRunner'
const HOME_DESCRIPTION =
  '지금 달리기 좋은 날씨인지 확인하세요. 러닝 날씨, 달리기 대기질, 러닝 타임라인으로 오늘 최적의 러닝 시간을 알려드립니다.'
const HOME_KEYWORDS =
  '러닝 날씨, 달리기 날씨, 러닝 타임라인, 러닝 시간, 달리기 대기질, 러닝 대기질, 달려도 되나요, 오늘 러닝, 미세먼지 달리기, 러닝 추천 시간'

function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.origin}/#organization`,
    name: SITE.publisher,
    url: SITE.origin,
    logo: `${SITE.origin}/pwa-512x512.png`,
    email: SITE.email,
  }
}

function webSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.origin}/#website`,
    name: SITE.name,
    alternateName: SITE.alternateName,
    url: SITE.origin,
    inLanguage: 'ko-KR',
    publisher: { '@id': `${SITE.origin}/#organization` },
  }
}

function webApplicationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    alternateName: SITE.alternateName,
    url: SITE.origin,
    description: HOME_DESCRIPTION,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'All',
    inLanguage: 'ko-KR',
    keywords: '러닝 날씨, 달리기 날씨, 러닝 타임라인, 러닝 시간, 달리기 대기질',
    audience: { '@type': 'Audience', audienceType: 'Runners' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
  }
}

interface Crumb {
  name: string
  path: string
}

function breadcrumbJsonLd(crumbs: Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: `${SITE.origin}${crumb.path}`,
    })),
  }
}

function articleJsonLd(tip: RunningTip): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: tip.title,
    description: tip.summary,
    articleSection: tip.category,
    inLanguage: 'ko-KR',
    url: `${SITE.origin}/tips/${tip.id}`,
    mainEntityOfPage: `${SITE.origin}/tips/${tip.id}`,
    image: SITE.ogImage,
    datePublished: tip.publishedAt,
    dateModified: tip.updatedAt ?? tip.publishedAt,
    author: { '@id': `${SITE.origin}/#organization` },
    publisher: { '@id': `${SITE.origin}/#organization` },
  }
}

function tipsCollectionJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '러닝 팁 모음',
    description: `더 잘 달리기 위한 ${RUNNING_TIPS.length}가지 러닝 팁 — 페이스, 호흡, 영양, 장비, 회복, 기상별 실전 가이드`,
    url: `${SITE.origin}/tips`,
    inLanguage: 'ko-KR',
    isPartOf: { '@id': `${SITE.origin}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: RUNNING_TIPS.length,
      itemListElement: RUNNING_TIPS.map((tip, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: tip.title,
        url: `${SITE.origin}/tips/${tip.id}`,
      })),
    },
  }
}

/** 설명문을 메타 디스크립션 권장 길이로 자름 (한글 기준 넉넉히 155자) */
function truncateDescription(text: string, max = 155): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1).trimEnd()}…`
}

/** 경로 정규화: 끝 슬래시 제거 ('/'는 유지) */
function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

export function getSeoMeta(pathname: string): SeoMeta {
  const path = normalizePath(pathname)

  if (path === '/') {
    return {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      keywords: HOME_KEYWORDS,
      canonicalPath: '/',
      ogType: 'website',
      jsonLd: [webApplicationJsonLd(), organizationJsonLd(), webSiteJsonLd()],
    }
  }

  if (path === '/outfit') {
    return {
      title: '러닝 옷차림 추천 — 기온·자외선·강수별 시뮬레이터 | GreedyRunner',
      description:
        '오늘 러닝 옷차림이 고민되나요? 기온, 자외선, 습도, 풍속, 강수 조건별 추천 러닝 복장을 시뮬레이터로 바로 확인하세요.',
      canonicalPath: '/outfit',
      ogType: 'website',
      jsonLd: [
        breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '러닝 옷차림 추천', path: '/outfit' },
        ]),
        organizationJsonLd(),
        webSiteJsonLd(),
      ],
    }
  }

  if (path === '/tips') {
    return {
      title: `러닝 팁 ${RUNNING_TIPS.length}가지 — 페이스·호흡·영양·장비·회복 | GreedyRunner`,
      description: `더 잘 달리기 위한 ${RUNNING_TIPS.length}가지 러닝 팁. 워밍업, 호흡법, 수분 보충, 케이던스, 부상 예방까지 카테고리별 실전 가이드를 확인하세요.`,
      canonicalPath: '/tips',
      ogType: 'website',
      jsonLd: [
        tipsCollectionJsonLd(),
        breadcrumbJsonLd([
          { name: '홈', path: '/' },
          { name: '러닝 팁', path: '/tips' },
        ]),
        organizationJsonLd(),
        webSiteJsonLd(),
      ],
    }
  }

  const tipMatch = path.match(/^\/tips\/([^/]+)$/)
  if (tipMatch) {
    const tip = RUNNING_TIPS.find(t => t.id === tipMatch[1])
    if (tip) {
      return {
        title: `${tip.title} | GreedyRunner 러닝 팁`,
        description: truncateDescription(tip.summary),
        canonicalPath: `/tips/${tip.id}`,
        ogType: 'article',
        publishedAt: tip.publishedAt,
        updatedAt: tip.updatedAt,
        jsonLd: [
          articleJsonLd(tip),
          breadcrumbJsonLd([
            { name: '홈', path: '/' },
            { name: '러닝 팁', path: '/tips' },
            { name: tip.title, path: `/tips/${tip.id}` },
          ]),
          organizationJsonLd(),
          webSiteJsonLd(),
        ],
      }
    }
  }

  // 알 수 없는 경로 — 404
  return {
    title: '페이지를 찾을 수 없습니다 | GreedyRunner',
    description: '요청하신 페이지가 존재하지 않습니다. 러닝 지수 홈 또는 러닝 팁 목록으로 이동해 주세요.',
    canonicalPath: null,
    noindex: true,
    ogType: 'website',
    jsonLd: [organizationJsonLd()],
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** JSON-LD를 <script> 안에 안전하게 넣기 위한 직렬화 */
function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

/**
 * SeoMeta를 head 태그 문자열로 변환.
 * 모든 태그에 data-seo 마커를 붙여 런타임에서 일괄 교체할 수 있게 한다.
 */
export function renderHeadTags(meta: SeoMeta): string {
  const lines: string[] = []
  lines.push(`<title data-seo>${escapeAttr(meta.title)}</title>`)
  lines.push(`<meta data-seo name="description" content="${escapeAttr(meta.description)}" />`)
  if (meta.keywords) {
    lines.push(`<meta data-seo name="keywords" content="${escapeAttr(meta.keywords)}" />`)
  }
  lines.push(
    `<meta data-seo name="robots" content="${meta.noindex ? 'noindex, nofollow' : 'index, follow'}" />`
  )
  if (meta.canonicalPath) {
    const canonicalUrl = `${SITE.origin}${meta.canonicalPath === '/' ? '/' : meta.canonicalPath}`
    lines.push(`<link data-seo rel="canonical" href="${escapeAttr(canonicalUrl)}" />`)

    lines.push(`<meta data-seo property="og:title" content="${escapeAttr(meta.title)}" />`)
    lines.push(`<meta data-seo property="og:description" content="${escapeAttr(meta.description)}" />`)
    lines.push(`<meta data-seo property="og:type" content="${meta.ogType}" />`)
    lines.push(`<meta data-seo property="og:url" content="${escapeAttr(canonicalUrl)}" />`)
    lines.push(`<meta data-seo property="og:site_name" content="${SITE.name}" />`)
    lines.push(`<meta data-seo property="og:locale" content="ko_KR" />`)
    lines.push(`<meta data-seo property="og:image" content="${SITE.ogImage}" />`)
    lines.push(`<meta data-seo property="og:image:width" content="1200" />`)
    lines.push(`<meta data-seo property="og:image:height" content="630" />`)
    lines.push(`<meta data-seo property="og:image:alt" content="${escapeAttr(meta.title)}" />`)
    if (meta.ogType === 'article' && meta.publishedAt) {
      lines.push(
        `<meta data-seo property="article:published_time" content="${meta.publishedAt}" />`
      )
      lines.push(
        `<meta data-seo property="article:modified_time" content="${meta.updatedAt ?? meta.publishedAt}" />`
      )
    }

    lines.push(`<meta data-seo name="twitter:card" content="summary_large_image" />`)
    lines.push(`<meta data-seo name="twitter:title" content="${escapeAttr(meta.title)}" />`)
    lines.push(`<meta data-seo name="twitter:description" content="${escapeAttr(meta.description)}" />`)
    lines.push(`<meta data-seo name="twitter:image" content="${SITE.ogImage}" />`)
  }
  for (const block of meta.jsonLd) {
    lines.push(`<script data-seo type="application/ld+json">${serializeJsonLd(block)}</script>`)
  }
  return lines.join('\n    ')
}

/** 사이트맵 생성용 라우트 목록 (404 제외) */
export function getIndexableRoutes(): { path: string; lastmod: string }[] {
  const tipDates = RUNNING_TIPS.map(t => t.updatedAt ?? t.publishedAt)
  const latestTipDate = tipDates.reduce((a, b) => (a > b ? a : b))
  return [
    { path: '/', lastmod: latestTipDate },
    { path: '/outfit', lastmod: latestTipDate },
    { path: '/tips', lastmod: latestTipDate },
    ...RUNNING_TIPS.map(tip => ({
      path: `/tips/${tip.id}`,
      lastmod: tip.updatedAt ?? tip.publishedAt,
    })),
  ]
}
