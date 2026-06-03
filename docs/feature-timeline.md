# YouTube Language Lab Feature Timeline

Last updated: 2026-06-03 18:28:00 CST

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
| Official YouTube caption loading | In Review | 2026-06-03 16:29 CST | `0.1.88` adds delayed forced official retry, locks successful official rows per video, and resets only on video ID changes | Needs Chrome timing review on fresh page load without clicking `重读字幕`. |
| Caption fallback from visible CC | Done | 2026-06-02 14:57 CST | `0.1.60` throttles official retries while fallback is active | Verified that native CC remained hidden on `0.1.60`; fallback remains secondary to official captions. |
| Native YouTube CC hiding | In Review | 2026-06-03 14:12 CST | `0.1.84` hides native YouTube captions whenever plugin subtitle rows exist, including visible-CC fallback | Needs fallback-video Chrome review. |
| Right-side caption panel with full sentences | Done | 2026-06-02 | Runtime test showed hundreds of complete rows | Rows support click-to-seek and word lookup. |
| Right-side newest-on-top / upward scroll behavior | Done | 2026-06-03 13:47 CST | `0.1.82` Chrome QA showed the active row visible around the middle of the panel after official subtitles loaded | Keep monitoring on long videos and fallback videos. |
| Adjacent duplicate caption filtering | In Review | 2026-06-02 14:49 CST | `0.1.60` adds wider fallback similarity filtering | Needs more fallback-video review because current Chrome test used official captions. |
| Bilingual overlay on video | In Review | 2026-06-03 09:25 CST | `0.1.79` preserves json3 segment offsets for word highlighting, adds weighted fallback timing, and exposes word-only calibration | Needs Chrome visual timing review. |
| Free translation fallback | In Review | 2026-06-03 18:28 CST | `0.1.89` cancels stale fallback translation tasks when official rows replace the list and prevents 0 translated rows from being marked successful | Needs reload and Chrome review on an official-caption video. |
| Click word for translation | Partial | 2026-06-02 | Word spans and popover implemented | Needs broader UX review and vocabulary save flow. |
| Subtitle settings panel | In Review | 2026-06-03 14:10 CST | `0.1.83` adds a right-panel subtitle-mode selector and logs mode changes for diagnostics | Needs extension reload and Chrome review. |
| Practice mode shell | In Review | 2026-06-03 09:51 CST | `0.1.80` restores the popup full-practice entry and lets saved sentences open the mixed-practice overlay | Needs manual Chrome review; full Trancy-style layout still planned. |
| Shadowing / follow-read | In Review | 2026-06-02 20:44 CST | `0.1.70` adds microphone recording, local score cards, and practice-attempt save | Needs Chrome mic-permission review; AI scoring still future work. |
| Dictation mode | In Review | 2026-06-02 20:44 CST | `0.1.70` saves dictation attempt after word-level hit/miss feedback | Needs Chrome review and visible history UI. |
| Cloze / fill blank mode | In Review | 2026-06-02 20:44 CST | `0.1.70` saves cloze attempts after typed answer validation | Needs Chrome review and multi-blank UX tuning. |
| Comprehension quiz mode | In Review | 2026-06-03 13:05 CST | `0.1.81` saves quiz attempts to the local practice history after an option is selected | Needs generated questions and richer feedback. |
| Sentence save / collection | In Review | 2026-06-03 13:05 CST | `0.1.81` keeps saved-sentence practice and adds library export entry points | Needs Chrome review and richer library management. |
| Vocabulary library | In Review | 2026-06-02 21:31 CST | `0.1.73` refreshes versioned styles so saved vocabulary renders correctly in the local library | Word save was verified on `0.1.66`; broader library UI now awaits review. |
| Export / Anki / CSV | In Review | 2026-06-03 13:05 CST | `0.1.81` adds JSON, CSV, and Anki CSV exports inside the local library panel | Needs Chrome download review; advanced Pro export can be expanded later. |
| Cloud sync | Planned | Pending | V2 sync model planned | Not part of current V1 recovery. |
| Pro quotas / entitlement UI | Partial | 2026-06-01 | Popup/options/admin scaffolding exists | Backend second-pass checks still future work. |
| Admin console | Partial | 2026-06-01 | `docs/admin-management.md` | Needs production credential and full manual QA. |
| Caption diagnostics panel | In Review | 2026-06-03 14:16 CST | `0.1.86` records final row/translation summaries and adds one-click diagnostic log copy | Keep debug UI available during recovery; hide from production later. |
| Stale content-script protection | In Review | 2026-06-02 21:57 CST | `0.1.75` handles `Extension context invalidated` and points users to popup wake-up | Needs extension reload and Chrome review to confirm stale panels stop misleading QA. |

