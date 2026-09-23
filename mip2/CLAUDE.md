# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `yarn dev` — start the Vite dev server
- `yarn build` — production build (outputs a single inlined `dist/index.html`)
- `yarn preview` — preview the production build
- `yarn lint` — run ESLint

There is no test suite configured.

Dependencies are installed with `yarn` (both `yarn.lock` and `package-lock.json` exist; prefer `yarn`).

## Conventions

- React + JavaScript only — no TypeScript.
- **Before every build**, check the `<title>` in `index.html`. If the tag is missing, empty, or contains only whitespace, **ask the user what title to use and wait for their answer before building**. Insert their supplied title, then continue the build. Never guess a title or build with a missing/blank title. This applies to all builds, including template, validation, temporary-output, and production builds. If a nonblank title already exists, preserve it and build without asking again.
- **STRICTLY REQUIRED component structure:** keep the main composition, layout, and scene flow in `src/App.jsx`. Create a `src/components/*.jsx` component only for a separate scene, reusable UI (such as `Cta`), or a substantial self-contained piece of UI with its own interaction or logic. Keep simple images and small one-off markup directly in `App.jsx`; do not create a component for every asset or add components solely to wrap markup.
  - Once extracted, the component owns its asset imports, markup, image positioning/sizing, Tailwind styling, applied animation classes, and local interaction/click handling. `App.jsx` renders it (for example, `<Cta />`) and passes only the props/callbacks needed to coordinate the overall scene; do not duplicate or override the component's asset-specific layout or behavior in `App.jsx`. Reposition an image by editing its own tag in the owning component.
  - Component extraction must preserve the strict independent-image setup: return images or fragments as appropriate, without adding per-asset positioning groups or animation wrappers. All animation definitions, keyframes, transitions, and timing remain exclusively in `src/index.css`; the component only applies the named classes and coordinates animation state when needed. Reuse existing components such as `cta.jsx` and `endscene.jsx` instead of creating duplicate versions.
- **STRICTLY REQUIRED image asset setup: position every image asset independently.** Put its own `top`, `left`, width, z-index, centering, and animation classes directly on the `<img>` tag. Do not use shared positioning groups or nested animation wrappers. Each foreground image's `top` must be relative to the main design canvas so repositioning it requires editing only that image tag. React components may return images or fragments, but must not introduce a per-asset positioning or motion container.
  ```jsx
  <img
    src={assetName}
    alt="Asset image name"
    className="pointer-events-none absolute left-1/2 top-[] z-30 w-[] -translate-x-1/2 select-none"
    draggable="false"
  />
  ```
  - Strictly keep the opening `<img`, each attribute, and the closing `/>` on separate lines. Use the attribute order `src`, `alt`, `className`, `draggable`; put any additional required attributes on their own lines afterward. Keep each attribute value together rather than copying visual line wrapping from the reference.
  - Use Tailwind utilities directly on the image for `pointer-events-none`, `absolute`, explicit canvas-relative position, width, z-index, centering, and `select-none`; always set `draggable="false"`. Apply the image's named animation classes directly in the same `className`. Define every animation and transition in `src/index.css`, never in JSX or Tailwind animation/transition utilities.
  - **Set width only and preserve natural image proportions.** Do not introduce fixed heights, stretching, or cropping. Retain deliberate fixed-box/bleed sizing only under the explicit background/bleed rules below.
  - **Preserve existing visual positions, assets, alt text, dimensions, gameplay, interactions, and responsive canvas scaling.** Copy this structure, not the example's asset, text, top/width placeholders, z-index, or animation name. When removing a positioning group, convert its offsets to equivalent main-canvas coordinates on each image. Do not reset every asset to the example's position.
  - Keep interactive controls functional while images use `pointer-events-none`; controls must not become per-image positioning or animation wrappers. Preserve existing semantic controls and hit areas without changing the image's containing block. Keep the main `App.jsx`/`useScaleUI` canvas structure intact. Full-bleed backgrounds remain viewport-relative under the existing background rule; this is not permission to add per-asset wrappers.
  - **Asset naming:** `src={assetName}` represents the actual imported image variable, named for that asset (for example, `congratulationsBanner` for `congratulations-banner.webp`). For new images, set `alt` to a readable version of the asset image name without its file extension (for example, `alt="Congratulations banner"`); do not leave the literal placeholder `Asset image name`. Preserve existing meaningful alt text when reformatting tags. Do not add an animation class to the default image setup. Add one directly to the image only when implementing the actual animation, after defining the class and its keyframes in `src/index.css`.
  - **Screenshot-driven placement:** `top-[]` and `w-[]` are documentation placeholders only, not valid finished Tailwind values. When the user provides a reference screenshot for a new layout, determine each asset's top offset and width from the reference, convert those measurements to the main design canvas coordinates (1080×1920 by default), and replace the placeholders with explicit values such as `top-[420px]` and `w-[760px]` directly on that image. Account for viewport scaling and letterboxing rather than copying screenshot pixels blindly. Fill these values as part of implementation without asking the user to supply pixel measurements; verify the rendered result against the reference. Never leave empty placeholders in application code. When only reformatting existing images, retain their current values unless the user requests a layout change.
