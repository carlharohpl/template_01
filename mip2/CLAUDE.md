# CLAUDE.md

## 1. Mandatory workflow and ownership

**STRICTLY REQUIRED: Every applicable rule below is mandatory, including demos and future updates. Shorter wording or an omitted STRICT label never makes a rule optional. Preserve scope and exceptions.** Read this entire guide and inspect current code before editing. Reuse established architecture; make minimal changes, preserving unrelated gameplay, assets, positions, scaling, audio, lifecycle, and MRAID. Examples authorize no new content. Do not assume historical demo variables exist in this empty scaffold.

- React + JavaScript only — no TypeScript.
- Components are for separate scenes, reusable UI, or substantial interaction; simple images/one-off markup stay in App. No per-asset components/wrappers. Components own imports, markup, layout, styling, motion classes, local interaction; parents coordinate visibility/callbacks without layout overrides. Fragments allowed.

| File | Ownership |
| --- | --- |
| `src/App.jsx` | Gameplay/state, composition, scene flow, root `useScaleUI(1080, 1920)`. |
| `src/main.jsx` | Idempotent `window.__mip.ready(init)`; `setupMediaViewability()` before React `StrictMode`. |
| `src/hooks/useScaleUI.js` | Resize, pixel rounding, five `--ui-*` properties, two-layer canvas. |
| `src/components/cta.jsx` | CTA assets/layout/hit area/interaction; shared `openDestination()`. |
| `src/components/endscene.jsx` | Supplied HTML/asset/video card, overlay, readiness, fade, cleanup. |
| `src/hooks/useSound.js` | Pools, gesture unlock/retry, `playSound`, `stopSound`, `handleUnlockGesture`. |
| `src/hooks/calendarClock.js` | Optional shared calendar utility, not a React hook. |
| `src/hooks/base64Packaging.js` | Node-only Vite preparation/Base64/validation/size plugin; never browser-import. Validates existing MRAID, does not inject its engine. |
| `src/index.css` | Tailwind, authorized local fonts, ALL project-authored motion. |
| `index.html` | Shell/resets, viewport background, ordered raw MRAID scripts. |
| `src/assets/` | Supplied assets; unused files authorize no text/fonts/SFX/demo UI. |

## 2. Exact screenshot/reference matching

**STRICTLY REQUIRED: Target 100% of the approved layout through measurement, not guessing.** Match every state's positions, dimensions, spacing, alignment, proportions, colors, authorized typography, and layering.

1. Confirm approved target when references differ; each panel is a separate gameplay state. Mechanics come from gameplay prompts, not visual inference.
2. Identify actual panel bounds; exclude only confirmed editor chrome, borders, letterboxing. Never crop to force aspect ratio. Artboard size alone does not locate assets.
3. Map each panel uniformly onto **1080 x 1920** (substitute dimensions only when explicitly approved):

   ```text
   scale = min(panelWidth / 1080, panelHeight / 1920)
   offsetX = panelX + (panelWidth - 1080 * scale) / 2
   offsetY = panelY + (panelHeight - 1920 * scale) / 2
   canvasX = (referenceX - offsetX) / scale
   canvasY = (referenceY - offsetY) / scale
   canvasWidth = referenceWidth / scale
   canvasHeight = referenceHeight / scale
   ```

   Never copy reduced-preview pixels directly or scale axes independently. Preserve `useScaleUI`/viewport-background exceptions.
4. Measure every top-left, width/height, alignment, z-order, shared row/column, gap, banner, logo, CTA. Apply values independently in owning elements; centered X = `canvasX + canvasWidth / 2`. Inspect native sizes/transparent padding: element bounds differ from visible artwork. Preserve aspect ratios; measured height does not authorize stretching/cropping.
5. Use supplied assets and the missing-assets/text approval procedure below; no fabricated placeholders. Capture matching viewport/state/animation phase (especially CTA pulse). Compare actual rendered bounds/pixel rounding using overlays/image differences where available; correct, recapture, repeat.
6. Verify portrait/landscape and required banner/overlay viewport bounds without changing scaling architecture. Preserve accepted layouts. Report unresolved differences, asset/resolution/rendering limits, unavailable comparison tools/devices. Never claim Figma node coordinates from screenshots or exact/100% match without verification.

## 3. Independent assets and authorized text

### Images

Each foreground image, including components/end scenes, keeps its own import, `<img>`, canvas position, width, centering, z-index, motion classes. No generated composites, sprites, background stacks, canvas merging, shared sizing/position/transform groups, animation wrappers. Preserve supplied composites unless asked to split. Exceptions: viewport backgrounds, intentional bleed, supplied third-party HTML.

Use exact order/multiline structure; extra attributes follow `draggable`, one per line. Keep attribute values together. Replace placeholders with measured values/meaningful imports/readable asset-name alt text without extensions; preserve existing meaningful alt text:

```jsx
<img
  src={assetName}
  alt="Asset image name"
  className="pointer-events-none absolute left-1/2 top-[] z-30 w-[] -translate-x-1/2 select-none"
  draggable="false"
/>
```

