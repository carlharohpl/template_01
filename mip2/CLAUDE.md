# CLAUDE.md

## Mandatory project rules

**STRICTLY REQUIRED - Every applicable rule in this guide is mandatory, including temporary demos, whether or not its label is repeated.** Shortening this guide or removing repeated STRICT labels does not relax any requirement. Apply the same enforcement to current rules and future updates, preserving their stated scope and exceptions; do not treat unlabeled rules as optional. Preserve existing gameplay, assets, positions, scaling, media, lifecycle, and MRAID behavior during targeted changes. Reuse established files/utilities; avoid unrelated refactors and extra architecture. Examples describe structure, not permission to add content.

- React + JavaScript only — no TypeScript.

## Architecture and ownership

The boilerplate is empty apart from scaffolding; do not assume historical example gameplay/audio variables exist.

| File | Required responsibility |
| --- | --- |
| `src/App.jsx` | Main composition, gameplay/state, scene flow, top-level `useScaleUI(1080, 1920)`. |
| `src/main.jsx` | Idempotent `init()` via `window.__mip.ready(init)`; call `setupMediaViewability()` before rendering React `StrictMode`. |
| `src/hooks/useScaleUI.js` | Resize-aware canvas sizing, pixel rounding, five `--ui-*` properties, two-layer layout below. |
| `src/components/cta.jsx` | CTA imports, markup, appearance/position, hit area, local click handling, shared `openClickthrough()`. |
| `src/components/endscene.jsx` | HTML SIP, asset-based, or video card; overlay, readiness, fade, cleanup. Reuse this file. |
| `src/hooks/useSound.js` | Audio pools, gesture unlock/retry, `playSound`, `stopSound`, `handleUnlockGesture`. |
| `src/hooks/calendarClock.js` | Optional shared calendar utility, not a React hook; only for calendar content in either view. |
| `src/hooks/base64Packaging.js` | Node-only Vite plugin, never a browser import; preparation, Base64, validation, size checks. Validates existing MRAID, does not inject its engine. |
| `src/index.css` | Tailwind import, authorized local fonts, ALL project-authored motion definitions. |
| `index.html` | Shell, Tailwind resets, matching viewport background, ordered raw MRAID scripts. |
| `src/assets/` | User-supplied assets. Available/unused files do not authorize fonts, text, SFX, or demo UI. |

Create components only for separate scenes, reusable UI, or substantial self-contained interaction. Keep simple images/one-off markup in `App.jsx`; no per-asset components or wrappers. Extracted components own imports, markup, sizing/position, styling, animation classes, and local interactions. Parents coordinate visibility/callbacks without duplicating or overriding layout. Fragments are allowed; preserve independent asset elements.

## Reference screenshots and design measurements

- **STRICTLY REQUIRED - 100% reference-match target:** match every state's positions, dimensions, spacing, alignment, proportions, colors, authorized typography, and layering. Measure rather than guess; do not approximate or change composition. Compare screenshots at reference size using overlays/image differences, correct discrepancies, and verify responsive scaling. Report unresolved asset, resolution, or rendering limitations instead of claiming perfection. Use supplied artwork; no fabricated placeholders or unauthorized text/fonts. Mechanics come from gameplay prompts, not visual inference.
- **STRICTLY REQUIRED - 1080 x 1920 canvas per reference state**, unless the user specifies otherwise. Measure each asset's top-left X/Y and width; apply values independently in its owning element/component, preserving proportions. Convert left-edge X to center X when centering. Map resized/multi-panel screenshots back using each panel's bounds, uniform scale, and offsets; never copy preview pixels directly or stretch axes independently. Preserve `useScaleUI` and verify against the actual reference; artboard dimensions alone do not determine asset positions.

## Image assets

**Position every foreground image independently**, including components/end scenes. Each supplied image keeps its own import and `<img>`, canvas-relative position, width, centering, z-index, and applicable motion classes. No composite generation, sprites, CSS background stacks, canvas merging, shared sizing/position/transform groups, or animation wrappers. Preserve already-composite artwork unless asked to split it. Viewport backgrounds, intentional bleed, and supplied third-party HTML are the documented exceptions.

Use this exact multiline structure/order. Extra attributes follow `draggable` on separate lines; keep each attribute value together. Replace placeholders before finishing:

```jsx
<img
  src={assetName}
  alt="Asset image name"
  className="pointer-events-none absolute left-1/2 top-[] z-30 w-[] -translate-x-1/2 select-none"
  draggable="false"
/>
```

- Use meaningful imported variables and readable asset-name alt text without extensions; preserve existing meaningful alt text. No literal example names, empty arbitrary utilities, or copied example positioning.
- Set width only and preserve natural proportions; no fixed-height stretching/cropping except intentional background/bleed sizing. Put measured canvas-relative values directly on each tag. Convert offsets when removing groups without moving assets; each asset stays independently editable.
- Use Tailwind directly. Images retain `pointer-events-none`, `select-none`, and `draggable="false"`. Preserve semantic controls, correct hit areas/containing blocks; controls must not become positioning wrappers.
- Ordinary images/text have no default animation. Define requested motion in `src/index.css` before applying its class directly. The implemented CTA's mandatory pulse is the exception.