- Any element (`<img>`/`<video>` or a hardcoded-color `<div>`) that must render **wider than its containing block** (e.g. a decorative band bleeding past the fixed 1080px canvas) gets: explicit `w-[...]` (+ `h-[...]` if bleeding vertically) plus `max-w-none`, centered with `left-1/2 -translate-x-1/2`. `max-w-none` is load-bearing for `<img>`/`<video>` — Tailwind's preflight sets `img, video { max-width: 100% }`, silently clamping any explicit width back to the container's with no visible error; keep it on plain `<div>`s too for a consistent copy-pasteable pattern even though it's a no-op there. Examples:
  ```jsx
  {/* image asset bleeding past the canvas */}
  <img
    src={footer}
    alt=""
    className="absolute top-[725px] left-1/2 z-[15] h-[300%] w-[3000px] max-w-none -translate-x-1/2 object-fill select-none"
    draggable="false"
  />

  {/* hardcoded-color div bleeding past the canvas — no asset involved */}
  <div className="absolute left-1/2 top-[725px] bottom-0 z-[15] h-[200%] w-[1000%] max-w-none -translate-x-1/2 bg-[#FFE9E5]" />
  ```
- Styling is Tailwind CSS utility classes only — no custom CSS for these. Base html/body resets go as Tailwind classes directly on the tags in `index.html`. `--ui-scale` (written by `useScaleUI`) is consumed via Tailwind arbitrary-value utilities (`scale-[var(--ui-scale,1)]`), not a stylesheet rule.
- **MANDATORY: all project-authored animation styles belong in `src/index.css`.** Define every `@keyframes`, named animation class, transition, duration, delay, easing, fill mode, animated state, and `prefers-reduced-motion` override there using native CSS. This includes entrances, idle loops, CTA pulses, scene fades, reveals, and interaction feedback. Components only apply/toggle those named classes and handle lifecycle/gameplay events; keep the class definitions in `src/index.css`, even when the component owns the asset. Do not put animation declarations in inline styles, component-local stylesheets, CSS-in-JS, HTML `<style>` tags, or Tailwind `animate-*`/`transition-*`/`duration-*`/`delay-*`/`ease-*` utilities. Per-instance CSS custom-property values (such as particle trajectories and timing) may be supplied by JavaScript and consumed by the shared CSS definitions. Do not use `framer-motion`, other animation libraries, the Web Animations API, or JavaScript frame loops for visual animation. Layout scheduling such as `useScaleUI`'s `requestAnimationFrame` remains layout logic, not an animation definition. Preserve supplied third-party HTML deliverables as black boxes per the end-card rules; do not inject new project animation styles into them.
- **MANDATORY: every implemented entrance, asset animation, idle loop, and interaction motion must feel smooth.** Avoid abrupt starts/stops, flicker, jitter, snapping, and mechanical timing. Tune easing, travel distance, duration, and settling for the actual artwork; verify the entire motion and its handoff to the next state, not just the final frame. Follow these rules:
  - Prefer `transform`, `translate`, `scale`, `rotate`, and `opacity` for motion; keep animated transforms separate from layout/centering transforms as described below. Never animate layout properties such as `width`/`height`/`margin`/`top`/`left`. A simple `clip-path` reveal is allowed when it suits the artwork; use it sparingly and check its performance on target devices. Avoid large animated blurs, filters, and shadows.
  - Pick easing for the actual motion: entrances should decelerate into their final pose with `ease-out` or a tuned `cubic-bezier`, with a small overshoot/settle only where it fits. Use `linear` for constant-speed full rotations; use `ease-in-out` for sways and pulses that naturally slow at their turning points. Match the first and last poses and velocities of idle loops so the seam does not snap.
  - Match duration to motion and hierarchy: start around 450–900ms for a main entrance, 250–500ms for smaller supporting elements, and 60–140ms between related arrivals; adjust to the actual distance and artwork. The existing CTA idle pulse stays at 1.6s. Keep the sequence brisk and never delay essential interaction just to finish decoration.
