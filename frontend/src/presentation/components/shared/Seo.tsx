import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getSeoMeta, renderHeadTags } from '../../../lib/seo'

/**
 * 클라이언트 내비게이션 시 라우트별 head(title/meta/canonical/JSON-LD)를 갱신한다.
 * 초기 로드는 빌드타임 프리렌더가 심어둔 정적 태그가 담당하고,
 * 이 컴포넌트는 같은 생성기(renderHeadTags)의 출력으로 data-seo 태그를 통째로 교체한다.
 */
export function Seo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const meta = getSeoMeta(pathname)
    document.querySelectorAll('[data-seo]').forEach(node => node.remove())
    const fragment = document.createRange().createContextualFragment(renderHeadTags(meta))
    document.head.appendChild(fragment)
  }, [pathname])

  return null
}