## Text assets and fonts

**No unsolicited text/fonts.** Do not invent/hardcode headings, copy, labels, captions, CTA wording, or placeholders. Select/import/download/register/apply fonts only when requested. Lettering in artwork stays artwork unless live text is authorized. Preserve existing text, fonts, localization/dynamic content, accessible names, and diagnostic logs.

### Missing text assets: ask and wait

**STRICTLY REQUIRED - MISSING TEXT ASSETS: ASK AND WAIT.** Before implementation, check all reference text against supplied assets/composites and authorized text. Group missing elements and ask: **"Will you provide these text assets, or authorize HTML text? If HTML, confirm the wording and font."** Leave those elements pending until assets arrive or wording/font are explicitly approved; clarify unresolved choices, reuse prior approval, and continue independent work. Screenshots, readable copy, available fonts, or general build instructions are not authorization. No automatic OCR/transcription, guessed/system fonts, temporary text, CSS/canvas/SVG replacements, generated artwork, or screenshot crops to bypass approval. Never claim completion while required assets or decisions remain missing.

### Authorized text and font implementation

- Use semantic `h1`-`h6`, `p`, or `span`, independent positioning, no per-label wrappers/components; preserve reading order and related inline emphasis. Dynamic content remains an expression.
- Expanded markup: opening tag, each attribute, content, closing tag on separate lines. Put static design values directly in one literal `className`: interaction; position/size/centering; selection; font family/size/weight/line-height/spacing; alignment/color; motion classes. No hidden static styling in style objects, computed builders, shared wrappers, or generic classes.
- Use width/natural height without clipped wrapping and optional identifying JSX comments. Do not give text image-only attributes. Use images only for supplied text artwork. Examples do not authorize default fonts/copy.
- Register an authorized local font's family/style/weight through `@font-face` in `src/index.css`, select through Tailwind, and verify wrapping/positions after load. No remote fonts.
- Interactive labels stay in semantic controls with click, focus, keyboard behavior and accessible names; decorative utilities must not disable controls. Button typography belongs on the button/existing label.

### Asset and text verification

Review changed images/text for exact structure, independent explicit positioning, dimensions/typography, valid utilities, no shared groups, preserved scaling, and reference match. Do not add sample art/text/fonts to demonstrate conventions.

## Scaling, backgrounds, and WebView seams

### Canvas and viewport layout

- Layout uses Tailwind, including html/body resets. Consume `--ui-scale` with `scale-[var(--ui-scale,1)]`, not custom layout CSS.
- Call `useScaleUI` at the main scene root, not individual children. `wrapperRef`: `relative h-dvh w-full overflow-hidden overscroll-none`. Inside retain transform-less outer positioning using `--ui-left/top/width/height`, then fixed 1080x1920 inner `appRef` using `--ui-scale`.
- Round rendered width/height to whole pixels FIRST, derive scale, then left/top. Never merge positioning/scaling into one percentage-centered element: fractional positioning causes real WebView seams/flicker even if desktop looks correct.
- Full-screen elements use `h-dvh`/`w-full`, never `h-screen`/100vh or `w-screen`/100vw. Retain wrapper/main/html/body overscroll suppression, matching creative html/body backgrounds, and `viewport-fit=cover`.

- No `will-change: transform`, `backface-visibility: hidden`, or blanket GPU/compositor hints on appRef/positioning/scaling containers. For softness, cap image width at native resolution or accept inherent scaled rendering.

### Backgrounds and oversized assets

- Full-bleed image/video backgrounds belong on the viewport wrapper OUTSIDE the scaled canvas: absolute `inset-0`, lowest z-index, `w-full h-full object-cover`; no centering translate. Keep backgrounds steady.
- Oversized/bleeding images, videos, or color divs require explicit width, height only where intentional, `max-w-none`, and `left-1/2 -translate-x-1/2`. Preflight otherwise clamps image/video width; retain `max-w-none` on bleed divs for consistency.

### White lines, hairline strips, seams, and flicker

1. One-sided seam or animation-correlated flicker: verify whole-pixel sizing, two layers, wrapper overscroll suppression, no canvas compositor hints.
2. Boundary between same-colored layers: use one full-canvas gradient/overlay with same-position hard stops instead of separate meeting paint layers.
3. Color absent from project assets/CSS: investigate external preview chrome, letterboxing, safe areas; use matching html/body backgrounds and `viewport-fit=cover`. Project-colored strips return to 1/2. Desktop/emulation cannot disprove a real-host defect.

## Animation

### CSS ownership

**All project-authored keyframes, animation classes, transitions, durations, delays, easing, fill modes, animated states, and readiness/visibility pauses belong ONLY in `src/index.css`.** Includes entrances, idles, CTA pulses, scratch/reveals, fades, confetti, feedback, demos. Define/reuse CSS first; JSX only toggles named classes and coordinates lifecycle.