- **MANDATORY CTA behavior when implemented: continuous idle pulse, optional entrance animation, and no click-triggered animation.** The implemented CTA is an explicit exception to the generic image setup having no default animation class. Use the existing `.animate-scale-pulse` directly on the image (`scale: 1` → `1.12` → `1`, 1.6s, `ease-in-out`, infinite). It starts automatically when the CTA appears, or after its optional entrance finishes, and then loops continuously. Preserve the reduced-motion requirement.
  - **STRICTLY REQUIRED FOR EVERY CTA: always include MRAID support AND destination redirect handling through the existing shared handler.** This applies to every new or edited CTA, including image-based CTAs, scene CTAs, and project-authored end-card click-through controls. Never leave a CTA with only visuals/animation, an empty handler, or navigation that bypasses the shared handler. Wire click/tap and keyboard activation to `openClickthrough()` from `src/components/cta.jsx`, which delegates to `window.__mip.openClickthrough()` in `index.html`. Preserve runtime destination resolution (`clickTag`, `clickTag1`, `clickthrough`, `clickThrough`), the guarded `mraid.open()` path, and the `window.open()` browser fallback. Keep the real ad-network bridge script and raw inline helpers intact; do not create a fake `window.mraid`, replace the handler with direct `window.location` navigation, or add a hardcoded destination. A destination may be supplied by the ad host at runtime: do not ask the user for a URL or block implementation/builds because no URL is configured locally. Preserve the existing no-destination fallback. Before considering any CTA implementation complete, verify that activation reaches the shared handler, uses guarded `mraid.open()` when usable, and otherwise follows its `window.open()` fallback. These are alternative navigation paths: do not open both for one activation. Preserve the existing error fallback, prevent duplicate activation from bubbling, and do not delay click-through or change the CTA pulse. Keep supplied third-party HTML internals untouched; wire the project-owned end-card control through the shared handler.
  - An entrance animation is allowed. Apply entrance and pulse classes directly to the same image, preserve its canvas-relative position and centering, and follow the property-ownership/sequential-handoff rules below so entrance and pulse do not compete. Define all entrance, pulse, and timing styles in `src/index.css`; do not add positioning or animation wrappers.
  - Clicking, tapping, or keyboard activation only calls the existing `openClickthrough()` immediately. Do not add a press scale, bounce, ripple, shake, fade, or exit animation on activation. Do not start, restart, pause, stop, or replace the pulse because of a click; keep the image mounted and its animation classes stable through activation. Do not wait for an entrance or pulse to finish before click-through. If the creative remains visible afterward, the pulse continues unchanged.
  - Implement the real CTA asset and interaction inside `src/components/cta.jsx`; leave the current bare button as a placeholder until that asset is provided. Follow the strict independent-image setup and provide an accessible button with a defined hit area covering the visible CTA without changing the image's containing block. Keep animation definitions exclusively in `src/index.css`; JSX applies classes, coordinates an optional entrance handoff, and handles click-through. Preserve a static keyboard focus indicator.
- **MANDATORY entrance direction: create dramatic, cinematic entrances with strong visual impact. Give every asset a different entrance animation.** Use asset-appropriate 3D folds, sweeping arrivals, flips, controlled pops, or other expressive movement. Choreograph and stagger the entrances into a cohesive sequence, with smooth easing, natural settling, and brisk pacing. Finish every asset at its intended position and proportions without residual distortion. Keep motion readable and purposeful; do not pile every effect onto every asset or invent new artwork.
  - **Create a distinct entrance sequence for each new creative built from this boilerplate, and a distinct entrance for each asset within it.** Do not reuse one canned entrance across projects or copy the same motion across assets with only a different delay. Differentiate each asset through its trajectory, reveal method, rotation axis, depth, overshoot, or settling character, chosen for its artwork and role. Use staggered timing to unify those different motions. Routine rebuilds of the same creative preserve its chosen animation; do not randomize or redesign entrances just because a build command runs.
  - **Protect the end-scene transition.** Entrance/motion improvements apply to the creative's regular assets and scenes only. Do not change the end scene's existing transition, its reveal/fade, or any animation leading into it. Preserve associated trigger timing, readiness callbacks, audio synchronization, and crossfade behavior. Do not rename or modify shared animation classes/keyframes used by that flow; create separate asset-specific definitions in `src/index.css` instead. If the end-scene flow has not been implemented yet, leave its placeholder unwired rather than introducing one as part of entrance work. Change this flow only when the user explicitly requests an end-scene change.
  - Useful directions include a perspective hinge/fold on one asset, an arcing sweep with follow-through on another, a controlled flip on another, and a compact pop with a soft settle on a smaller detail. These are examples, not a fixed sequence to repeat. For a flat supplied image, a fold can be a hinge-style reveal; do not split the asset into generated pieces or add animation wrappers. Apply any perspective/3D transform directly to that image through keyframes in `src/index.css`, preserving its standalone centering translate. Temporary perspective is allowed, but the final pose must restore intended readability, orientation, and proportions. Avoid unintended mirrored artwork and do not leave logos, text, or products stretched or skewed.
  - **Apply all image motion directly to the `<img>`; no nested animation wrappers or shared positioning groups.** Preserve the existing main canvas and put each asset's complete layout and named animation classes on its own image tag. Separate animation from centering by CSS property ownership on that same element, not by adding DOM layers.
  - **Never overwrite centering.** Tailwind v4's `-translate-x-1/2`/`-translate-y-1/2` use standalone `translate`; leave that property untouched in image keyframes. For directional travel, animate `transform: translate(...)` directly on the image while its standalone centering `translate` remains fixed, provided no other rule owns `transform`. End at `transform: none` when the base transform is neutral, or explicitly preserve the existing base transform. Independent `scale`, `rotate`, opacity, and reveal properties may also be animated without replacing centering; restore the intended final pose, static tilt, and proportions. Verify computed properties and final canvas-relative bounds.
  - **Entrance and idle motion share the image tag, never nested layers.** Use genuinely distinct properties for simultaneous animations, such as entrance travel on `transform` and idle pulse on standalone `scale`. If both need the same property, use an explicit sequential class handoff that removes the entrance animation before starting the idle animation, with matching final/initial poses. A delay alone does not prevent conflicts with fill modes. Keep all keyframes, timing, and animation declarations in `src/index.css`; JavaScript may only trigger the handoff/state change. Name classes and keyframes for the actual asset.
  - **Choreograph the scene in reading order.** Establish the main visual, introduce supporting detail, then draw attention to the CTA. Give each asset a distinct entrance while using stagger and pacing to connect them into one cinematic sequence; stagger alone does not satisfy the per-asset difference requirement. Use `animation-fill-mode: both` when needed to hold the initial pose during a delay and the final pose afterward. Full-bleed backgrounds must keep covering the viewport; keep their treatment distinct without exposing empty edges. Preserve the protected end-scene flow and the CTA rules: optional entrance, required continuous idle pulse, and no click-triggered animation.
  - Validate the delayed start, intermediate motion, final pose, idle handoff, and replay at portrait and landscape sizes. Check computed centering and final bounds against the static layout; look for flashes, clipped travel, distorted artwork, and competing transforms. Respect `prefers-reduced-motion` with a static final pose or a brief opacity transition, and make sure readiness/gameplay logic still completes if animation is disabled. Do not block essential controls behind long entrances or leave invisible controls intercepting taps.
