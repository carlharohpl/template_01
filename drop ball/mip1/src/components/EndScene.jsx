import { useCallback, useEffect, useRef, useState } from 'react'
import endSceneHtml from '../assets/endscene/endscene.html?endcard'
import { openDestination } from './cta'

const bridgeScript = `
<script>
  try {
    window.mraid = parent.mraid || window.mraid;
    window.clickTag = parent.clickTag || window.clickTag;
  } catch (error) {}

  (function () {
    let mraidViewable = true;

    function syncMediaState() {
      document.querySelectorAll("video, audio").forEach(function (element) {
        if (!mraidViewable) {
          element.pause();
        } else if (element.tagName === "VIDEO" && element.autoplay) {
          element.play().catch(function () {});
        }
      });
    }

    function setupMraidViewability() {
      const mraid = window.mraid;
      if (!mraid) return;

      function handleViewableChange(viewable) {
        mraidViewable = Boolean(viewable);
        syncMediaState();
      }

      if (typeof mraid.isViewable === "function") {
        try {
          mraidViewable = Boolean(mraid.isViewable());
        } catch (error) {
          mraidViewable = true;
        }
      }

      if (typeof mraid.addEventListener === "function") {
        mraid.addEventListener("viewableChange", handleViewableChange);
      }

      syncMediaState();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupMraidViewability, { once: true });
    } else {
      setupMraidViewability();
    }
  })();
</script>`

const endSceneHtmlWithBridge = endSceneHtml.replace(
  '</head>',
  `${bridgeScript}</head>`,
)

export default function EndScene({ onReady }) {
  const [visible, setVisible] = useState(false)
  const active = useRef(false)
  const scheduled = useRef(false)
  const revealed = useRef(false)
  const frames = useRef([])
  const fallback = useRef(0)
  const iframeRef = useRef(null)
  const readyCallback = useRef(onReady)
  useEffect(() => { readyCallback.current = onReady }, [onReady])
  const reveal = useCallback(() => {
    if (!active.current || scheduled.current || revealed.current) return
    scheduled.current = true
    clearTimeout(fallback.current)
    frames.current.push(requestAnimationFrame(() => {
      frames.current.push(requestAnimationFrame(() => {
        if (!active.current || revealed.current) return
        revealed.current = true
        setVisible(true)
        readyCallback.current?.()
      }))
    }))
  }, [])
  useEffect(() => {
    active.current = true
    scheduled.current = false
    fallback.current = setTimeout(reveal, 1200)
    const pending = frames.current
    const iframe = iframeRef.current
    return () => {
      active.current = false
      clearTimeout(fallback.current)
      pending.forEach(cancelAnimationFrame)
      try { iframe?.contentWindow?.__mip?.disposeCalendar?.() } catch { /* Already disposed. */ }
    }
  }, [reveal])
  return (
    <main className={`html-end-wrapper end-scene-fade${visible ? ' is-visible' : ''}`}>
      <iframe
        ref={iframeRef}
        title="Jones Road offer"
        className="pointer-events-none html-end-scene"
        tabIndex={-1}
        srcDoc={endSceneHtmlWithBridge}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={reveal}
      />
      <button
        type="button"
        className="end-click-layer absolute inset-0 z-30 h-full w-full"
        data-cta=""
        onPointerDown={event => event.stopPropagation()}
        aria-label="Open offer"
        disabled={!visible}
        onClick={(event) => {
          event.stopPropagation()
          openDestination()
        }}
      />
    </main>
  )
}