No animation declarations in inline styles, component stylesheets, CSS modules/CSS-in-JS, HTML style tags, Tailwind config or built-in/arbitrary animation/transition utilities. No Framer Motion, other motion libraries, Web Animations API, or JS visual frame loops. Per-instance CSS custom-property values may feed shared CSS (particles, for example), not relocate declarations. Layout/startup frame scheduling is allowed. Preserve supplied third-party HTML internals under the end-card exceptions; do not inject project animation styles there.

### Reduced-motion behavior

**Active motion MUST remain identical under `prefers-reduced-motion: reduce` and `no-preference`, including changes during playback:** timing, delay, easing, iterations, trajectory, transform, opacity, appearance, completion. No preference-driven CSS, `motion-safe:`/`motion-reduce:`, or `matchMedia()` branches suppressing/replacing motion. Fix source conditions; no preference spoofing/blanket `!important`. Preserve readiness/hidden pauses, user/gameplay stops, finite completion, cancellation/cleanup. Do not add motion, infinite loops, or placeholder scenes because of this rule.

### Mandatory entrance lifecycle

1. Preload actual sources and attempt `HTMLImageElement.decode()` where supported. Handle caches, load failure, unavailable/rejected decoding, and cancellation with a bounded fallback; one failed image must not block others.
2. Commit initial PAUSED CSS states on the same mounted assets. Once preparation settles, wait TWO NESTED `requestAnimationFrame` callbacks, then start once. No arbitrary delay/single frame, hidden completed entrance, or remount restart. Frames provide rendering opportunities, not proof of a WebView paint.
3. Animate foregrounds separately; keep backgrounds and scaling containers steady. All preparation/running/completed/pause states remain in `src/index.css`.
4. Synchronize existing authorized SFX and hold/completion timers to that guarded start, not mount/preload. Preserve gesture unlock and `useSound`/`playSound`; rejected audio cannot block visuals. Do not add SFX to satisfy this rule.
5. Guard starts/cues/timers/handoffs once per entry, including StrictMode/rapid changes. Cancel both frames, timers, listeners, pending callbacks on exit/unmount; reset only for intended replay and allow valid remount. Keep fallbacks for missing/interrupted animation events.

### Entrance design and transform ownership

- Give each new creative AND each animated foreground a distinct cinematic entrance: suitable hinge/fold, sweep, flip, pop, depth, overshoot, settling. Delay changes alone do not qualify. Choreograph main visual, support, CTA with stagger/smooth pacing. Routine rebuilds preserve chosen motion.
- Animate the image directly, no wrappers, generated pieces/new art, whole-scene or background entrance. Perspective/3D is allowed in keyframes; finish readable, correctly oriented/proportioned/static-tilted, without mirroring/stretching/skew.
- Never overwrite Tailwind v4 standalone centering `translate` (`-translate-x-1/2`/`-translate-y-1/2`). Travel on `transform` only if otherwise unowned; finish at `none` for neutral bases or preserve the base transform. Independent scale/rotate/opacity/reveal may coexist with distinct ownership.
- Entrance/idle share the image: separate properties (entrance transform, idle scale) OR remove entrance before idle with matched poses. Delay alone does not solve fill-mode conflicts. Use asset-specific names and `animation-fill-mode: both` when needed; verify computed centering/final bounds.
- Preserve existing end-scene transition/reveal/incoming animation, timing, readiness, sound sync, crossfade during regular entrance work. Do not rename/change its shared definitions; create separate asset classes. Leave an unimplemented end scene unwired unless explicitly requested.

### Performance and interaction

- Prefer transform/translate/scale/rotate/opacity; never animate width/height/margin/top/left. Simple clip-path is allowed sparingly after performance checks; avoid large animated blur/filter/shadow effects.
- Entrances decelerate with ease-out/tuned cubic-bezier; constant rotations use linear, sway/pulse ease-in-out. Match loop endpoint poses AND velocities. Starting guides: main 450-900ms, support 250-500ms, stagger 60-140ms; tune to artwork/travel. CTA stays 1.6s. Essential input must not wait for decoration.
- Keep pointer handlers short; avoid whole-scene rerenders/layout churn, separate reads/writes, use capture when needed and handle release/cancel. Scope gesture/scroll suppression to the play surface. Preserve synchronous native audio unlock/MRAID; invisible controls must not intercept taps.
- Target stable 60fps on supported 60Hz devices (~16.7ms/frame). Profile lower-powered hardware; bound particles/effects/texture sizes/paint cost. Simplify stutter without losing gameplay/feedback. Check CSS support and place simpler fallbacks in `src/index.css`; desktop performance is insufficient evidence.

### Confetti and particles

- Confetti: plain div particles, stable randomized per-instance trajectories through `--x`, `--y`, `--rotate`, `--duration`, `--delay`, and shared CSS keyframes. Burst container stays `pointer-events-none overflow-visible`; only screen edges clip, not canvas/letterbox edges. Set origin/count/colors/sizes/timing for the creative; removal timing must cover the longest particle.

### Required motion QA