## Timeline

### 2026-06-03

- Local `0.1.89` translation race recovery:
  - Chrome diagnostics on `0.1.88` showed fallback translation completed after official captions replaced the row list
  - the stale fallback task mapped 1 old row against 107 new official rows, wrote 0 translations, and still displayed `中文译文已生成`
  - added a row-generation guard so stale translation batches abort when the subtitle list changes
  - official row saves now cancel any old translation token and allow the official row list to start a fresh translation pass
  - translation status now only says `中文译文已生成` when at least one row actually has translated text; otherwise it schedules a retry
  - pending extension reload and Chrome review

- Local `0.1.88` official-caption persistence recovery:
  - user reported official captions only load after clicking `重读字幕`, and the successful result does not stay long
  - added a scheduled forced official retry after fallback starts, so early page-load timing failures retry automatically without manual action
  - locks successful official caption rows for the current video and prevents visible-CC fallback rows from replacing them
  - changed navigation reset logic to use YouTube `videoId` instead of full `location.href`, avoiding subtitle resets caused by harmless URL or SPA state changes
  - popup wake cleanup now clears the official retry timer and official lock state to avoid stale-page timer conflicts
  - pending extension reload and Chrome review

- Local `0.1.87` first-screen subtitle speed recovery:
  - Chrome QA on `0.1.86` showed official auto attempts timing out twice at 9000ms before fallback took over
  - reduced initial official auto attempts from 3 to 1 and timeout from 9000ms to 4000ms
  - fallback can now display rows much sooner while official captions continue retrying every fallback interval
  - slow official paths now run only on every fourth background retry after fallback already has visible rows
  - pending extension reload and fresh-page Chrome timing review

- Local `0.1.86` diagnostic log copy recovery:
  - diagnostic panel now renders the snapshot inside a `code` block with a `复制日志` action
  - copy uses `navigator.clipboard.writeText` when available and falls back to selecting the log text
  - this should make future caption bug reports faster to inspect
  - pending extension reload and Chrome review

- Local `0.1.85` subtitle diagnostics recovery:
  - `rows:saved` now records source label, raw row count, cleaned row count, source types, translated row count, and native-caption hiding state
  - `translation:complete` now records final translated row counts
  - unexpected translation-flow errors are logged as `translation:error` without throwing an unhandled page error
  - this should make future caption bugs easier to trace from the diagnostic panel
  - pending extension reload and Chrome review

- Local `0.1.84` native-caption hiding for fallback recovery:
  - changed native YouTube CC hiding to activate whenever plugin subtitle rows exist, not only when official rows exist
  - visible-caption fallback already reads hidden caption DOM with `allowHiddenCaptions`, so fallback collection can continue after hiding the native overlay
  - this prevents fallback mode from showing both YouTube CC and plugin overlay at the same time
  - pending extension reload and fallback-video Chrome review

- Local `0.1.83` subtitle mode shortcut recovery:
  - right-side panel title bar now has a subtitle mode selector for `双语字幕`, `原文字幕`, and `译文字幕`
  - selector writes through the same local settings path as the full settings panel
  - switching modes refreshes the right-side list, bottom video overlay, and active row
  - mode changes are recorded in the diagnostic log as `subtitle-mode-change`
  - pending extension reload and Chrome review