- Tailwind directly on each tag; width only/natural proportions except intentional background/bleed sizing. No fixed-height stretching/cropping, copied example coordinates/names, empty utilities. Convert offsets when removing groups without moving assets.
- Preserve semantic controls/hit areas/containing blocks; controls must not become positioning wrappers. Keep image pointer/selection/drag protections.
- No default image/text motion except required CTA pulse. Define requested CSS first, apply classes directly.

### Missing assets and text: ASK AND WAIT

**No unsolicited hardcoded copy or font selection/import/download/registration/use.** Preserve supplied lettering, authorized text/fonts, dynamic/localized expressions, accessible names, diagnostic logs.

**STRICTLY REQUIRED: Check every reference element against supplied assets/composites and existing authorized implementations BEFORE implementing it. If required artwork or text is missing, STOP that element's implementation, identify the missing items, ASK, and WAIT.** Group missing artwork (logos, photos, illustrations, decorative graphics) and ask: **"Will you provide these assets, or authorize recreating them?"** For missing text ask: **"Will you provide these text assets, or authorize HTML text? If HTML, confirm the wording and font."** Proceed only after assets arrive or the specific recreation is explicitly approved; live text also requires confirmed wording/font. Clarify unresolved choices, reuse prior explicit approval, and continue only independent work that does not rely on missing items. Never silently omit required elements or claim completion while assets/decisions remain pending.

**Code recreation also requires ASK AND WAIT, even when technically straightforward.** If a reference element has no supplied asset or already-authorized implementation but can be recreated in code, identify it, propose the method, and ask: **"I can recreate [element] from the reference using [HTML/CSS/etc.]. Should I code it, or will you provide an asset?"** Do not implement it before explicit approval. This includes plain backgrounds, rectangles, borders, basic shapes, and button surfaces; simplicity is NOT an exception. After approval, match the measured reference and follow project rules. Approval for a button rectangle/border does NOT authorize its missing text, logo, or artwork; text still requires confirmed wording/font. Reuse prior explicit approval for the same element without asking again.

Screenshots, readable wording, available fonts, and general build instructions are NOT recreation approval. No automatic OCR/transcription, guessed/system fonts, temporary text/artwork, CSS/canvas/SVG substitutes, generated art, or screenshot crops to bypass the wait. Approved recreation remains subject to the project's implementation and asset rules.

### Authorized live text

- Semantic `h1`-`h6`/`p`/`span`, independently positioned; no per-label wrappers/components. Preserve reading order, related inline emphasis, dynamic expressions. Images only for supplied artwork; no image-only attributes on text.
- Separate lines for opening tag, each attribute, content, closing tag; keep values together. One literal `className` holds static values in order: interaction; position/size/centering; selection; font family/size/weight/line-height/spacing; alignment/color; motion. No static style objects/computed builders/shared wrappers/generic classes hiding layout.
- Width/natural height, no clipped wrapping; identifying JSX comments optional. Authorized local fonts: `@font-face` family/style/weight in index.css, selected via Tailwind; verify positions/wrapping after load. No remote fonts.
- Interactive labels retain semantic controls/accessibility/click/focus/keyboard; typography on button/existing label. Decorative utilities cannot disable controls.
- Review changed assets/text for exact markup, independent positioning, dimensions/typography, valid utilities, proportions, scaling/reference match. No sample content to demonstrate rules.

## 4. Scaling, backgrounds, WebView seams

- Tailwind layout/resets; `scale-[var(--ui-scale,1)]`. Root-only useScaleUI, not children: `wrapperRef` uses `relative h-dvh w-full overflow-hidden overscroll-none`; transform-less outer layer uses `--ui-left/top/width/height`; fixed 1080x1920 inner `appRef` uses `--ui-scale`.
- Round rendered width/height FIRST, derive scale then offsets. Never merge positioning/scaling into one percentage-centered element. Fullscreen: `h-dvh w-full`, never `h-screen`/100vh/`w-screen`/100vw. Preserve wrapper/main/html/body overscroll suppression, matching creative html/body backgrounds, `viewport-fit=cover`.
- No canvas/positioning-container `will-change: transform`, `backface-visibility: hidden`, blanket compositor hints. For softness, cap width at native resolution or accept inherent scaled rendering.
- Full-bleed image/video background: viewport wrapper OUTSIDE scaled canvas, `absolute inset-0`, lowest z-index, `w-full h-full object-cover`, no centering translate; steady background. Bleeding images/videos/color divs: explicit width, intentional height only, `max-w-none`, `left-1/2 -translate-x-1/2` (avoids Preflight clamping).
- Hairline/flicker: check whole-pixel sizing, two layers, overscroll, compositor hints. Same-color paint boundaries: one full-canvas gradient/overlay with same-position hard stops. Colors absent from project: investigate host chrome/letterboxing/safe areas/matching backgrounds; project-colored strips require layout/paint checks. Desktop/emulation cannot disprove real-host defects.

## 5. Motion and lifecycle

