import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * `localStorage`/`sessionStorage`를 테스트 환경에 설치한다.
 *
 * 왜 필요한가: Node 26부터 `globalThis.localStorage`가 **getter로 기본 제공**되는데,
 * `--localstorage-file`을 주지 않으면 경고만 내고 `undefined`를 반환한다. vitest의 jsdom
 * 환경은 이미 globalThis에 존재하는 키를 건너뛰고 복사하므로 jsdom이 만드는 진짜 Storage가
 * 설치되지 않고, 게다가 vitest는 `window`를 `globalThis`에 앨리어싱하므로 `window.localStorage`
 * 로도 꺼낼 수 없다. 그 결과 `window`·`document`는 정상인데 `localStorage`만 `undefined`가 되고,
 * 바로 `localStorage`를 참조하는 코드(useLocation·usePWAInstall)는 테스트에서 항상
 * "스토리지를 쓸 수 없는 브라우저"처럼 동작해 캐시 경로를 검증할 수 없다.
 *
 * jsdom의 Storage 인스턴스를 꺼낼 경로가 없으므로 Storage 계약을 만족하는 최소 구현을 둔다.
 * 테스트가 필요로 하는 것은 getItem/setItem/removeItem/clear의 의미(없는 키는 null,
 * 값은 문자열로 강제)뿐이다. 스토리지 차단 상황은 각 테스트가 이 인스턴스의 메서드를
 * spyOn으로 throw하게 만들어 재현한다.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value))
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

for (const key of ['localStorage', 'sessionStorage'] as const) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
  // 값이 실제로 쓸 수 있는 Storage이면 건드리지 않는다 (Node가 동작을 바꿀 경우를 대비).
  const usable = descriptor && typeof (globalThis as Record<string, unknown>)[key] === 'object'
  if (!usable) {
    Object.defineProperty(globalThis, key, {
      value: new MemoryStorage(),
      configurable: true,
      writable: true,
    })
  }
}

// 각 테스트가 끝나면 렌더된 트리를 걷어낸다. 남겨 두면 다음 테스트의 getByTestId가
// 이전 트리의 노드를 먼저 찾아 "여러 개가 매칭된다"로 실패한다.
// (RTL은 테스트 프레임워크의 afterEach가 전역으로 노출돼 있을 때만 자동 정리하고,
//  이 저장소는 vitest 심볼을 명시적으로 import하므로 직접 등록해야 한다)
afterEach(() => {
  cleanup()
})