- Local `0.1.82` right-side subtitle current-row recovery:
  - Chrome QA on `0.1.81` confirmed 217 official subtitle rows and Chinese translations were loaded
  - found the active row at `0:48` existed but was above the visible list while the panel remained pinned at the bottom
  - list re-render now suppresses automatic scroll events so they are not mistaken for user manual browsing
  - active-row scrolling now still pulls the row into view when it is completely offscreen
  - Chrome QA after reload confirmed `0.1.82`, 184 official rows, Chinese translations, native CC hidden, and active row visible at panel midpoint

- Local `0.1.81` library export and quiz-history recovery:
  - local library panel now exposes `导出 JSON`, `导出 CSV`, and `导出 Anki` actions
  - JSON export reuses the existing background `EXPORT_DATA` bundle
  - CSV export includes sentence, vocabulary, and practice rows in one local-first file
  - Anki CSV export maps saved sentences to `Front`, `Back`, `Video`, and `Time`
  - comprehension quiz option clicks now save a `quiz` practice attempt with score and selected answer
  - pending extension reload and Chrome download review

- Local `0.1.80` practice entry recovery:
  - user paused word-highlight sync work and asked to continue restoring other features
  - popup hero now opens the current page's full-screen mixed practice instead of being a static card
  - content script listens for `yll-open-practice` and opens practice after captions are ready
  - local library now shows a `练习收藏句` action when saved sentences exist
  - saved sentences are converted into practice rows so shadowing, dictation, cloze, and quiz can reuse the same practice overlay
  - pending extension reload and manual Chrome review

- Local `0.1.79` word-level sync refinement:
  - user reported subtitle word highlighting improved but still could not fully match audio
  - added `wordTimings` support to preserve YouTube json3 segment offsets when available
  - video overlay now prefers official segment timing for current-word highlighting before using heuristic timing
  - heuristic fallback now weights function words, longer content words, and punctuation pauses instead of splitting a cue evenly
  - added a separate `逐词校准` setting so word highlighting can be adjusted without moving whole-sentence subtitle sync
  - Chrome takeover transport was unavailable (`Transport closed`), so this remains pending manual reload and visual review

- Local `0.1.78` official-caption retry and word-sync calibration:
  - user reported the page appeared not to load official captions after reload
  - official auto loading now tries 3 times, waits up to 9 seconds per official attempt, and uses slow official paths on the last automatic attempt
  - fallback mode now retries official captions every 12 seconds instead of waiting 45 seconds
  - word highlighting now has a small extra lead independent of the sentence display lead so highlighted words can better match speech timing
  - pending extension reload and manual Chrome review because Chrome takeover transport is currently unavailable

- Local `0.1.77` word-highlight skip fix:
  - user reported the highlighted word did not visit every word and skipped ahead on some captions
  - found the overlay was still refreshed by the 500ms main subtitle loop, so short cues could jump over intermediate words
  - added an independent 90ms overlay refresh loop that only updates the video subtitle highlight
  - extracted active-cue selection into a shared helper so overlay word highlighting can refresh frequently without forcing right-side list scrolling
  - popup wake cleanup now also clears the overlay refresh timer to avoid stale content-script behavior after extension reload
  - pending extension reload and Chrome visual review

### 2026-06-02

- Local `0.1.76` subtitle word-highlight timing fix:
  - user reported highlighted words moved slower than the audio
  - found word highlighting reused the overlay minimum hold duration, which could stretch short cues to 3200ms
  - added a separate word-highlight duration with 900ms lower bound and 3600ms upper bound
  - word highlighting now uses the cue's own duration when possible, while overlay visibility can still stay readable
  - pending extension reload and visual timing review
- Local `0.1.75` invalidated extension context handling:
  - user saw learning library panel but it failed with `Extension context invalidated`
  - wrapped `chrome.runtime.sendMessage` in synchronous and asynchronous error handling
  - stale runtime errors now update status and show a Chinese instruction to use popup `唤醒面板`
  - stale cleanup removes the library and word popover instead of leaving a misleading half-working UI
  - popup wake cleanup now removes the versioned style node as well
  - `AGENTS.md` now calls out `Extension context invalidated` as stale-page evidence
  - pending extension reload and Chrome review