Inspect intermediate progress, final bounds/poses, entrance-idle handoff, audio sync, transitions, full interaction/replay. Cover portrait/landscape, resize/orientation, rapid input, interrupted drag, hide/resume, delayed/failed decoding, repeated entry, unmount during preparation, both motion preferences and mid-motion changes. Verify pauses/cleanup, once-only starts/cues/timers, no flashes/clipping/distortion/transform conflicts, and completion without animation events.

Test available WebKit/Chromium, iOS Safari/WKWebView, Android Chrome/WebView, desktop and actual devices/ad hosts. Profile stutter/long tasks/input lag. Correct available-check failures; lint/rebuild runtime changes. Report unavailable coverage: emulation, screenshots, or isolated fixtures do not establish physical-device smoothness or a complete flow. Lack of device access does not waive implementation requirements.

## Audio and gesture reliability

Use only authorized audio; CTA-specific sound is forbidden below. Preserve existing sources/content/timing unless requested.

- Delayed/state/timer/animation SFX MUST use `useSound`. Unlock pools on the first qualifying gesture with unawaited play then synchronous pause. Prime EVERY instance with `muted = true` and `volume = 0`; iOS ignores JS volume but honors muted. Unmute before real playback.
- Use `useSound(src, { poolSize, desktopPoolSize })`, `playSound(pool, { volume })`, `stopSound(source)`; never directly play a pool element. Desktop size defaults to poolSize; helpers select idle instances/reset playback. Non-pooled synchronous tap/drag SFX may use fresh `Audio` per play for overlap.
- Initial priming requires discrete pointerdown/touchstart/click, never movement alone. Desktop retains global pointerdown priming. Mobile calls `handleUnlockGesture()` in native listeners ON the interactive DOM node (not only React delegated props), on pointerdown/move/up. Keep pool-wide priming and retry of previously rejected delayed cues; movement retry does not replace initial discrete priming.
- Detect iOS/Android by UA plus iPadOS desktop mode (`navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1`), not touch alone; touchscreen Windows stays desktop.
- Touch-feedback audio starts on raw pointerdown independently of visual movement thresholds. Before a scene-transition cue, stop other in-flight sounds to avoid overlapping one-shots sounding looped. Guard final cues once and reset reused media `currentTime = 0` before replay.
- Construct looping BGM's Audio in the first real gesture, never at mount even muted. Use `locked | pending | unlocked` state; rejected playback must permit retry. Listen on multiple wrapper gestures and the first gameplay tap.
- For silent host failures, a diagnostic `?debug=1` overlay may record gesture type/isTrusted, play outcomes, paused/muted/currentTime. No ordinary user-facing debug UI.

## MRAID and shared click-through

**No `window.open` anywhere in shipped source, comments, strings, dead code, headers, supplied cards, or generated/decoded HTML.** No equivalent aliases/bracket notation/other globals/obfuscation, location navigation, hardcoded destination, fake bridge, local-preview or error fallback. Explanations in this unbundled guide must not enter creative comments.

### Raw scripts and validator requirements

Preserve exact `index.html` script order:

1. `<script src="mraid.js"></script>` FIRST in head: reserved host bridge; absence/404 in ordinary browsers must not trigger navigation fallback.
2. Raw non-module inline `trackMraidReadiness()` / `window.isMraidUsable(mraid)`.
3. Raw non-module inline `window.__mip.ready(fn)` and literal `window.__mip.openClickthrough = function handleMraidOpen() { ... }`.
4. Raw non-module inline `window.__mip.setupMediaViewability()`.

Validator-sensitive source, including future additions, stays literal/unminified here. Retain exact `if (mraid.getState() === "loading") { ... } else { ... }` statement shape and `mraid.open(clickTarget)`. Raw `var mraid = window.mraid` is safe here; bundling can rename it/collapse if/else to a ternary. Never move guards into bundled React files.

### Readiness and media viewability

- Do not begin layout/interaction/media/orientation or MRAID-dependent work while loading. Preserve readiness tracking; main gates idempotent init with `window.__mip.ready(init)` and sets up viewability before React.
- Keep raw `mraid.isViewable()`/`viewableChange` for DOM video/audio; this does not manage JS Audio pools/BGM.

### Destination resolution and guarded navigation

- Resolve exactly `window.clickTag || window.clickTag1 || window.clickthrough || window.clickThrough || ""`. Reject ONLY resolved non-strings (`typeof clickTarget !== "string"`); falsey values fall through, truthy non-strings are rejected. No trim/truthiness/nonblank guard. Pass strings unchanged, including whitespace/empty; absent targets MUST call `mraid.open("")` when usable. Host-supplied runtime destinations do not require a local URL or block builds.
- Call only `mraid.open(clickTarget)` after callable open, callable `window.isMraidUsable`, and true `window.isMraidUsable(mraid)`. Keep try/catch and bridge-error logging. Missing/loading/unusable returns silently; no "CTA blocked" warning. Every final call has an explicit argument. Only the documented import preparation corrects argument-free calls; surviving ones fail validation.

### Shared activation log and control wiring

