// Readiness fallback and normal readiness share the same two-frame reveal.
export function scheduleReveal(prepared, onStart, onRevealed, fadeElement) {
  let cancelled = false
  let scheduled = false
  let firstFrame
  let secondFrame
  let completion
  let completionFirstFrame
  let completionSecondFrame
  let completed = false
  const complete = () => {
    if (cancelled || completed) return
    completed = true
    clearTimeout(completion)
    fadeElement?.removeEventListener('transitionend', onTransitionEnd)
    // Keep the outgoing layers until the fully opaque incoming scene has had
    // rendering opportunities; tearing down WebGL mid-fade can flash in WKWebView.
    completionFirstFrame = requestAnimationFrame(() => {
      if (cancelled) return
      completionSecondFrame = requestAnimationFrame(() => {
        if (!cancelled) onRevealed?.()
      })
    })
  }
  const onTransitionEnd = event => {
    if (event.target === fadeElement && event.propertyName === 'opacity') complete()
  }
  const reveal = () => {
    if (cancelled || scheduled) return
    scheduled = true
    clearTimeout(fallback)
    firstFrame = requestAnimationFrame(() => {
      if (cancelled) return
      secondFrame = requestAnimationFrame(() => {
        if (cancelled) return
        fadeElement?.addEventListener('transitionend', onTransitionEnd)
        onStart()
        completion = setTimeout(complete, fadeElement ? 700 : 500)
      })
    })
  }
  const fallback = setTimeout(reveal, 1200)
  Promise.resolve(prepared).then(reveal, reveal)
  return () => {
    cancelled = true
    clearTimeout(fallback)
    clearTimeout(completion)
    fadeElement?.removeEventListener('transitionend', onTransitionEnd)
    cancelAnimationFrame(firstFrame)
    cancelAnimationFrame(secondFrame)
    cancelAnimationFrame(completionFirstFrame)
    cancelAnimationFrame(completionSecondFrame)
  }
}