**ALL project-authored motion belongs ONLY in `src/index.css`:** keyframes/classes/transitions/timing/easing/delays/fill/animated/readiness/visibility states for entrances, idles, CTA, scratch/reveal, fades, confetti, feedback, demos. JSX toggles named classes/lifecycle only. No inline/component/CSS-in-JS/HTML/Tailwind-config motion declarations or built-in/arbitrary motion utilities; no motion libraries, WAAPI, JS visual frame loops. Per-instance CSS variables may feed shared definitions; layout/startup rAF allowed. Preserve supplied third-party HTML under end-card exceptions; no injected project animation styles there.

**Active motion stays identical under `prefers-reduced-motion: reduce` and `no-preference`, including mid-play changes:** timing/delay/easing/iterations/trajectory/transform/opacity/appearance/completion. No preference-driven suppression/replacement (`motion-safe:`/`motion-reduce:`/matchMedia included), spoofing, blanket `!important`; fix source conditions. Keep readiness/hidden pauses, gameplay/user stops, finite completion, cancellation/cleanup. This authorizes no extra motion/loops/placeholders.

### Entrances

1. Preload real sources, attempt `HTMLImageElement.decode()` where supported. Handle cached/failed/unavailable/rejected decoding/cancellation with bounded fallback; one failure cannot block others.
2. Mount SAME assets in PAUSED initial CSS states. After preparation settles, wait TWO NESTED `requestAnimationFrame` callbacks, start once. No arbitrary delay/single-frame substitute, already-finished hidden entrance, remount restart. rAF is a rendering opportunity, not proof of WebView paint.
3. Animate foregrounds separately; backgrounds/scaling containers stay steady. Sync authorized SFX/hold/completion timers to guarded start, not mount/preload; use useSound/playSound/gesture unlock. Failed audio cannot block visuals; add no SFX.
4. Guard starts/cues/timers/handoffs once per entry, including StrictMode/rapid changes; cancel frames/timers/listeners/late callbacks on exit/unmount. Reset only intended replay, allow remount, retain missing/interrupted-animation-event fallbacks.
5. Each new creative and animated foreground gets a distinct cinematic entrance; delay differences alone are insufficient. Choreograph main/support/CTA pacing; rebuilds preserve motion. Animate images directly, no wrappers/generated pieces/new art/background/whole-scene entrance. Perspective/3D allowed; finish readable, correctly oriented/proportioned/static-tilted, without mirroring/stretching/skew.
6. Preserve Tailwind v4 standalone centering `translate` (`-translate-x-1/2`/`-translate-y-1/2`). Travel uses otherwise-unowned `transform`; finish `none` for neutral bases or preserve base transform. Entrance/idle need distinct properties OR sequential removal with matched poses; delays alone do not fix fill conflicts. Asset-specific names/`animation-fill-mode: both` where needed; verify computed centering/final bounds.
7. Ordinary entrance work preserves end-scene transition/reveal/incoming motion, timing/readiness/sound sync/crossfade/shared definitions; use separate asset classes. Leave unimplemented end scenes unwired unless requested.

### Performance and interaction

- Prefer transform/translate/scale/rotate/opacity; never animate width/height/margin/top/left. Simple clip-path sparingly after checks; avoid large animated blur/filter/shadow.
- Entrance ease-out/tuned cubic-bezier; rotation linear; sway/pulse ease-in-out. Match loop endpoint poses AND velocities. Starting guides: main 450-900ms, support 250-500ms, stagger 60-140ms; tune to artwork/travel. CTA stays 1.6s. Decoration cannot delay essential input.
- Short pointer handlers; avoid whole-scene rerenders/layout churn, separate reads/writes, capture where needed, handle release/cancel. Scope gesture/scroll suppression to play surface; preserve synchronous native audio unlock/MRAID. Invisible controls cannot intercept taps.
- Target 60fps/~16.7ms on supported 60Hz devices; profile lower-powered hardware, bound particles/effects/textures/paint. Fix stutter without losing feedback/gameplay; CSS compatibility fallbacks stay in index.css.
- Confetti: plain divs, stable per-instance `--x/--y/--rotate/--duration/--delay`, shared keyframes. Burst `pointer-events-none overflow-visible`; only screen edges clip, not canvas/letterbox. Tune origin/count/colors/sizes/timing; cleanup covers longest particle.

## 6. Authorized audio

Preserve authorized sources/content/timing; CTA audio prohibited in section 7.

- Delayed/state/timer/animation SFX use `useSound(src, { poolSize, desktopPoolSize })`, `playSound(pool, { volume })`, `stopSound(source)`; never directly play pool elements. Desktop pool defaults to poolSize; preserve idle selection/reset. Synchronous non-pooled tap/drag overlap may use fresh Audio per play.
- First discrete pointerdown/touchstart/click primes EVERY pool instance: muted=true, volume=0, unawaited play then synchronous pause; unmute before real play (iOS ignores volume alone). Movement alone cannot initially unlock.
- Desktop keeps global pointerdown priming. Mobile native listeners ON interactive node call `handleUnlockGesture()` on pointerdown/move/up, not React-only delegation. Keep pool-wide priming/retry of rejected delayed cues; movement retry does not replace first discrete gesture.
- Detect iOS/Android UA plus iPadOS `navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1`; touch alone cannot classify Windows as mobile.
- Touch feedback starts on raw pointerdown, independent of visual movement thresholds. Stop other in-flight sounds before scene-transition cue, guard final cues once, reset reused media `currentTime = 0` before replay.
- Construct looping BGM Audio in first real gesture, never mount (even muted); `locked | pending | unlocked` permits retries. Listen to multiple wrapper gestures and first gameplay tap.
- Silent-host diagnostics may use `?debug=1` overlay recording gesture/isTrusted, play results, paused/muted/currentTime; no ordinary debug UI.

