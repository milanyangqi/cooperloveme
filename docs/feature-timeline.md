# YouTube Language Lab Feature Timeline

Last updated: 2026-06-02 17:52:27 CST

This file is the project memory for feature recovery. Update it whenever a feature is completed, restored, paused, or found broken.

## Status Legend

- `Done`: implemented and locally verified.
- `In Review`: implemented locally, waiting for manual Chrome review.
- `Partial`: usable but incomplete.
- `Planned`: not implemented yet.
- `Regressed`: known broken or unstable.

## Core Feature Matrix

| Feature | Status | Completed / Updated | Evidence | Notes |
| --- | --- | --- | --- | --- |
| V1 local anonymous user model | Done | 2026-06-01 | Existing local user, local storage, and V1 account copy | V1 remains usable without registration. |
| V2 account and entitlement planning | Done | 2026-06-01 | `docs/supabase-membership.md`, `docs/admin-management.md` | Email login and admin/entitlement backend are planned and partially scaffolded. |
| Official YouTube caption loading | Done | 2026-06-02 13:08 CST | `0.1.58` Chrome runtime test loaded 267 official rows and 267 translated rows | Must remain the primary path. Diagnostic logs stay available for future failures. |
| Caption fallback from visible CC | Done | 2026-06-02 14:57 CST | `0.1.60` throttles official retries while fallback is active | Verified that native CC remained hidden on `0.1.60`; fallback remains secondary to official captions. |
| Native YouTube CC hiding | Done | 2026-06-02 | Runtime check showed native visible count 0 | Keep default enabled to avoid duplicate subtitle overlays. |
| Right-side caption panel with full sentences | Done | 2026-06-02 | Runtime test showed hundreds of complete rows | Rows support click-to-seek and word lookup. |
| Right-side newest-on-top / upward scroll behavior | Done | 2026-06-02 14:57 CST | Chrome runtime test on `0.1.60` loaded 109 official rows with current row highlighted | Active row scrolls with time; mouse scroll remains available. |
| Adjacent duplicate caption filtering | In Review | 2026-06-02 14:49 CST | `0.1.60` adds wider fallback similarity filtering | Needs more fallback-video review because current Chrome test used official captions. |
| Bilingual overlay on video | Done | 2026-06-02 14:57 CST | Chrome screenshot on `0.1.60` showed plugin bilingual overlay and native CC count 0 | Position is usable; further style tuning still planned. |
| Free translation fallback | Done | 2026-06-02 | Runtime test generated 289 translated rows | Uses free translation path before paid AI configuration. |
| Click word for translation | Partial | 2026-06-02 | Word spans and popover implemented | Needs broader UX review and vocabulary save flow. |
| Subtitle settings panel | In Review | 2026-06-02 15:20 CST | `0.1.62` restores subtitle mode, opacity, source/translation font controls | Needs manual Chrome review; advanced highlight-style editor still planned. |
| Practice mode shell | In Review | 2026-06-02 15:32 CST | `0.1.63` restores mode tabs, sentence navigation, replay, and feedback | Needs manual Chrome review; full Trancy-style layout still planned. |
| Shadowing / follow-read | Partial | 2026-06-02 15:32 CST | `0.1.63` can replay current sentence for follow-read | Mic flow, scoring, and save attempt still pending. |
| Dictation mode | Partial | 2026-06-02 15:32 CST | `0.1.63` adds dictation input and local word-match score | Needs better diff display and retry records. |
| Cloze / fill blank mode | Partial | 2026-06-02 15:32 CST | `0.1.63` adds generated blanks and reveal answer | Needs typed answer validation. |
| Comprehension quiz mode | Partial | 2026-06-02 15:32 CST | `0.1.63` adds translation-choice quiz from nearby subtitles | Needs generated questions and richer feedback. |
| Sentence save / collection | In Review | 2026-06-02 15:43 CST | `0.1.64` wires practice current sentence save to `SAVE_SENTENCE` | Needs manual Chrome review and visible library count refresh. |
| Vocabulary library | In Review | 2026-06-02 17:52 CST | `0.1.66` keeps word lookup popover open for save clicks | Needs reload and re-test after popover click-propagation fix. |
| Export / Anki / CSV | Planned | Pending | Export bundle exists, advanced export not restored | Planned for Pro/high-value workflow. |
| Cloud sync | Planned | Pending | V2 sync model planned | Not part of current V1 recovery. |
| Pro quotas / entitlement UI | Partial | 2026-06-01 | Popup/options/admin scaffolding exists | Backend second-pass checks still future work. |
| Admin console | Partial | 2026-06-01 | `docs/admin-management.md` | Needs production credential and full manual QA. |
| Caption diagnostics panel | In Review | 2026-06-02 15:01 CST | `0.1.61` docks diagnostics inside the subtitle panel | Keeps debug logs available without covering video/recommendations. |
| Stale content-script protection | In Review | 2026-06-02 17:33 CST | `0.1.65` adds version broadcast and old-instance cleanup | Future versions can stop older in-page script instances; already-stale pre-0.1.65 pages still need popup wake or tab reopen. |