- Every project-authored click-out calls exported `openClickthrough()` in cta.jsx. That ONE helper logs exactly `console.log("CTA clicked")` immediately before synchronous `window.__mip.openClickthrough()`. Do not duplicate/bypass/rename/conditionally disable/strip it, even for invalid targets or missing/loading/throwing bridges, unless explicitly requested. It confirms activation, not successful navigation.
- Each control stops propagation: one activation, one log, at most one MRAID attempt. No timer/effect/animation deferral. Import Cta for dedicated CTA buttons and shared helper for overlays. Continue buttons that only change scenes MUST NOT click out.

### Click-through verification

For CTA/end-card changes, scan source, supplied/decoded HTML and EVERY affected export for forbidden navigation. Check first script and raw guards, not only build success. Test pointer/keyboard, ready/missing/loading/throwing bridges, destination order, absent/empty/whitespace strings, rejected non-strings, production once-only log, and no browser fallback. Fix source and rebuild affected exports.

## CTA appearance and behavior

### Component ownership and hit area

- Only real supplied CTA assets in `src/components/cta.jsx`; leave the empty semantic button unmounted otherwise. This file exclusively owns imports, markup, top/left, width, centering, z-index, colors/type/borders, hit area, and applied animation classes. Parents render `<Cta />` and coordinate visibility/callbacks; no parent styling, layout props/className/style overrides, positioning/sizing/motion wrappers.
- Use independent-image markup, accessible semantic button, static keyboard focus indication, centered hit area covering full 1.2x width AND height. Update image/hit area together without changing its containing block.

### Idle pulse and optional entrance

- Required pulse directly on image: `.animate-scale-pulse`, scale 1 at 0%/100%, scale 1.2 at 50%, `animation: scale-pulse 1.6s ease-in-out infinite`, ONLY in `src/index.css`. Never restore 1.12/change timing/easing. Start on appearance or after optional entrance; retain readiness/hidden pauses and identical reduced-motion behavior.
- Optional entrance shares that image with independent properties or sequential handoff. Activation adds no press/bounce/ripple/shake/fade/exit effect and never restarts/pauses/accelerates/replaces pulse. Keep image mounted/classes stable; click-through is immediate, pulse continues if visible.

### CTA audio prohibition

- **No CTA audio:** never attach/preload/unlock/play sounds for appearance, pulse, hover/focus, pointer/touch, click/keyboard. No useSound/playSound/Audio/media play in CTA controls/shared handler or indirect gameplay/scene cue workaround. Promotional and full-screen end-card controls only stop propagation, shared-log, synchronous MRAID. Preserve separately authorized gameplay/BGM/end-scene media; only explicit later CTA-audio authorization changes this rule.

## End scenes

Implement the supplied type in existing `src/components/endscene.jsx`, not a duplicate. No demonstration placeholders. All types require the shared full-screen overlay and readiness-gated 500ms fade. App owns scene flow; component owns content/interaction.

### HTML end cards: import, iframe, and parent bridge

- **HTML SIP:** preserve internals except required MRAID fix, narrow compatibility corrections, recognized calendar preparation. Import editable `.html?endcard` (for example `import sipHtml from "../assets/endscene/endscene.html?endcard";`). The module exports UTF-8 decoded HTML; do not decode again. Use iframe `srcDoc`, NOT src, with `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`; same-origin enables parent access.
- Before `</head>`, insert the existing try/catch bridge forwarding parent mraid, clickTag, clickTag1, clickthrough, clickThrough into corresponding iframe globals with `parent.value || window.value`. Preserve compliant SIP MRAID internals. Bridge/overlay does NOT sanitize bad handlers: remove forbidden navigation/comments through the narrow required fix, preserving target/readiness/media/orientation/layout logic.

### Asset-based and video end cards

- **Asset-based:** established useScaleUI scene-root/two-layer structure; individual children do not invoke extra hooks.
- **Video:** no useScaleUI; `w-full h-full object-cover` fills the container.

### Shared full-screen click-through overlay

- Every type gets a transparent full-viewport semantic button (`type="button"`, `aria-label="Open offer"`, `absolute inset-0 z-30 h-full w-full`) on the wrapper OUTSIDE the scaled canvas. Stop propagation then shared openClickthrough once. Preserve keyboard/focus; keep design-required dedicated CTA too, without duplicate activation. Hidden overlay must not intercept gameplay.

### HTML import corrections and SIP metadata