### Prevent SFX cutoff during scene transitions

**STRICTLY REQUIRED: Before changing scene timing, inspect the existing audio lifecycle and measure the relevant sound's duration.** Preserve sound assets, pools, gesture unlock, retries, and `useSound` / `playSound`; add no unauthorized audio.

- A scene with an authorized completion cue MUST wait for BOTH its minimum display duration and the active cue's actual `ended` event before handoff, except the failure fallback below. No fixed transition delay that cuts the cue short.
- Track the specific audio instance returned by `playSound()`. Nominal file duration or time since the play request is insufficient: playback may start late. Stop unrelated sounds before the final cue; start the next scene's sound only after that cue finishes or its failure fallback safely resolves.
- Use one guarded handoff per scene entry. Ignore duplicate/stale callbacks after completion, scene exit, or unmount; never replay the cue to satisfy the gate. Clean up audio listeners and fallback/minimum-duration timers on completion or unmount.
- Provide a bounded fallback for blocked, failed, or stalled audio, including unavailable playback instances, so the scene cannot stick. Check actual playback progress; allow progressing playback to finish instead of enforcing a deadline measured only from the initial request. On fallback, prevent the old cue or late retries from overlapping the next scene.
- Preserve existing timeout behavior outside this completion gate, including paths without a completion cue. Preserve CTA/MRAID behavior and end-scene readiness/fade logic; do not bypass them or defer click-through to wait for audio.

## 7. Shared MRAID and CTA

**Zero `window.open` references in shipped source, comments, strings, dead code, headers, supplied cards, generated/decoded HTML.** No aliases/bracket notation/other globals/obfuscation, location navigation, hardcoded URLs, fake bridge, preview/error navigation fallback. This unbundled guide's explanations must not enter creative comments.

### Raw engine in index.html

Preserve FIRST `<script src="mraid.js"></script>` in head, then raw non-module inline scripts in order:

1. `trackMraidReadiness()` / `window.isMraidUsable(mraid)`.
2. `window.__mip.ready(fn)` and literal `window.__mip.openDestination = function handleMraidOpen() { ... }`.
3. `window.__mip.setupMediaViewability()`.

Keep validator-sensitive additions literal/unminified here, never bundled React guards: exact `if (mraid.getState() === "loading") { ... } else { ... }` and `mraid.open(destinationUrl)`; raw `var mraid = window.mraid` allowed. Gate layout/input/media/orientation/init while loading. Preserve raw `mraid.isViewable()`/`viewableChange` for DOM media (not JS Audio pools/BGM). Missing/404 host bridge in ordinary browsers has no navigation fallback.

### Reserved tracking names: zero occurrences

**STRICTLY REQUIRED: `window.clickTag` is the ONLY platform-injected tracking URL property. Never declare, initialize, overwrite, or hardcode it in the main creative.** No alternate URL globals or fallback chains, including on minified window aliases. Use neutral helpers/locals such as `openDestination` and `destinationUrl`; update all definitions, callers, exports, object properties, string lookups, iframe snippets, and patch markers together.

Reject case-insensitive substrings matching `clickTag1|click[-_]?through` anywhere in delivered HTML/JS, including helper names, comments, strings, dead/generated code, evaluated HTML templates, and recursively decoded HTML (Base64 data URLs AND plain encoded constants). This forbids the former `openClickthrough` name too. Documentation and Node-only validation patterns are exempt but MUST NOT enter exports. Preserve encoded binary media; fix maintained HTML/templates, then repackage. No blind whole-document replacements; when only an export exists, edit a copy and preserve its original.

### One synchronous destination handler

- Every project click-out calls exported `openDestination()` from cta.jsx: exactly one unconditional `console.log("CTA clicked")` immediately before synchronous `window.__mip.openDestination()`, even invalid/missing/loading/throwing cases. No duplicate/bypass/rename/strip/conditional log unless explicitly requested; log means activation, not success.
- Resolve `var injectedUrl = window.clickTag; var destinationUrl = typeof injectedUrl === "string" ? injectedUrl.trim() : "";`. Trim strings; missing/non-string/empty/whitespace values resolve to `""`. No other property lookup or invented destination. A usable bridge MUST receive explicit `mraid.open("")` for an empty destination; never argument-free calls or `about:blank`. Runtime host URLs need no local destination and do not block builds.
- Require callable open, callable `window.isMraidUsable`, and true `window.isMraidUsable(mraid)` before `mraid.open(destinationUrl)`. This readiness helper is project-specific, not a standard MRAID API. Preserve try/catch/error logging; missing/loading/unusable returns silently, no "CTA blocked" warning. Final calls require explicit arguments; only import correction below repairs argument-free calls.
- Controls stop propagation: one activation/log, at most one MRAID call. Preserve event bindings, touch handling, and existing deduplication; no timer/effect/animation deferral. Dedicated CTAs render Cta; overlays use shared helper. Scene-only Continue buttons never click out.