## Timeline

### 2026-06-02

- Local `0.1.66` word popover save fix:
  - Chrome review showed `0.1.65` loaded after page refresh and official captions worked
  - settings panel, practice tabs, cloze, quiz, and dictation feedback were visible
  - word lookup popover showed a save button, but the popover became hidden before save could trigger
  - added click and mousedown propagation guards to the word popover and save button
  - pending extension reload and Chrome re-test
- Local `0.1.65` stale script guard:
  - documented stale content-script verification rules in `AGENTS.md`
  - added version broadcast event when the content script starts
  - added stop cleanup for older in-page script instances when a newer version announces itself
  - synchronized popup and manifest versions
  - pending extension reload and manual Chrome review
- Local `0.1.64` local library recovery:
  - added current sentence save from the practice panel
  - added word save button inside the word lookup popover
  - saves sentence and vocabulary through existing background storage APIs
  - pending extension reload and manual Chrome review
- Local `0.1.63` practice mode recovery:
  - added practice mode tabs for shadowing, dictation, cloze, and quiz
  - added previous/next sentence navigation
  - added current-sentence replay with automatic stop near cue end
  - added dictation word-match score
  - added cloze reveal answer
  - added translation-choice comprehension quiz
  - pending extension reload and manual Chrome review
- Local `0.1.62` subtitle settings recovery:
  - restored subtitle mode selector: dual, source only, translation only
  - added background opacity control
  - added original subtitle font size and font family controls
  - added translated subtitle font size and font family controls
  - settings are backward-compatible with existing local storage
  - pending extension reload and manual visual review
- Local `0.1.61` diagnostics UI recovery:
  - moved the diagnostic log panel inside the extension panel
  - reduced max height so debugging does not block the video or right-side caption list
  - pending extension reload and Chrome visual review
- Verified local `0.1.60` after extension reload:
  - Chrome page was running `0.1.60`
  - loaded 109 rows from official caption track
  - generated Chinese translations
  - native YouTube CC visible count was 0
  - bottom plugin bilingual overlay was visible
  - right-side active row tracked current playback time
- Local `0.1.60` fallback stability fix after Chrome takeover:
  - verified `0.1.59` was loaded in Chrome
  - found the current BBC video stayed on visible-caption fallback instead of official captions
  - found official retry loops could clear the right-side list and reveal native YouTube CC during retry
  - changed official retry cadence to 45s while fallback is active
  - kept fallback collection and native-caption hiding active during background official retries
  - widened fallback duplicate detection to catch highly similar rolling captions up to 14s apart
  - pending extension reload and Chrome visual review