- During dev AND production, in memory before validation/encoding, remove ONLY exactly empty `src=""` from source directly inside video filled at runtime; convert argument-free executable-script/inline-handler mraid.open() to mraid.open(""). Preserve supplied arguments, comments/strings, URLs, media/layout/animations. These and recognized calendar preparation are narrow exceptions, not unrestricted repair/disk rewriting. Reject other invalid content clearly.
- In `<script id="sip-builder-config" type="application/json">`, ONLY `videos.portrait.name`, `videos.landscape.name`, `dynamicTexts.<index>.font.fileName` may hold original-upload media basenames without `/`, `\`, `:`. Preserve metadata; no duplicate-file demand/removal. This exempts no actual src/URL/path/remote/arbitrary JSON/Base64/raw HTML/navigation fields. Keep JSON parse errors distinct from content validation.

### Mandatory fade lifecycle

1. Start `visible = false`, retain the same wrapper with `end-scene-fade`. ONLY in `src/index.css`: `.end-scene-fade { opacity: 0; transition: opacity 500ms ease-out; }` / `.end-scene-fade.is-visible { opacity: 1; }`. Add is-visible at guarded reveal; no hard cut, alternative entrance, inline transition, remount, reduced-motion shortcut.
2. Wait iframe onLoad, settled image preload/decode with failure handling, or available video-frame data/existing ready poster; THEN two nested animation frames. No timer/single-frame replacement for normal readiness.
3. Keep ~1200ms missing-readiness fallback. It and readiness share one guarded two-frame scheduler/reveal per entry. Late/repeated events cannot replay fade/sound/callback. Keep previous scene/background/poster behind it to prevent white loading/fallback flashes.
4. At reveal synchronize existing authorized end-scene sound through useSound/playSound with gesture unlock; failed audio cannot block visuals, and do not add SFX. Invoke parent onReady once if used; preserve crossfade, completion timing, focus, active overlay/MRAID.
5. Exit/unmount cancels both frames, fallback, listeners, late async callbacks. Reset only for intentional entry/replay and permit remount. Preserve readiness/hidden pauses.
6. Verify intermediate opacity/final state; normal/delayed/missing readiness, fallback, repeated loads, unmount-before-reveal, replay/remount; one fade/cue/callback, no white flash/hidden interception, unchanged scaling/MRAID. Test both motion preferences/available browsers, lint/rebuild runtime changes, report unavailable coverage.

## Conditional calendar and date previews

**Activate only for dynamic calendar dates, weekdays/months, or holiday content in gameplay OR end cards.** Static artwork/ordinary elapsed/countdown timers do not qualify. When neither view needs it: no calendar import/init/exposure/listeners/bundle content, date UI, or automatic URL mutation. Do not add gameplay date labels for an end-card-only calendar.

### Shared clock and URL contract

- Reuse calendarClock.js singleton BEFORE render/mount; all views share it, no copied parsers or new clocks on entry. Gameplay exposes `window.__mip.calendarClock` before trusted cards. Recognized calendar-enabled `.html?endcard` imports automatically import/expose this SAME singleton even without gameplay dates/imports.
- Use parsePreviewDate/createCalendarClock. Read FIRST `URLSearchParams.get("date")`; require exact YYYY-MM-DD and compare local year/month/day after numeric `setFullYear()` (including years 00-99) / `setHours(12, 0, 0, 0)`. No rollover, string `new Date("YYYY-MM-DD")`, or UTC calendar key.
- Valid preview stays fixed until reload, including delayed end cards; now() returns fresh Date objects. Invalid/empty/absent uses device date except missing-date auto previews below. This previews calendar dates, NOT time of day.
- All live displays/holiday lookups use shared clock, never `format(new Date())`. Preserve requested format/locale (MMM DD YYYY/long/etc.), independently of YYYY-MM-DD input. No invented copy/fonts.
- Apply offsets/recurrence AFTER base selection, e.g. `resolveSipEffectiveDate(calendarClock.now().getTime(), dateRecurrence, dateOffsetDays)`. Viewing-date holiday ranges use unoffset clock.
- Reuse localDateKey, validateHolidayRanges, holidayText(clock,ranges,defaultText). Require valid inclusive local ranges, start <= end, string text; FIRST configured match wins overlap, otherwise default. Fixed year-specific ranges never recur automatically; do not invent ranges/change recurrence.
- Never replace global Date/Date.now or override animations, elapsed time, debounce/click/analytics timestamps, video/lifecycle scheduling, countdown/count-up timers. Timer preview needs separate authorization.
- Normal views use subscribeCalendarClock with cleanup. Refresh local midnight and focus/pageshow/visibility/resume, including supported MRAID viewability. Next midnight uses REAL device time/DST, not preview/offer offset. Preview has no midnight timers; avoid duplicate subscriptions.

### Automatic AppLovin, localhost, and local-file previews

- Retain readAppLovinPreviewSearch: accessible immediate HTTPS parent exactly `playable.applovindemo.com`; path `/Preview/`, `/Preview/index.html`, or `/Preview/mobilePreview.html` (case-insensitive); same-origin child path starts `/phaser/`.
- Explicit creative date wins/prevents parent insertion. Otherwise preserve parent dates including invalid/empty/duplicates; unrelated child parameters must not hide them. If absent in both, set today's LOCAL key with `url.searchParams.set("date", localDateKey(new Date()))` and `parent.history.replaceState(parent.history.state, "", url.href)`; initialize from resulting search.
- **STRICTLY REQUIRED - automatic local previews:** retain `readLocalPreviewSearch()` in `calendarClock.js`. When calendar content activates the module and `window.parent === window`, allow `file:` or HTTP/HTTPS with hostname exactly `localhost`, `127.0.0.1`, or `[::1]` (any port). Add today's LOCAL `date=YYYY-MM-DD` only when absent, using safe URL construction and `history.replaceState(history.state, "", url.href)`. For example, `http://localhost:5173/` gains today's date automatically. Preserve existing date values, other parameters, hash, and history state; no reload or navigation. This runs in development and exported HTML, never as a date baked into a build. If neither gameplay nor end cards need calendar content, DO NOT activate this feature or mutate the URL.
- Browser URLs use `Reflect.construct(URL, [value])`. Preserve all existing date values, other parameter values, hash/history state, AppLovin thm/h/h2/h3/n/n2/n3. Standard serialization may normalize encoding/empty separators. No hardcoded/UTC date, reload/navigation/new history entry.
- Catch blocked parent/history access, fall back without blocking creative. Never generalize mutation beyond the explicit AppLovin, top-level local-file, and loopback-host scopes above: no LAN addresses, lookalike hostnames, ordinary remote HTTP/HTTPS pages, embedded local previews, unrelated hosts/protocols, cross-origin parents, or live ads.
- Auto previews freeze today's date. Edit address bar then Enter/reload to apply a new date without overwriting it. Direct HTML uses `?date=2026-09-29`, existing query uses `&date=2026-09-29`. URL edits without reload do not recreate clock.