### CTA layout, pulse, silence

- `cta.jsx` exclusively owns supplied asset/imports, markup, position/size/centering/z-order, appearance, hit area, motion classes, local handling. Parents only render `<Cta />`/coordinate visibility/callbacks: no layout props/className/style overrides or positioning/sizing/motion wrappers. Empty button stays unmounted without supplied CTA art.
- Independent image + accessible semantic button/static focus indication. Centered hit area covers full **1.2x width AND height**; update together without changing containing block.
- Image `.animate-scale-pulse`: scale 1 at 0%/100%, 1.2 at 50%; `animation: scale-pulse 1.6s ease-in-out infinite` ONLY index.css. Never restore 1.12/change timing/easing. Start on appearance or after optional entrance; retain readiness/hidden pauses and identical reduced-motion behavior.
- Optional entrance uses distinct properties/sequential handoff. Activation adds no press/bounce/ripple/shake/fade/exit effect; never restart/pause/accelerate/replace pulse. Keep mounted/classes stable; click-out immediate, visible pulse continues.
- **No CTA SFX:** no attach/preload/unlock/play on appearance/pulse/hover/focus/pointer/touch/click/keyboard; no useSound/playSound/Audio/media calls or indirect scene-cue workaround. Promotional/full-screen controls only stop propagation, shared-log, synchronous MRAID. Preserve separately authorized gameplay/BGM/end-scene media; only explicit later CTA-audio authorization changes this prohibition.

## 8. End scenes and HTML compatibility

Reuse `endscene.jsx`; App owns flow, component owns content/interaction. No demo placeholders. Every supplied type needs full-screen click-through and readiness-gated 500ms fade.

- **HTML SIP:** import editable `.html?endcard`; generated module returns UTF-8 decoded HTML, no second decode. iframe `srcDoc` (not src), `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`. Before `</head>`, try/catch bridge forwards ONLY `window.mraid = parent.mraid || window.mraid; window.clickTag = parent.clickTag || window.clickTag;`. Tag forwarding belongs only inside the child, never main-document defaults. Retain existing cross-origin integration where parent access is unavailable. Preserve internals except required tracking/MRAID fix, narrow compatibility/calendar preparation. Overlay/bridge does not sanitize forbidden handlers/comments; repair narrowly, retaining readiness/media/orientation/layout/animation logic and the section 7 destination contract.
- **Replacement cards:** same path/filename with `.html?endcard` imports repackages automatically on rebuild; renames/moves require import updates. Every supplied/replacement card MUST pass dev/import and final decoded-content validation. Reserved tracking names cause errors, NOT automatic rewriting; review/fix source handlers, callers, bridge snippets, and exact-marker/regex transformations before delivery. Do not alter binary media. Packaging does not create or wire the end-scene component.
- **Assets:** root useScaleUI/two-layer layout, no child hooks. **Video:** no useScaleUI; `w-full h-full object-cover`.
- **Every type:** transparent full-viewport semantic button on wrapper OUTSIDE scaled canvas: `type="button"`, `aria-label="Open offer"`, `absolute inset-0 z-30 h-full w-full`; stop propagation/shared handler once. Preserve focus/keyboard/design-required dedicated CTA without double activation; hidden overlay cannot intercept gameplay.

### Import preparation: dev AND production, in memory

Before validation/encoding, remove ONLY exactly empty `src=""` on source directly inside runtime-filled video; convert argument-free executable-script/inline-handler `mraid.open()` to `mraid.open("")`. Preserve supplied arguments, comments/strings, URLs/media/layout/motion and disk HTML. These and recognized calendar preparation are narrow exceptions, not general repair; reject other invalid content clearly.

