const CARD_SELECTOR = '.progressive-card'

export function initProgressiveReveal(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }
        const element = entry.target as HTMLElement
        element.classList.add('progressive-visible')
        observer.unobserve(element)
      }
    },
    {
      threshold: 0.01,
      rootMargin: '0px 0px 22% 0px',
    },
  )

  const isNearViewport = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    return rect.top <= viewportHeight * 1.18
  }

  const observeCard = (element: Element) => {
    if (!(element instanceof HTMLElement)) {
      return
    }
    if (element.classList.contains('progressive-visible')) {
      return
    }
    // Pre-revela tarjetas cercanas al primer viewport para evitar "corte" visual.
    if (isNearViewport(element)) {
      element.classList.add('progressive-visible')
      return
    }
    observer.observe(element)
  }

  const observeInTree = (root: ParentNode) => {
    root.querySelectorAll?.(CARD_SELECTOR).forEach(observeCard)
  }

  observeInTree(document)

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === 'attributes'
        && mutation.target instanceof HTMLElement
        && mutation.target.matches(CARD_SELECTOR)
      ) {
        observeCard(mutation.target)
      }
      for (const addedNode of mutation.addedNodes) {
        if (!(addedNode instanceof HTMLElement)) {
          continue
        }
        if (addedNode.matches(CARD_SELECTOR)) {
          observeCard(addedNode)
        }
        observeInTree(addedNode)
      }
    }
  })

  mutationObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  })

  return () => {
    observer.disconnect()
    mutationObserver.disconnect()
  }
}