### End-card calendar integration and detection limits

- Keep calendarEdits/prepareEndCardCalendar in Node packaging. Prepare recognized `.html?endcard` calendar code IN MEMORY during dev AND production before validation/Base64. Never rewrite supplied disk HTML, patch decoded calendar strings at runtime, duplicate shared helpers, or broadly replace timestamps.
- Recognized: zero-argument new Date receivers of toLocaleDateString/toDateString/getFullYear/getMonth/getDate/getDay; direct Date.now or new Date().getTime as FIRST resolveSipEffectiveDate argument; direct Intl.DateTimeFormat(...).format(new Date()) with supported calendar-only options. Preserve formatting/offset/recurrence/other args. Existing `window.__mip.calendarClock` references also activate setup. Timestamp/countdown-only code must not.
- Generated import exposes parent clock before mount; prepared HTML inserts parent-clock bridge before inline date scripts, using exact parent.__mip.calendarClock. Keep trusted/same-origin access. Bundled helper also reuses accessible parent clock; search fallback: own nonempty query, then parent query, then empty. srcdoc does not inherit query automatically.
- Isolated frames/separate URLs need explicit validated-date URL/message transport, checked sender/expected origin/schema/date, and initialization BEFORE display. Preserve query params through safe URL construction/searchParams.set. Transport is NOT automatic; no-override production keeps real date.
- Detection is limited, NOT data-flow analysis: review variable-held dates, custom/minified formatters, computed options, time-of-day mixes, inline handlers, unrecognized logic. Wire calendar consumers explicitly. Correct ambiguous rejected SIP bases; never silence errors/rewrite unrelated timers. Passing packaging does not prove arbitrary supplied-card compatibility.
- Keep validateHtml checks on executable scripts in whole outer export and recursively decoded HTML/SVG. Recognized unconverted calendar expressions fail. Inspect actual cards, not just gameplay/Base64 strings. Gameplay uses shared clock directly; no bypass or export-only patches.

### Calendar QA and cleanup

Test dev AND actual exports with real supplied cards where present, at least two timezones:

- Valid 2026-10-29, 2027-01-01, leap 2028-02-29. Invalid 2026-02-29, 2026-02-30, 2026-13-01, 2026-00-01, 2026-10-00, 2026-1-1, hello, empty. Absent, unrelated params, duplicates including invalid-first/valid-second.
- Holiday boundaries/neighbors/defaults/overlaps, fixed-year nonrecurrence, offsets, mutation resistance, delayed mount, frozen until reload, midnight/resume/DST/cleanup.
- AppLovin, localhost/loopback, and actual top-level file insertion; manual reload, invalid/empty/duplicate preservation, child priority/unrelated queries, iteration params, hash/history, no repeated insertion, and no mutation outside supported scope/blocked access. Verify local previews in development and served exports, including creatives without calendar content.
- Gameplay-only, end-card-only, both, neither/timer-only builds. Clock before iframe, automatic preview without gameplay date import/UI, identical delayed-card date, preserved offsets/native timestamps, omitted unused module.
- Unchanged gameplay/motion/input/audio/MRAID. Report unavailable hosts/devices; distinguish fixtures/local response substitution from actual supplied card/uploaded AppLovin creative. Inaccessible outer query alone is insufficient. Lint/rebuild affected exports; no development-only flag.

On requested demo removal, remove test text/state/subscriptions/unused imports/exposure only after checking BOTH views. Retain clock support while either needs it; otherwise verify absence from bundle and no date insertion. Retain reusable helpers/build checks.

## Build commands, Base64 packaging, and validation

### Commands and title requirement

- Prefer Yarn (both lockfiles exist): `yarn dev`, `yarn build`, `yarn preview`, `yarn lint`.
- Production emits one self-contained `dist/index.html`. No permanent test suite or `test:build` command is configured.
- **Before every build**, check the `<title>` in `index.html`. If the tag is missing, empty, or contains only whitespace, **ask the user what title to use and wait for their answer before building**. Insert their supplied title, then continue the build. Never guess a title or build with a missing/blank title. This applies to all builds, including template, validation, temporary-output, and production builds. If a nonblank title already exists, preserve it and build without asking again.