- Local `0.1.59` duplicate and overlay recovery:
  - added overlap-aware caption text combination so rolling YouTube captions do not repeat the previous tail
  - added near-time similarity filtering for neighboring rows with highly overlapping text
  - raised minimum plugin overlay display duration from 2.2s to 3.2s to reduce short subtitle flashes
  - pending manual extension reload and Chrome visual review
- Local `0.1.58` bug fix from diagnostic logs:
  - confirmed `0.1.57` eventually loaded 354 official rows on the tested video
  - found repeated `load:start` loops immediately after fallback activation when no rows existed yet
  - changed official retry cooldown to apply even when there are zero fallback rows
  - this gives visible-caption fallback time to collect rows before the next official retry starts
  - verified after extension reload on a real YouTube page: `0.1.58`, 267 official rows, 267 translated rows, native CC visible count 0
  - ready to push as the new reviewed baseline after `npm run typecheck`, `npm run build`, and `npm audit --audit-level=moderate`
- Local `0.1.57` diagnostic build:
  - added `诊断日志` button in the in-page panel
  - exposed `window.__yllSafeDebugLog` and `window.__yllSafeDebugSnapshot()`
  - logs official snapshot track counts, track fetch/parse results, attempts, timeout, and fallback activation
  - added `OFFICIAL_ATTEMPT_TIMEOUT_MS` so a single official attempt cannot silently block the UI too long
- Local `0.1.56` correction after reviewing the pushed baseline:
  - compared current changes against pushed commit `89a6d00`
  - identified that the new fallback-while-loading path could interfere with YouTube caption state
  - reverted fallback collection during official loading
  - changed auto official loading to use fast paths only by default
  - skipped slow transcript-panel/player-request paths in automatic loading
  - reduced automatic official attempts to 3 before fallback
- Local `0.1.55` fix after browser takeover:
  - confirmed page was running `0.1.54`
  - found current video had no exposed `captionTracks` or `textTracks`
  - fixed blank waiting state by enabling visible-caption fallback while official loading continues in background
  - strengthened cleanup for `English/英语 (auto-generated/自动生成) Click/点击 Settings/查看设置` noise
- Pushed `89a6d00 Fix official caption recovery` to `main`.
- Added `AGENTS.md` and `docs/caption-recovery-log.md`.
- Restored official-caption-first behavior:
  - official retries continue after fallback starts
  - fallback no longer permanently marks the video loaded
  - official rows replace fallback rows
  - native YouTube CC is hidden during plugin subtitle display
- Verified on a real YouTube page:
  - 289 official rows
  - 289 translated rows
  - native CC visible count 0
  - bilingual overlay visible
- Started local `0.1.54` recovery:
  - right-side list renders newest time first
  - active row scroll target moved toward upper panel area
  - pending manual Chrome review

### 2026-06-01

- Built the V1/V2 product foundation:
  - local-first anonymous user model
  - account and entitlement planning
  - Supabase/Stripe membership docs and admin notes
  - popup/options/admin scaffolding

## Next Recovery Order

1. Manually review `0.1.59` duplicate filtering, right-side newest-on-top behavior, and overlay display duration after extension reload.
2. Tune overlay position if the video subtitle still feels too high or too low.
3. Expand settings panel toward the reference UI:
   - subtitle mode
   - subtitle position
   - background opacity
   - original/translated font size and font family
   - highlight style
4. Restore practice modes in this order:
   - replay and shadow current sentence
   - dictation
   - cloze
   - comprehension quiz
5. Wire word lookup to vocabulary save and sentence collection.
6. Improve official caption diagnostics so future failures show track count, source, and last fetch reason.

## Manual QA Checklist

After every build:

1. Run `npm run typecheck`.
2. Run `npm run build`.
3. Reload the unpacked extension in `chrome://extensions`.
4. Refresh a YouTube watch page.
5. Confirm popup/panel version.
6. Confirm official captions load when available.
7. Confirm native YouTube CC is hidden.
8. Confirm right-side rows are complete sentences.
9. Confirm translations appear.
10. Confirm overlay stays visible long enough and follows audio.
