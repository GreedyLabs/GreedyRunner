/* eslint-disable react-refresh/only-export-components -- SSR 전용 엔트리, HMR 대상 아님 */
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import App from './App'

/**
 * 빌드타임 프리렌더 전용 SSR 엔트리 (scripts/prerender.mjs에서 사용).
 * 데이터 fetch는 모두 effect 기반이므로 초기(로딩/빈) 상태의 정적 마크업이 렌더된다 —
 * 러닝 팁처럼 정적 데이터 기반 페이지는 전체 본문이 포함된다.
 */
export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>
  )
}

export { getSeoMeta, renderHeadTags, getIndexableRoutes, SITE } from './lib/seo'