- **Confetti/particle burst pattern** (win moment, etc.) — plain `<div>` pieces with randomized per-instance trajectory via inline CSS custom properties, one shared `@keyframes`:
  ```css
  /* src/index.css */
  @keyframes confetti-burst {
    0% {
      transform: translate(0, 0) rotate(0deg) scale(0.4);
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translate(var(--x), var(--y)) rotate(var(--rotate)) scale(1);
      opacity: 0;
    }
  }
  .animate-confetti-burst {
    animation: confetti-burst var(--duration, 2s) var(--delay, 0s) ease-out forwards;
  }
  ```
  ```jsx
  const CONFETTI_COLORS = ["#2563eb", "#ffffff", "#60a5fa", "#ffffff"];
  const CONFETTI_COUNT = 320;
  const CONFETTI_DURATION = 3200; // ms; should roughly match/exceed the longest per-piece duration

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 400 + Math.random() * 1300;
        return {
          id: i,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: 12 + Math.random() * 14,
          height: 20 + Math.random() * 20,
          delay: Math.random() * 0.2,
          duration: 1.6 + Math.random() * 1.2,
          rotate: (Math.random() - 0.5) * 900,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance + 200 + Math.random() * 300,
        };
      }),
    [],
  );

  {showConfetti && (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute left-[540px] top-[670px] animate-confetti-burst"
          style={{
            width: piece.width,
            height: piece.height,
            backgroundColor: piece.color,
            "--x": `${piece.x}px`,
            "--y": `${piece.y}px`,
            "--rotate": `${piece.rotate}deg`,
            "--duration": `${piece.duration}s`,
            "--delay": `${piece.delay}s`,
          }}
        />
      ))}
    </div>
  )}
  ```
  Must stay `overflow-visible`, never `overflow-hidden`, on the burst container — on any device whose aspect ratio isn't exactly 9:16, `overflow-hidden` would chop particles at the canvas edge well inside visible letterbox space instead of fading via their own opacity animation; only the real screen edges (`wrapperRef`/`main`) should clip. The origin point (`left-[540px] top-[670px]`) is hardcoded per-creative (e.g. a wheel's center) — reposition, don't treat as a fixed constant.
- When given a reference screenshot, scan it closely before implementing — aim for ~90% visual match (element sizes, spacing, offsets), measured per-element rather than eyeballed as a whole. Assets always come from the user (never fabricate placeholder art) — layout values (exact px offsets/widths/gaps) are the one place hardcoded numbers are correct. Compare a screenshot of the result against the reference before calling it done.
- Gameplay/mechanic logic is specified separately via prompts — don't infer game mechanics from a reference screenshot's visual alone.
- A background (image/video) goes on the viewport wrapper (`wrapperRef`), not inside the scaled `appRef`/`useScaleUI` canvas — full-bleed, not scaled/letterboxed. Typical shape: absolutely-positioned `inset-0` layer, lowest `z-*`, `w-full h-full object-cover`, pinned via `inset-0` (not `left-1/2 -translate-x-1/2`, to avoid transform-rounding inconsistency).
- Use `h-dvh`, never `h-screen` (`100vh`), for any element meant to fill the real screen (`main`, `wrapperRef`). `100vh` doesn't account for mobile browsers' collapsing address bar — this showed up as black bars in a real AppLovin WebView despite looking fine locally. Also set a matching background on `<html>`/`<body>` in `index.html` (currently `bg-[#17433E]`, not the generic `bg-white`) as a second line of defense.
- Same on the horizontal axis: `w-full`, never `w-screen` (`100vw`), for `main`/`wrapperRef` — `100vw` doesn't reliably match rendered width in sandboxed WebViews.
- **🚩 Hairline/strip/seam in an ad network's WebView** — three distinct confirmed causes; work through all three before treating it as a new bug:
  1. Seam on **one edge only**, invisible locally → Cause #1 below.
  2. Seam at the **boundary between two same-colored paint layers** → Cause #2 below.
  3. Strip in a **color absent from this project's own code/assets** → Cause #3 below (external chrome, not our layout math).
  Prerequisite check for #1: `h-dvh`/`w-full` and a matching `<html>`/`<body>` background are already in place (above).