**Every production build MUST retain the pipeline and final validation.** Never disable checks, raise limits, suppress failures, or deliver invalid output as successful.

### Build pipeline and Base64 encoding

- Keep React, Tailwind, vite-plugin-singlefile, and base64Packaging() in vite.config.js; `assetsInlineLimit: () => true`, `modulePreload: false`. Exactly one dist/index.html: no separate JS/CSS/media/copied public assets or 1MB per-asset cutoff. Node plugin never enters browser components.
- Gameplay AND end-scene images/audio/video/fonts/SVG use Vite asset flow/supported local CSS and valid nonempty Base64. Unused assets need not ship. No multimedia `?raw`, `?noinline`, `?no-inline`. Base122 is not implemented.
- `.html?endcard` inlines supported local media and encodes ENTIRE prepared HTML at BUILD TIME; generated module UTF-8-decodes for iframe. Keep source editable: no manual Base64 source blobs, `.html?raw`, complete raw HTML strings in JS, runtime btoa on raw imports. Source scripts/styles already inline except mraid.js; fix unsupported references. Same-path replacements repackage automatically; moves/renames require import updates preserving suffix. Plugin does not create/wire React components.
- Keep outer HTML shell, gameplay JS/CSS, and validator-visible MRAID scripts UNENCODED. Single-file does not mean Base64-encoding the outer document.

### Asset, URL, and final-output validation

- **No empty assets:** never restore `<link rel="icon" href="data:," />` or equivalent empty data references in source/cards/exports, even to suppress favicon requests. A requested favicon needs nonempty valid Base64 image/correct MIME; changing a prefix cannot repair an invalid payload.
- **Validator-safe URLs:** retain `Reflect.construct(URL, [value])`. No shipped JS constructor/call-shaped `URL(...)` tokens (case/whitespace variants included), even comments/strings: host may mistake them for CSS assets. Retain validateUrlTokens across full HTML and decoded HTML/SVG. Actual CSS still needs valid Base64/supported fragments; never weaken validation. Applies WITH or WITHOUT calendars.
- Validate AFTER bundling/inlining AND verify written file: canonical nonempty Base64; UTF-8/document round-trip against intended prepared content; decoded HTML/SVG; resource attributes (src/href/poster/srcset/etc.) and CSS URLs; raw HTML; calendar/navigation checks; preserved raw MRAID. mraid.js remains FIRST and sole host-provided external resource exception; no runtime external-resource loading or inlined fake bridge.
- Before EVERY build scan source/supplied HTML for empty data/forbidden navigation; after build inspect EVERY generated creative for those and non-Base64 media. Validate payloads, not labels. Encoding cannot hide violations. Fix source/rebuild affected exports, never only patch an earlier export.

### Size limit and media optimization

**Size:** measure actual final HTML bytes after inlining/Base64 expansion, not gzip or 5MiB. Hard max **5,000,000 bytes**; fail above with actual size/limit. Target **4,900,000 bytes or less**, preserve warning above target. Report delivered bytes (logs may also show decimal MB).

**Compression is NOT automatic.** If oversized, retain recoverable originals outside shipped output, optimize working copies of largest media, rebuild/revalidate to target. Preserve quality/transparency/proportions/display dimensions, audio content/timing, gameplay, required assets/SFX/end scene. No removing required content or repeatedly recompressing the only original. Review lossy quality; report constraints if acceptable optimization cannot reach target.

### Packaging verification

For packaging changes verify unchanged supplied bytes/intended decoded document; both import corrections in dev/production; allowed metadata; failures for path/invalid filename labels, missing/external media, malformed/empty Base64, raw HTML, forbidden navigation, surviving argument-free MRAID, oversized output. Confirm real iframe/media/SFX/shared CTA behavior with the MRAID matrix. Do not weaken checks for tests; distinguish fixtures from actual creative/device/host coverage.

## Permanent infrastructure and resets

Removing a test CTA, Continue button, date display, end scene, or UI state/imports MUST NOT delete/revert:

- Shared once-only log/synchronous MRAID; raw order/names/guards, exact target chain, explicit empty fallback, silent missing/loading and thrown-error handling.
- CTA pulse/silence/ownership; end-scene parent bridge, full-screen overlay, readiness-gated 500ms fade/handoff/cleanup. Unwired endscene.jsx is allowed after reset; every future real card still follows these rules.
- Node packaging, narrow in-memory compatibility/calendar preparation, metadata exceptions, safe URLs, decoded/outer/written-file validation, single-file Base64, exact size limits. Zero active card imports means zero packaged documents, NOT disabled validation.
- Optional calendar source and AppLovin/localhost/local-file previews, uninitialized/unbundled when neither view has calendars. Removing demo UI MUST NOT remove `readLocalPreviewSearch()` or its loopback support.

Delete supplied assets ONLY when requested. After demo removal verify retained helpers/rebuild affected exports under title rule. Do not claim removed UI was exercised; use temporary fixtures when needed. Resetting content must not weaken this guide.
