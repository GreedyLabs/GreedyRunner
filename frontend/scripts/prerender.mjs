/**
 * 빌드타임 프리렌더러.
 *
 * `vite build`(클라이언트) + `vite build --ssr`(dist-ssr) 이후 실행되어:
 *   1. 모든 라우트를 dist/<route>/index.html 정적 파일로 렌더 (head는 src/lib/seo.ts 기반)
 *   2. 404 페이지를 dist/404.html로 렌더 (nginx error_page에서 사용)
 *   3. 실제 lastmod가 담긴 sitemap.xml 생성
 *
 * 결과: 크롤러(구글/네이버/빙/AI 봇)가 JS 실행 없이 본문과 라우트별 메타를 읽을 수 있다.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(root, '../dist')
const ssrEntry = path.resolve(root, '../dist-ssr/entry-server.js')

const { render, getSeoMeta, renderHeadTags, getIndexableRoutes, SITE } = await import(
  ssrEntry
)

const template = await readFile(path.join(distDir, 'index.html'), 'utf-8')

const SEO_BLOCK = /<!-- SEO:BEGIN -->[\s\S]*?<!-- SEO:END -->/
const APP_ROOT = /<div id="root">(?:<!--app-html-->)?<\/div>/
if (!SEO_BLOCK.test(template)) {
  throw new Error('prerender: index.html에서 <!-- SEO:BEGIN --> 마커를 찾지 못했습니다.')
}
if (!APP_ROOT.test(template)) {
  throw new Error('prerender: index.html에서 <div id="root"> 마운트 지점을 찾지 못했습니다.')
}

function renderPage(routePath) {
  const appHtml = render(routePath)
  const headTags = renderHeadTags(getSeoMeta(routePath))
  return template
    .replace(SEO_BLOCK, `<!-- SEO:BEGIN -->\n    ${headTags}\n    <!-- SEO:END -->`)
    .replace(APP_ROOT, `<div id="root">${appHtml}</div>`)
}

async function writePage(routePath, html) {
  const outFile =
    routePath === '/404'
      ? path.join(distDir, '404.html')
      : path.join(distDir, routePath === '/' ? '' : routePath.slice(1), 'index.html')
  await mkdir(path.dirname(outFile), { recursive: true })
  await writeFile(outFile, html)
  return path.relative(distDir, outFile)
}

const routes = getIndexableRoutes()

for (const { path: routePath } of routes) {
  await writePage(routePath, renderPage(routePath))
}
// 404: 존재하지 않는 경로를 렌더 → NotFoundPage + noindex 메타
await writePage('/404', renderPage('/__not_found__'))

// sitemap.xml — 실제 콘텐츠 날짜 기반 lastmod, changefreq/priority는 의도적으로 생략
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map(({ path: routePath, lastmod }) =>
    `  <url><loc>${SITE.origin}${routePath}</loc><lastmod>${lastmod}</lastmod></url>`
  ),
  '</urlset>',
  '',
].join('\n')
await writeFile(path.join(distDir, 'sitemap.xml'), sitemap)

console.log(`prerender: ${routes.length}개 라우트 + 404.html + sitemap.xml 생성 완료`)