- **Cause #1** — `appRef`/`useScaleUI` is deliberately **two nested elements, not one**. Root cause: the old single-div approach combined a percentage `translate` with `scale()` on the fixed 1080×1920 box; `scale()`'s rendered size is fractional, so the position offset and rendered width don't land symmetrically — most browsers absorb the leftover fraction, AppLovin's WebView doesn't, producing a one-sided seam. Fix, in place — don't revert:
  - `useScaleUI` rounds the *rendered* width/height to whole pixels first, re-derives `scale` from that, then derives `left`/`top` — written as `--ui-left/top/width/height/scale`.
  - `App.jsx` wraps the scene in an **outer**, transform-less positioning `<div>` sized from those vars, with `appRef` nested **inner**, holding the fixed, scaled canvas unchanged.
  - Keep this two-layer structure for any future `useScaleUI` scene — the bug only reproduces in real ad-network WebViews, never in Chrome/Playwright, so "looks fine locally" isn't sufficient verification.
- **Cause #2** — a line at the boundary between a solid background and a separate gradient/overlay div, even with matching hex colors (real incident: a bottom gradient band meeting the wrapper background above it). Fix: make the gradient/overlay span the **full** canvas as one continuous `background` with same-position hard-stops (e.g. `#17433E 0%, #17433E 65%, #112D2A 65%, #17433E 71.7%`) to fake a partial-height look, instead of stacking two separate paint layers.
- **Cause #1 can also read as flicker during a continuous animation**, not just a static seam. Real incident: a looping idle wheel rotation caused Android flicker — same root cause, a static scene just doesn't repaint often enough to expose the rounding error. Fix is the same two-layer migration, plus: `wrapperRef` needs `overscroll-none` too (not just `html`/`body`/`main`), and double-check `appRef` has no leftover `will-change-transform`. Treat flicker correlated with a new/changed looping animation as Cause #1 first.
- **Do not add `backface-visibility: hidden`/`will-change: transform` to `appRef`** — tried as a fix for soft/blurry text under the `scale()` transform, it reintroduced the hairline-seam bug (confirmed by removing it). For asset softness instead: cap `<img>` render width at/below native resolution, or accept it as inherent to the scale-transform architecture.
- **Cause #3** — a strip in a color absent from this project's own code/assets (e.g. a stray navy sliver) — external chrome (ad-network preview tool, WebView letterboxing, safe-area inset), not our layout math. Fix: add `viewport-fit=cover` to the viewport meta tag, and a matching background on both `<html>` and `<body>` in `index.html`. If the color *does* match something in our own CSS, it's Cause #1/#2 instead.
- **Sound effects triggered by anything other than a direct tap** (`setTimeout`, `animationend`, a state-driven `useEffect`) silently fail on iOS — Safari only allows `.play()` on an element already played once inside a real gesture. Fix, in `src/hooks/useSound.js` — always wire such sounds through it: it auto-unlocks every element in every registered pool on the player's first tap anywhere (play-then-synchronous-pause, unawaited, muted as a second line of defense against an audible blip). Reference: `gamewinAudio`/`endcardAudio` in `App.jsx`. Sounds that already fire synchronously inside a tap/drag handler (`click.mp3`) don't need this — a plain `new Audio(src).play()` per call is fine, and lets overlapping plays layer instead of cutting off.
- **Two different one-shot `useSound` cues overlapping reads as one looping sound**, even though neither actually loops. Real incident: `gamewin.mp3` still playing when `endcard.mp3` started ~1.5s later. Two fixes: (1) explicitly `.pause()` every other in-flight `useSound` ref before playing a scene-transition sound (see `triggerEndScene` in `App.jsx`); (2) guard any "final" cue reachable from multiple code paths with a `useRef` fired-once boolean, and reset `audio.currentTime = 0` before every `.play()` on a reused element — a mid-playback `.play()` can silently no-op instead of restarting.
- **Looping bgm can fail with `NotAllowedError` in some ad-network preview tools even inside a real, trusted gesture handler.** Root cause (isolated via debug overlay): the `Audio` object itself was **constructed** before any gesture (a persistent ref created at mount) — not *when* `.play()` was called. Fix, in place — don't revert: construct bgm's `Audio` fresh on the first real gesture (`handleFirstInteraction` in `App.jsx`), never pre-created at mount even muted. Track unlock state with a 3-value ref (`"locked"|"pending"|"unlocked"`) so a rejected play resets to retry, not a plain boolean that permanently gives up. Listen on multiple gesture event types on the wrapper *and* piggyback the first in-game tap handler.
  - Debug-overlay technique (reusable for "silent failure, no console" reports): a `?debug=1`-gated on-screen `<div>` logging every gesture (`event.type`+`isTrusted`) and `.play()` outcome, plus a polling check of `audio.paused`/`muted`/`currentTime`.