In JSON script `id="sip-builder-config" type="application/json"`, ONLY `videos.portrait.name`, `videos.landscape.name`, `dynamicTexts.<index>.font.fileName` may retain original-upload basenames without `/`, `\`, `:`; no duplicate file required or metadata removal. No exemption for actual src/URL/path/remote/arbitrary JSON/Base64/raw HTML/navigation. Distinguish JSON parse errors from validation errors.

### Mandatory fade

- Same mounted wrapper, initially `visible = false`: index.css `.end-scene-fade { opacity: 0; transition: opacity 500ms ease-out; }` and `.end-scene-fade.is-visible { opacity: 1; }`. No hard cut, alternate entrance, inline transition, remount, reduced-motion shortcut.
- Wait iframe onLoad, settled image preload/decode (failure handled), or available video-frame data/existing ready poster; THEN two nested rAF. Keep ~1200ms missing-readiness fallback sharing the SAME guarded two-frame scheduler/reveal. No single-frame/timer replacement for normal readiness or repeated fade/sound/callback on late events. Retain previous scene/background/poster behind loading/reveal to prevent white flashes.
- Reveal starts authorized useSound/playSound with gesture unlock (failure cannot block; no new SFX), parent onReady once if used. Preserve crossfade/completion/focus/overlay/MRAID. Cancel frames/fallback/listeners/late callbacks on exit; reset only intentional replay/entry, allow remount, preserve readiness/hidden pauses.

## 9. Conditional calendar and preview URLs

**Activate only for dynamic calendar dates, weekdays/months, or holidays in gameplay OR end cards.** Static artwork/ordinary elapsed/countdown timers do not qualify. Neither view needs it: no calendar import/init/exposure/listeners/bundle/date UI/URL mutation. End-card-only calendars authorize no gameplay date labels.

### Shared clock

- Reuse calendarClock.js singleton BEFORE render/mount; expose `window.__mip.calendarClock` for trusted cards. Recognized `.html?endcard` calendar imports automatically import/expose SAME singleton, including card-only cases. No copied parsers/new clocks on entry.
- `parsePreviewDate`/`createCalendarClock`: FIRST `URLSearchParams.get("date")`, exact YYYY-MM-DD, numeric `setFullYear()` (years 00-99 included), local `setHours(12, 0, 0, 0)`, compare year/month/day to reject rollover. No UTC keys or `new Date("YYYY-MM-DD")` parsing. Valid preview freezes until reload; now() returns fresh Date objects. Invalid/empty/absent uses device date except missing-date auto previews below; not time-of-day simulation.
- All calendar displays/lookups use shared clock; preserve requested format/locale independently of URL format, no unauthorized copy/fonts. Apply offsets/recurrence AFTER base: `resolveSipEffectiveDate(calendarClock.now().getTime(), dateRecurrence, dateOffsetDays)`. Viewing-date holidays use unoffset clock.
- Reuse `localDateKey`, `validateHolidayRanges`, `holidayText(clock,ranges,defaultText)`: valid inclusive local dates, start<=end, string text, FIRST configured match then default. Fixed-year ranges do not recur automatically; no invented ranges/changed recurrence.
- Never replace Date/Date.now or affect animation/elapsed/debounce/click/analytics/video/lifecycle/countdown/count-up clocks; timer preview needs separate authorization. Normal views use `subscribeCalendarClock` with cleanup: refresh midnight/focus/pageshow/visibility/resume/supported MRAID viewability; schedule midnight using REAL device time/DST. No preview midnight timer/duplicate subscriptions.

### Automatic previews (only when calendar active)

- `readAppLovinPreviewSearch`: accessible immediate HTTPS parent exactly `playable.applovindemo.com`, case-insensitive `/Preview/`, `/Preview/index.html`, `/Preview/mobilePreview.html`; same-origin child path starts `/phaser/`.
- Explicit creative date wins/prevents insertion. Otherwise use parent date (including invalid/empty/duplicates); unrelated child parameters cannot hide it. If absent in BOTH, set today's LOCAL key via `url.searchParams.set("date", localDateKey(new Date()))`, `parent.history.replaceState(parent.history.state, "", url.href)`; initialize from resulting search.
- `readLocalPreviewSearch()`: top-level `window.parent === window`, `file:` OR HTTP(S) hostname exactly `localhost`, `127.0.0.1`, `[::1]`, any port. If date absent, add today's LOCAL value with own `history.replaceState(history.state, "", url.href)`. Applies dev/exported HTML at runtime, never baked into build.
- Construct URLs with `Reflect.construct(URL, [value])`. Preserve existing dates (even invalid/empty/duplicates), all query values including AppLovin thm/h/h2/h3/n/n2/n3, hash/history state. Standard serialization may normalize encoding/empty separators. No hardcoded/UTC date, reload/navigation/new history entry.
- Catch blocked parent/history access without blocking creative. Never expand mutation to LAN/lookalikes/ordinary remote sites/embedded local previews/unrelated protocols/cross-origin parents/live ads. Auto-added today freezes until reload; edit `?date=YYYY-MM-DD` (or `&date=` with existing query), then Enter/reload. URL edits alone do not recreate clock.

### End-card detection/transport

- Keep `calendarEdits`/`prepareEndCardCalendar`: recognized import preparation in memory, dev+production BEFORE validation/Base64. No disk rewrites, runtime decoded-string patches, copied helpers, blanket timestamp replacement.
- Recognized: zero-arg new Date receivers of toLocaleDateString/toDateString/getFullYear/getMonth/getDate/getDay; direct Date.now or new Date().getTime as FIRST resolveSipEffectiveDate argument; direct Intl.DateTimeFormat(...).format(new Date()) with supported calendar-only options. Preserve formatting/offset/recurrence/other args. Existing `window.__mip.calendarClock` references activate too; timestamp/countdown-only code must not.
- Generated import exposes clock before mount; prepared HTML bridges exact `parent.__mip.calendarClock` before inline date scripts. Trusted same-origin access; bundled helper reuses accessible parent clock. Search fallback: own nonempty query, parent query, empty (srcdoc does not inherit query).
- Isolated frames/separate URLs require explicit validated-date URL/message transport, sender/expected-origin/schema/date checks, initialization BEFORE display. Preserve params using safe URL/searchParams.set; transport not automatic, no-override production uses real date.
- Detection is NOT data-flow analysis: review variable dates, custom/minified formatters, computed options, time-of-day mixes, inline handlers/unrecognized logic; wire explicitly. Correct ambiguous rejected SIP bases, never silence errors/rewrite unrelated timers. `validateHtml` scans executable scripts in whole export and recursively decoded HTML/SVG; recognized unconverted expressions fail. Gameplay uses shared clock directly, no export-only patch. Passing packaging alone does not prove arbitrary-card compatibility.

## 10. Single-file builds and validation

Prefer Yarn: `yarn dev`, `yarn build`, `yarn preview`, `yarn lint` (both lockfiles exist). No permanent test suite or `test:build` command configured.

- **Before every build**, check the `<title>` in `index.html`. If the tag is missing, empty, or contains only whitespace, **ask the user what title to use and wait for their answer before building**. Insert their supplied title, then continue the build. Never guess a title or build with a missing/blank title. This applies to all builds, including template, validation, temporary-output, and production builds. If a nonblank title already exists, preserve it and build without asking again.

**Every production build MUST retain final validation. Never disable checks, raise limits, suppress failures, or deliver invalid output as successful.**

- vite.config.js retains React, Tailwind, vite-plugin-singlefile, `base64Packaging()`, `assetsInlineLimit: () => true`, `modulePreload: false`. Exactly ONE `dist/index.html`: no separate JS/CSS/media/copied public assets or 1MB asset cutoff.
- All used gameplay/end-scene images/audio/video/fonts/SVG: Vite asset flow/supported local CSS, valid nonempty Base64. Unused assets need not ship. No multimedia `?raw`/`?noinline`/`?no-inline`; Base122 not implemented.
- `.html?endcard` inlines supported local media and Base64-encodes ENTIRE prepared document at BUILD TIME; generated module UTF-8-decodes for iframe. Source stays editable; no manual source blobs, `.html?raw`, complete raw HTML strings in JS, runtime btoa on raw imports. Source scripts/styles already inline except mraid.js; fix unsupported references. Same-path replacements repackage; moved/renamed imports retain suffix. Plugin does not wire React components.
- Outer HTML shell, gameplay JS/CSS, validator-visible MRAID stay UNENCODED. Single-file does not mean encoding outer document.
- **No empty assets:** reject `<link rel="icon" href="data:," />`/equivalent in source/cards/exports, even favicon suppression. Requested favicon needs nonempty valid Base64 image/correct MIME, not a changed prefix.
- **Safe URLs:** `Reflect.construct(URL, [value])`; no shipped JS call/constructor-shaped `URL(...)` tokens, including case/whitespace variants/comments/strings (host falsely reads CSS assets). Keep `validateUrlTokens` on outer/decoded HTML/SVG WITH or WITHOUT calendars. CSS needs valid Base64/supported fragments.
- Before EVERY build scan source/supplied HTML for empty data/forbidden navigation. AFTER bundling/inlining validate AND verify written output: canonical nonempty Base64, UTF-8/document round-trip against intended prepared content, decoded HTML/SVG, src/href/poster/srcset/etc., CSS URLs, raw HTML/calendar/navigation checks, preserved raw MRAID. Inspect EVERY generated creative. Encoding hides no violations; fix source/rebuild affected exports, not export-only patches.
- mraid.js stays FIRST and sole host-provided external resource exception. No runtime external-resource loading/inlined fake bridge.
- Actual final HTML max **5,000,000 bytes**, not gzip/5MiB; fail above with size+limit. Target **<=4,900,000 bytes**, retain warning above target, report delivered bytes (decimal MB optional).
- Compression is NOT automatic: keep recoverable originals outside output, optimize largest working-copy media, rebuild/revalidate to target. Preserve quality/transparency/proportions/display dimensions, audio content/timing, required assets/SFX/gameplay/end scene. Never remove required content/recompress the only original repeatedly; review lossy quality, report constraints if target cannot be met acceptably.

### Local preview: serve the actual export

**STRICTLY REQUIRED: Preserve `localCreativePreview()` in `vite.config.js`.** Under the Vite development server, GET/HEAD `/`, `/index.html`, and `/creative.html` serve the exact built `index.html` from this project's configured output directory (default `dist`), BEFORE Vite's HTML transformation. No `/@vite/client`, React Refresh, separate source imports, or checker-suppression patches in these responses. Preserve HTML content type, byte length, and `Cache-Control: no-store`.

- `/dev.html` retains live source editing/HMR by internally routing to Vite's source index, preserving query parameters. Its development dependencies are expected; use the export routes for self-contained-asset checks. Do not replace or remove this development route.
- Export preview is the LAST BUILD, not live source or an automatic build. After source changes, run `yarn build` / `npm run build` under the title rule, then reload/recheck. Missing output returns 503 with build instructions; other read failures return 500. Never silently fall back to development HTML or claim an old build reflects new edits.
- Route by pathname, never a hardcoded host/port. Use the URL printed by Vite: 5173, 5174, 5175, or another available/configured port must behave identically. Preserve query parameters, including conditional calendar previews. Each project serves its own output; another project needs this configuration to inherit the behavior.
- Preserve the local-only empty `/mraid.js` response for dev/preview; it must not create a fake bridge or enter production exports. Local preview changes must not weaken packaging, tracking, Base64, or size validation.
- Verify exact response equality to the built file, root/alias/query routes, GET/HEAD/no-store, no development imports on export routes, HMR on `/dev.html`, missing-output handling, and operation on another available port. This server setup is permanent infrastructure and survives demo resets.

## 11. Required verification and resets

Run checks relevant to changed behavior; fix available-check failures, lint/rebuild runtime changes and affected exports under title rule. Report unavailable browser/device/host coverage and unresolved differences. Desktop/emulation/screenshots/fixtures do not prove real-device smoothness or full supplied-card flow; distinguish local response substitution from an actual AppLovin upload. Missing device access never waives implementation requirements.

- **Scene-completion SFX:** verify normal/delayed playback, blocked/error/stalled cases, duplicate events, scene exit/unmount cleanup, and both orders of minimum-duration expiry versus cue completion. Confirm the active cue ends before normal handoff, is never replayed/cut short, failure fallback cannot stick or overlap the next cue, and handoff occurs once. Run required lint/build checks for implementation changes and report unavailable device coverage.
- **Motion/layout:** available Chromium/WebKit, iOS Safari/WKWebView, Android Chrome/WebView, desktop/real devices/ad hosts. Inspect intermediate/final bounds/poses, entrance-idle handoff, audio sync, full flow/transitions/replay; portrait/landscape/resize/orientation, rapid input/interrupted drag, hide/resume, delayed/failed decode, repeat entry/unmount during preparation. Both motion preferences and mid-play changes; once-only starts/cues/timers, cleanup/pauses, missing animation events, no flash/clipping/distortion/transform conflicts. Profile stutter/long tasks/input lag.
- **CTA/end card:** scan source/supplied/decoded HTML/evaluated templates/all affected exports for forbidden tracking substrings AND browser navigation; check first script/raw guards and renamed callers. Parse executable scripts as classic/module appropriately; JSON blocks as JSON. Test pointer/keyboard/touch, ready/missing/loading/throwing bridges, injected URL/trimmed strings, empty/absent/non-string normalization to explicit `""`, ignored alternate properties, unchanged injected tag, once-only production log/call, no fallback. Verify real iframe/media/authorized SFX/shared CTA. Fade: intermediate/final opacity, normal/delayed/missing readiness/fallback, repeated loads, unmount/replay/remount; one fade/cue/callback, no white flash/hidden interception, unchanged scaling/MRAID. Verify original delivery filenames/count/no stale variants and, when requested, ZIP contents identical to validated files. Run target-platform upload/tap checks when available; report what was actually tested, never treat mocks as platform acceptance.
- **Calendar (dev AND actual exports/cards, >=2 timezones):** valid 2026-10-29/2027-01-01/2028-02-29; invalid 2026-02-29/2026-02-30/2026-13-01/2026-00-01/2026-10-00/2026-1-1/hello/empty; absent/unrelated params/duplicates including invalid-first. Holiday boundaries/neighbors/default/overlap/nonrecurrence, offsets/mutation resistance/delayed mount/freeze/reload/midnight/resume/DST/cleanup. AppLovin/localhost/loopback/top-level file insertion; child priority, iteration params/hash/history, no repeated/out-of-scope mutation, blocked access. Gameplay-only/card-only/both/neither/timer-only: clock before iframe, card-only auto preview without gameplay UI, native timestamps intact, unused module absent. Preserve gameplay/motion/input/audio/MRAID; no dev-only flag; inaccessible outer query alone is insufficient verification.
- **Packaging changes:** unchanged supplied bytes/intended decoded document; both import corrections dev+production; allowed metadata; failure for path/invalid filename labels, missing/external media, malformed/empty Base64, raw HTML, forbidden navigation, argument-free MRAID, oversize. Never weaken checks for tests.

**Demo removal must preserve permanent infrastructure:** shared `openDestination`/MRAID order/names/guards, injected-clickTag-only resolution/trim/explicit empty fallback/silent states/error handling/log, reserved-name validation; CTA pulse/silence/ownership; end-scene bridge/overlay/fade/readiness/cleanup; packaging/compatibility/calendar preparation/metadata/safe URLs/decoded+outer+written validation/Base64/size rules; calendar helpers including `readLocalPreviewSearch()` loopback and AppLovin/file support.

Check BOTH views before removing date UI/state/subscriptions/imports/exposure: retain active clock while either needs it, otherwise verify unbundled/uninitialized/no URL insertion. Empty/unwired endscene allowed after reset; zero card imports means zero packaged cards, not disabled checks. Delete supplied assets ONLY when requested. Verify retained helpers/rebuild affected exports; do not claim removed UI was exercised (use temporary fixtures). Resets never weaken this guide.