- Local `0.1.74` subtitle feature recovery:
  - added manual subtitle sync offset from -2000ms to +2000ms in settings
  - sync offset is used by active cue selection and video overlay timing
  - added approximate current-word highlighting inside the video subtitle overlay
  - added a setting to turn current-word highlighting on or off
  - overlay refreshes even when the active sentence is unchanged so the highlighted word can move
  - pending extension reload and Chrome visual timing review
- Local `0.1.73` style refresh bug fix:
  - user confirmed the library opened, but it rendered as unstyled plain text
  - found `installStyle()` skipped CSS updates whenever the old `yll-lab-style-v2` node existed
  - added a `data-yll-version` marker to the style node and replace it when the script version changes
  - stale script cleanup now removes the style node too
  - pending extension reload and Chrome review
- Local `0.1.72` local library visibility fix:
  - user confirmed the `学习库` button appears but clicking looked like no response
  - changed the library from a separate fixed floating panel to an inline panel inside the right-side subtitle panel
  - clicking `学习库` now immediately shows a loading, error, or record list area in the main panel
  - pending extension reload and Chrome review
- Local `0.1.71` visible local library recovery:
  - added a `学习库` button to the right-side panel
  - library panel reads existing local records through `GET_LIBRARY`
  - shows counts for saved sentences, vocabulary, and practice attempts
  - shows recent saved sentences, recent vocabulary, and recent practice attempts
  - popup stale-script cleanup also removes the new library panel
  - pending extension reload and Chrome review
- Local `0.1.70` shadowing and practice attempt recovery:
  - shadowing mode now asks for microphone permission only when the user clicks start recording
  - stopping recording creates local score cards for overall, pronunciation, fluency, and completeness
  - original audio blobs are not stored; only score metadata and the attempt are saved locally
  - dictation and cloze checks now also save practice attempts
  - pending extension reload and Chrome microphone review
- Local `0.1.69` practice feedback recovery:
  - dictation mode now shows word-level hit/miss feedback instead of only a percentage
  - cloze mode now has a typed answer input
  - cloze mode checks entered answers against generated blanks and can still reveal the full sentence
  - pending extension reload and Chrome review
- Local `0.1.68` stale script wake-up hardening:
  - observed popup at `0.1.67` while the YouTube page panel still ran `0.1.66`
  - strengthened `AGENTS.md` with a stale content-script protocol
  - changed popup wake/reload actions to clear old panel DOM, overlay, popover, settings, practice, debug panel, timer marker, rows, active key, and loaded video markers before injecting `assets/content.js`
  - pending extension reload and Chrome review
- Local `0.1.67` right-side scroll behavior:
  - changed active row auto-position from upper area to lower-middle area for the requested bottom-to-top reading feel
  - added a manual-scroll pause window so wheel, touch, drag-scroll, and keyboard scrolling are not immediately overridden by playback sync
  - marks programmatic auto-scroll so it does not get mistaken for user scrolling
  - pending extension reload and Chrome visual review
- Verified `0.1.66` after extension reload:
  - page panel version matched `0.1.66`
  - official caption track loaded 334 rows with Chinese translations
  - native YouTube captions were hidden
  - word lookup popover stayed visible after lookup
  - vocabulary save returned success and changed button text to `已收藏`
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

1. Manually review `0.1.67` active-row lower-middle positioning and manual-scroll pause after extension reload.
2. Tune overlay position and timing if the video subtitle still feels too high, too low, or too short-lived.
3. Continue practice mode recovery:
   - richer comprehension feedback
   - visible practice history actions
   - AI/API pronunciation scoring hook
4. Expand settings panel with highlight-style controls and per-mode defaults.
5. Expand the local library panel with search, delete, review filters, and export entry points.
6. Keep official caption diagnostics available, but hide the diagnostic panel from the default production view later.

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