- **iOS ignores `HTMLMediaElement.volume` set from JS** — output stays tied to hardware volume. A `useSound` priming/unlock play silenced with `audio.volume = 0` was actually audible on iOS, making reveal/end-card/scratching sounds all fire at once on first touch. Fix: mute priming plays with `audio.muted = true` (iOS respects it), keep `.volume = 0` for other browsers, reset `.muted = false` right before the real play.
- **The first unlock/priming `.play()` must fire on a discrete gesture (`pointerdown`/`touchstart`/`click`), never a move event (`pointermove`/`touchmove`)** — even mid-drag from a valid touch, WebKit doesn't count move events as a qualifying gesture for a media element's first play. Symptom if broken: player has to touch, lift, and scratch again before sound works. Fix: keep the unlock in `handlePointerDown` (it's inaudible anyway — muted + synchronous pause); only the real, audible playback is safe to defer to a later event in the same gesture.
- **`useSound` uses a per-sound pool of `Audio` instances, not one instance per sound** — needed for any SFX that can overlap itself or be restarted quickly (rapid repeated taps). `useSound(src, { poolSize, desktopPoolSize })`: `poolSize` sizes the pool on iOS/Android, `desktopPoolSize` sizes it on desktop (defaults to `poolSize`). Always play through the exported helpers — never call `.play()` on a pool element directly:
  ```jsx
  const catchAudio = useSound(catchSound, { poolSize: 3, desktopPoolSize: 1 });
  const source = playSound(catchAudio, { volume: 0.8 }); // picks an idle instance, resets currentTime, plays
  stopSound(source); // cuts it off early if needed
  ```
  - Platform detection (`isMobileMediaPlatform()`) must not just check touch support — a touchscreen Windows laptop has to stay on the desktop path, not get routed to the mobile retry logic. Detect iOS/Android via UA, **plus** iPadOS-in-desktop-mode (`navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1` — iPadOS 13+ reports as desktop Safari in the UA string but is still a touch WebView needing the mobile path; real Macs report `maxTouchPoints === 0`).
  - Desktop keeps the existing global-`pointerdown`-primes-everything contract. Mobile additionally exposes `handleUnlockGesture()` — call it directly from a draggable/interactive element's own native event listeners (attach to the DOM node itself, not only a React prop; some mobile WebViews require audio authorization on the touched element specifically, not through React's delegated events), on `pointerdown`/`pointermove`/`pointerup`. It primes every pool instance (not just one — a spare pool element that never got primed stays blocked when it's later rotated in) and retries any timer-delayed cue that was previously rejected — required for reliable drag-to-start audio on iOS/Android, where a delayed `.play()` can get silently re-blocked well after the original gesture.
- **AppLovin MIP / MRAID v2 compliance: never touch `window.mraid.*` (or start layout/interaction/media/orientation logic) until MRAID is confirmed out of `"loading"`.** AppLovin's validator scans the *built* HTML for exact literal patterns, so placement matters as much as behavior:
  - `index.html`: `<script src="mraid.js"></script>` first in `<head>` (reserved filename, ad network swaps in the real bridge; 404s harmlessly in a plain browser). Right after it, a **plain inline `<script>`** (no `type="module"`) defines `trackMraidReadiness()`/`window.isMraidUsable(mraid)`. It must stay a raw inline script — Vite never touches classic inline scripts, but it does minify/rename anything in bundled JS, which would break the validator's literal-name text scan. Don't move this into a bundled `.js` file.
  - Immediately after that, a **second raw inline `<script>`** defines `window.__mip.ready(fn)` and `window.__mip.openClickthrough()` — see the confirmed incident below before touching either.
  - A **third raw inline `<script>`** defines `window.__mip.setupMediaViewability()` — pauses/resumes real `<video>`/`<audio>` elements via `mraid.isViewable()`/`viewableChange` (doesn't cover JS `Audio()` instances like `useSound`/bgm, only DOM elements). This used to live in bundled JS (`src/utils/mraidViewability.js`) with a local `const mraid = window.mraid` alias — the exact same minification risk as the loading-state guard/`mraid.open()` (a minifier renames that local alias, erasing the literal `mraid.isViewable()`/`viewableChange` text) — so it moved into the raw script alongside `ready`/`openClickthrough`, per the general rule below.
  - `src/main.jsx` gates the React mount behind an idempotent `init()`, calling `window.__mip.ready(init)` rather than re-implementing the loading-state guard itself, also calling `window.__mip.setupMediaViewability()` first.
  - `src/components/cta.jsx`'s `openClickthrough()` just calls `window.__mip.openClickthrough()` — the actual `mraid.open()` guard logic lives in the raw script in `index.html`, not in this file. Reuse `openClickthrough` for any other click-out. `mraid.open()`, never `window.location`/`<a href>`, is the only spec-correct click-through — those cause click-tracking discrepancies and can be unsupported outright on some exchanges.
  - **Confirmed incident: a validator kept flagging "missing loading-state guard" and "missing guarded `mraid.open()`" even though `main.jsx`/`cta.jsx` had functionally-correct, spec-shaped code.** Root cause, found by inspecting the actual minified `dist/index.html`: these two pieces lived in bundled JS (`type="module"` scripts), and Vite/esbuild's production minifier (1) renames local variables (`const mraid = window.mraid` became `const mi = window.mraid`, erasing the literal `mraid.getState()`/`mraid.open(` substrings) **and** (2) collapses simple `if/else` into ternary expressions, destroying the `if (mraid.getState() === "loading")` *statement shape* entirely — independent of variable naming. Referencing `window.mraid` directly (no local alias) fixed the naming half but the validator still failed, because the ternary-collapse issue remained.
    - **Fix, in place — don't revert:** the loading-state guard and the `mraid.open()` guard now live as literal, hand-written code inside the second raw inline `<script>` in `index.html` (`window.__mip.ready`/`window.__mip.openClickthrough`), written in the exact `if (...) { ... } else { ... }` shape AppLovin's guide shows, using a bare `var mraid = window.mraid` local (safe here — raw inline scripts are never minified). The bundled React code (`main.jsx`, `cta.jsx`) just calls into these two globals instead of re-implementing the logic.
    - **General rule:** any code whose *literal source text* AppLovin's validator scans for (not just its runtime behavior) must live in a raw, non-`module` inline `<script>` in `index.html` — never in `main.jsx`, `cta.jsx`, or any other file that goes through Vite's bundler/minifier. This already applied to `trackMraidReadiness()`/`isMraidUsable()`; it now also applies to the loading-state guard and the `mraid.open()` call. If a future MRAID requirement needs new literal-sensitive code, add it to that same raw script block, not to bundled JS.
  - `cta.jsx` is currently only reachable via the unwired `endscene.jsx` in addition to being wired up in `App.jsx`/`SelectionOutcome.jsx` directly via `openClickthrough` — wiring `Cta`/`EndScene` in reuses the same guaranteed-literal `window.__mip.openClickthrough()` path.
- **Don't gate an audio cue's start behind the same movement threshold used for its visual mechanic** — start the sound on the raw `pointerdown`, decoupled from any "has the player dragged far enough" gameplay check. Real incident: a scratch-sound only started once drag distance crossed the pixel-erasing trigger threshold, reading as "hold then scratch" instead of one gesture. Fix: start the sound directly in `handlePointerDown`, not inside the drag-threshold branch in `handlePointerMove` — the visual mechanic still correctly waits for real movement. General rule: touch-feedback audio keys off the rawest gesture event, not a downstream gameplay threshold tuned for a different purpose.

## Architecture

This is a minimal React 19 + Vite boilerplate, currently empty aside from scaffolding — treat any app-specific logic as not yet written.

- `src/main.jsx` — React root. **Gates the mount behind AppLovin MIP's MRAID readiness guard** (idempotent `init()`, passed to `window.__mip.ready()` — defined in `index.html`'s raw inline script, not here — before calling `createRoot().render(<App />)` in `StrictMode`, also calls `window.__mip.setupMediaViewability()` first) — see the Conventions entry on AppLovin MIP compliance before changing this file.
- `src/App.jsx` — entry component. Always wires up `useScaleUI` here (top-level): `wrapperRef` gets a `relative h-dvh w-full overflow-hidden overscroll-none` div — `overscroll-none` here (not just on `<html>`/`<body>`/`<main>`) is load-bearing, confirmed by a real flicker incident, see Conventions. Inside it, a transform-less **outer** positioning `<div>` sized from `--ui-*` vars, with `appRef` nested **inner**, holding the fixed 1080×1920 canvas (`scale-[var(--ui-scale,1)]`). This two-layer split fixes a real hairline-gap rendering bug in AppLovin's WebView — see Conventions before changing it. Don't call the hook again inside individual scenes/components.
- `src/hooks/useScaleUI.js` — resize-aware hook scaling the fixed-size canvas (default 1080×1920) to fit the viewport. Rounds rendered width/height to whole pixels first, then derives `scale`/`left`/`top` from those (order matters, see Conventions), writing five CSS custom properties via inline style: `--ui-scale`, `--ui-left`, `--ui-top`, `--ui-width`, `--ui-height`. Consumed in `App.jsx` via Tailwind arbitrary-value utilities, not stylesheet classes.
- `src/hooks/useSound.js` — always wire this in for any sound effect not triggered synchronously by its own tap (a delayed/`setTimeout`- or `animationend`-driven sound). `useSound(src, { poolSize, desktopPoolSize })` returns a pool ref; play via the exported `playSound(pool, { volume })`/`stopSound(source)` helpers, never `.play()` directly. Also exports `handleUnlockGesture()` for components that need mobile drag-gesture priming/retry beyond the built-in desktop `pointerdown` unlock — see Conventions before reimplementing any of this by hand.
- `src/components/cta.jsx` — `Cta` button component and `openClickthrough()`. `Cta` is currently a bare `<button className={className}>` placeholder (no default styling/animation) — waiting on the real CTA asset, see the Conventions entry on the standard CTA pulse before adding it. **AppLovin MIP / MRAID v2 compliant**: `openClickthrough()` just delegates to `window.__mip.openClickthrough()` (defined in `index.html`'s raw inline script, not this file) — the actual click-target resolution, `mraid.open()` guard, and `try/catch` all live there so the validator-scanned literal text survives Vite's minifier. Reuse `openClickthrough` for any other click-out — see Conventions before touching either.
- `src/index.css` — Tailwind import and the sole home for all project-authored animation and transition styles, including keyframes, timing, state classes, and reduced-motion overrides. Layout styling stays in Tailwind utilities.
- `index.html` — besides the standard document shell, has four `<head>` scripts required for AppLovin MIP compliance, in order: the `<script src="mraid.js">` bridge, a plain inline `<script>` defining `trackMraidReadiness()`/`window.isMraidUsable()`, a second plain inline `<script>` defining `window.__mip.ready()`/`window.__mip.openClickthrough()`, and a third plain inline `<script>` defining `window.__mip.setupMediaViewability()`. All four must stay raw (non-`module`) inline scripts in exactly this order — see Conventions before touching any of them.
- `src/assets/` — static assets, provided by the user per creative. Currently only `src/assets/sounds/` has files; no image assets yet (`Cta`'s asset is still pending — see Conventions). Fonts (Open Sans) are present but currently unused.
- `src/components/endscene.jsx` — the end card, whichever of the three patterns below applies. Currently holds the **HTML SIP pattern** with a placeholder template at `src/images/endscene/endscene.html` (swap for the real deliverable when provided) — see the pattern below for the fade-in transition wired around it. **Not imported/wired into `App.jsx` yet** — leave it unwired until told to hook it up.

## End scene (SIP/MIP) patterns

The end card can arrive as one of three fundamentally different things — check which one before touching anything. Whichever it is, implement it **inside the existing `src/components/endscene.jsx`** — replace its contents rather than creating a new, separately-named component file. `endscene.jsx` is the one end-card file for this project, regardless of which pattern it currently holds.

**1. HTML SIP (third-party single-image-playable template as a raw `.html` file).**
Pre-built, self-contained — treat it as a black box. Never rewrite, "clean up", or reimplement its internals. Wire it exactly like this:

- Import as a raw string with Vite's `?raw` suffix: `import sipHtml from "../images/endscene/endscene.html?raw";` (plain text at build time, not parsed).
- Patch a bridge `<script>` in before `</head>` that forwards the parent window's ad-network globals into the iframe's own `window` (the SIP template's buttons expect `mraid`/`clickTag`/etc. on *its own* window, not the parent's):
  ```js
  const bridgeScript = `
  <script>
    try {
      window.mraid = parent.mraid || window.mraid;
      window.clickTag = parent.clickTag || window.clickTag;
      window.clickTag1 = parent.clickTag1 || window.clickTag1;
      window.clickthrough = parent.clickthrough || window.clickthrough;
      window.clickThrough = parent.clickThrough || window.clickThrough;
    } catch (error) {}
  </script>`;
  const sipHtmlWithBridge = sipHtml.replace("</head>", `${bridgeScript}</head>`);
  ```
- Render in a sandboxed iframe via `srcDoc` (not `src`): `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`. `allow-same-origin` is what lets the bridge script reach `parent.*`.
- Layer a full-screen transparent `<button>` on top calling `openClickthrough()` (from `cta.jsx`) on tap, as a safety net independent of the SIP template's own click handling.
- The SIP template may already contain its own MRAID handling internally; leave it alone — treat it as a black box, never rewrite/"clean up" its internals.
- **Fade-in transition to avoid a white blink**: a freshly-mounted iframe shows a blank white document for a few hundred ms while it parses/paints — revealing it immediately (or hard-cutting from a previous scene) causes a visible flash before the end card appears. Fix, reference implementation in `endscene.jsx`:
  - A `visible` state (default `false`) toggles named classes on the root wrapper. Define `.end-scene-fade { opacity: 0; transition: opacity 500ms ease-out; }` and `.end-scene-fade.is-visible { opacity: 1; }` in `src/index.css`; the component applies `end-scene-fade` and adds `is-visible` when ready. Keep the reduced-motion override in `src/index.css` as well.
  - On the iframe's `onLoad`, wait **two** `requestAnimationFrame` calls (guarantees a real paint pass happened, not just that the load event fired) before revealing — one rAF alone can still land before the frame actually paints.
  - A ~1200ms fallback `setTimeout` also reveals, for ad sandboxes where `load` never fires — cleared on unmount, and made a no-op if the real `onLoad` path already fired first (both paths call the same guarded `reveal()`, which only runs once).
  - Play the end-scene sound (via `useSound`) when `visible` flips true, not on mount — keeps the audio synced to what the player actually sees instead of firing while the iframe is still blank.
  - Optional `onReady` prop, called the moment `visible` flips true, so a parent component can coordinate a crossfade with whatever scene is showing underneath (e.g. fading out an intro at the same time) — not wired to anything yet since there's no such intro scene in this scaffold.

**2. Asset-based end scene** (built from images/layout, no third-party HTML). Always wire `useScaleUI` the same way `App.jsx` does. Since there's no self-contained click handling, the whole card is made tappable with a full-screen transparent `<button>` (on the wrapper, not inside the scaled canvas):
  ```jsx
  <button
    type="button"
    aria-label="Open offer"
    className="absolute inset-0 z-30 h-full w-full"
    onClick={openClickthrough}
  ></button>
  ```
  On top of (not instead of) any dedicated `Cta` button inside the scaled canvas, if the design has one.

**3. Video end scene.** Do **not** wire `useScaleUI` — a `<video>` fills/covers its container directly (`w-full h-full object-cover`) rather than living on the fixed 1080×1920 scaled canvas. Overlay it with the same full-screen transparent `<button>` above so tapping anywhere opens the click-through.

Build setup (`vite.config.js`): `@vitejs/plugin-react`, `@tailwindcss/vite`, and `vite-plugin-singlefile` (inlines all JS/CSS/assets up to 1MB into a single `dist/index.html` — no separate asset files are emitted).

**AppLovin MIP packaging constraint**: the final `dist/index.html` must be **5MB or smaller** and fully self-contained — no remote `http(s)://`/protocol-relative/WebSocket resources, no runtime `fetch`/XHR/`sendBeacon`/dynamic imports/service workers calling external URLs (the relative `<script src="mraid.js">` bridge is the one exception, since the ad host supplies it). Keep this in mind as real assets (images, sounds, video) get added — check the built file size, not just that it builds successfully.
