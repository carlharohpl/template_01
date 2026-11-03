# Dice playable

React and JavaScript playable using the existing two-step Roll / Stop flow and supplied end card. The original `Shapermint` document title is preserved.

Run `yarn dev`, `yarn lint`, `yarn build`, or `yarn preview`.

- `/`, `/index.html`, and `/dev.html` serve live source with HMR.
- `/creative.html` serves the exact last production build with no development imports. Rebuild and reload to update it.
- Production output is one `dist/index.html`. Build validation checks source, packaged and decoded content, raw MRAID scripts, embedded assets, and the written file. The hard limit is 5,000,000 bytes; the target is 4,900,000.
- Builds require a nonblank approved title. The local empty `mraid.js` response is only a development convenience.
- The end card's date uses the shared calendar clock. Local previews automatically add today's date when absent. Use `?date=2028-02-29` to freeze a preview; invalid dates use device time. Gameplay has no date label.

Project motion lives in `src/index.css`. Foreground assets keep their measured independent positions inside the root 1080 × 1920 canvas. The CTA uses the prescribed 1.6-second, 1.2× pulse and matching hit area. All offer activations use the shared handler, log once, and synchronously call the usable host bridge with only its injected tag.

## Audio inventory

All existing active cues retain the media backend and volume 0.3. Four reusable players are prepared before the first gameplay interaction. The unused `congrats.mp3` remains unwired.

| Asset | Duration | Trigger and ownership |
| --- | ---: | --- |
| click.mp3 | 1.321 s | Roll and Stop; one reusable voice, new feedback replaces the old instance |
| scan.mp3 | 10.327 s | Loop begins with the ready rolling scene; stops on reveal, hiding, or disposal |
| Correct 2.mp3 | 1.675 s | Once after the reveal pop, with the confetti burst |
| Pop Prize 3.mp3 | 2.087 s | Once when the ready end card begins its fade |

The existing 2.5-second win hold remains the minimum. Handoff also waits for the actual Correct instance to finish; blocked or stalled playback uses the shared bounded failure path. Offer controls neither unlock nor play audio. The end card retains its video, date, artwork, and embedded font, with a 500ms readiness-gated fade and host viewability handling.

## Verification

Verified in local Chrome against live source and the actual export:

- Roll, Stop, reveal, confetti, all four audio cues, and end-card playback.
- Initial static asset bounds against recorded pre-edit measurements; portrait and landscape resizing.
- CTA tag trimming/empty fallback, missing/loading/throwing host states, once-only activation, and audio exclusion.
- Unchanged animation definitions under reduced-motion preference changes.
- Shared leap-day date rendering in Asia/Manila and America/Los_Angeles, plus invalid/duplicate dates, mutation resistance, and holiday boundaries.
- Delayed win playback completes before handoff; blocked/stalled cues hand off once after the watchdog. Touch emulation and host video pause/resume pass.
- Completion gates in both timing orders and cancellation cleanup.
- Source aliases, actual HMR delivery without reload, query preservation, a second port, export GET/HEAD equality and no-store headers, and missing/unreadable output responses.
- Negative packaging fixtures reject invalid/empty Base64, external resources, forbidden navigation/tracking, raw embedded documents, invalid metadata paths, and oversized output.

Physical iPhone/Android devices, WebKit, Bluetooth/silent-mode behavior, and an actual ad-network upload were not available. Chrome checks do not establish device audibility, frame-rate guarantees, or platform acceptance. Temporary verification scripts are not part of the project.
