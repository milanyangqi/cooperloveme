# YouTube Language Lab Feature Timeline

Last updated: 2026-06-07 10:18:00 CST

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
| Official YouTube caption loading | In Review | 2026-06-07 10:18 CST | `0.1.138` adds `/api/timedtext?type=list` discovery so direct timedtext can use YouTube's actual `lang_code`, `kind`, and `name`, while fallback still displays early if official rows are late | Needs Chrome timing review on fresh page load and after clicking `重读字幕`. |
| Caption fallback from visible CC | Done | 2026-06-02 14:57 CST | `0.1.60` throttles official retries while fallback is active | Verified that native CC remained hidden on `0.1.60`; fallback remains secondary to official captions. |
| Native YouTube CC hiding | In Review | 2026-06-03 14:12 CST | `0.1.84` hides native YouTube captions whenever plugin subtitle rows exist, including visible-CC fallback | Needs fallback-video Chrome review. |
| Right-side caption panel with full sentences | In Review | 2026-06-06 22:09 CST | `0.1.133` removes learning/practice controls from the right-side panel, leaving subtitle mode, close, status, and subtitle rows only | Needs Chrome review after extension reload. |
| Right-side newest-on-top / upward scroll behavior | In Review | 2026-06-04 12:57 CST | `0.1.93` renders rows in chronological order and scrolls the active row into the lower part of the taller panel so playback moves upward | Needs extension reload and Chrome review on long videos. |
| Adjacent duplicate caption filtering | In Review | 2026-06-02 14:49 CST | `0.1.60` adds wider fallback similarity filtering | Needs more fallback-video review because current Chrome test used official captions. |
| Bilingual overlay on video | In Review | 2026-06-06 13:34 CST | `0.1.114` uses the same sync clock for sentence display and word highlighting, avoids overlay-duration drag, and rejects coarse word timings | Needs extension reload and spoken-audio review. |
| Free translation fallback | In Review | 2026-06-06 19:57 CST | `0.1.126` prioritizes current-cue translation, uses a smaller first batch, and stops invalidated stale scripts to avoid overlay flicker | Needs reload and Chrome review on an official-caption video. |
| Click word for translation | In Review | 2026-06-06 13:51 CST | `0.1.115` enables hover/click lookup on video overlay words and reuses cached or pending free-translation lookups | Needs Chrome hover review. |
| Subtitle settings panel | In Review | 2026-06-04 23:29 CST | `0.1.107` adds an internal close button and slightly narrows the floating settings panel | Needs extension reload and Chrome review. |
| Practice mode shell | In Review | 2026-06-06 22:52 CST | `0.1.135` keeps practice entry points in signed-in popup/settings/learning-library views instead of the subtitle-only right panel | Needs manual Chrome review; full Trancy-style layout still planned. |
| Shadowing / follow-read | In Review | 2026-06-02 20:44 CST | `0.1.70` adds microphone recording, local score cards, and practice-attempt save | Needs Chrome mic-permission review; AI scoring still future work. |
| Dictation mode | In Review | 2026-06-02 20:44 CST | `0.1.70` saves dictation attempt after word-level hit/miss feedback | Needs Chrome review and visible history UI. |
| Cloze / fill blank mode | In Review | 2026-06-02 20:44 CST | `0.1.70` saves cloze attempts after typed answer validation | Needs Chrome review and multi-blank UX tuning. |
| Comprehension quiz mode | In Review | 2026-06-03 13:05 CST | `0.1.81` saves quiz attempts to the local practice history after an option is selected | Needs generated questions and richer feedback. |
| Sentence save / collection | In Review | 2026-06-07 10:18 CST | `0.1.138` adds `收藏该句` on page-vocab rows so a word's source subtitle sentence can be collected directly | Needs extension reload and Chrome review. |
| Vocabulary library | In Review | 2026-06-07 10:18 CST | `0.1.138` dedupes duplicate default wordbooks, blocks deleting the default wordbook, and adds delete for non-default wordbooks | Needs extension reload and Chrome review. |
| Export / Anki / CSV | In Review | 2026-06-06 19:57 CST | `0.1.126` adds wordbook-aware CSV export plus vocab CSV/JSON import into the selected wordbook | Needs Chrome download/import review. |
| Cloud sync | In Review | 2026-06-06 22:24 CST | `0.1.134` adds authenticated Supabase REST sync for wordbooks, vocab, saved sentences, practice attempts, and settings, with cloud tables deployed by `learning_data_sync` | Needs extension reload and signed-in manual sync review. |
| Pro quotas / entitlement UI | Partial | 2026-06-01 | Popup/options/admin scaffolding exists | Backend second-pass checks still future work. |
| Popup account login entry | In Review | 2026-06-06 19:57 CST | `0.1.126` keeps stale invalidated content scripts from refreshing overlays after extension reload | Needs extension reload and popup review. |
| Admin console | Partial | 2026-06-01 | `docs/admin-management.md` | Needs production credential and full manual QA. |
| Caption diagnostics panel | In Review | 2026-06-04 20:39 CST | `0.1.104` removes the default toolbar diagnostics button and keeps logs behind Alt-click on the title | Needs reload and quick Chrome review. |
| Stale content-script protection | In Review | 2026-06-06 21:48 CST | `0.1.131` wraps all runtime message access, including `lastError`, so invalidated contexts are handled instead of leaking as uncaught errors | Needs extension reload and fresh YouTube page review. |

## Timeline

### 2026-06-04

- Local `0.1.91` word-highlight audio sync recovery:
  - removed the built-in subtitle display lead and extra word lead from the word-highlight clock, so the highlighted word follows the audio clock plus user calibration only
  - changed fallback word timing to span the full cue duration instead of compressing all words into a maximum 3.6-second window
  - keeps the existing manual global sync and word-only calibration sliders for later Chrome tuning
  - pending extension reload and Chrome review

- Local `0.1.92` official-caption startup recovery:
  - official caption loading now uses two automatic attempts before fallback: a fast pass for already available tracks and a slower pass that allows player/transcript paths to settle
  - slow official paths run only on the second pass or explicit force/retry so normal polling stays light
  - debug logs now include the timeout used for each official attempt
  - pending extension reload and Chrome review

- Local `0.1.93` caption sync and right-panel scroll recovery:
  - reduced the built-in subtitle display lead from 350ms to 250ms while keeping word highlight on the audio clock
  - changed the right-side caption list back to chronological rendering so playback scrolls old lines upward and brings the active line in from lower in the panel
  - increased the right-side panel height ceiling from 680px to 860px, with a taller viewport-relative layout
  - pending extension reload and Chrome review

- Local `0.1.94` row learning actions recovery:
  - restored compact per-row actions in the right-side subtitle list
  - `练习` opens the mixed-practice overlay scoped to the selected subtitle row
  - `收藏` saves the selected subtitle row to the local sentence library through the existing background storage path
  - pending extension reload and Chrome review

- Local `0.1.95` local sentence explanation recovery:
  - added a per-row `讲解` action in the right-side subtitle list
  - sentence explanation is local-first for V1: structure hints, key words, and shadowing tips are generated without API calls
  - the UI reuses the existing popover surface so later AI explanations can replace the local heuristic without changing the entry point
  - pending extension reload and Chrome review

- Local `0.1.96` partial-textTrack official loading fix:
  - user reported the right panel did not show all subtitles on a video that otherwise had working overlay captions
  - suspected cause: `video.textTracks` can expose only a small currently buffered cue window, but the extension previously saved it as complete and locked official rows
  - added a text-track completeness check using row count and video-duration coverage before saving/locking `video.textTracks`
  - partial text-track rows are now logged and the loader continues to timedtext/player/transcript paths for fuller official subtitles
  - pending extension reload and Chrome review

- Local `0.1.97` persistent row explanation recovery:
  - user reported the `讲解` display disappears too quickly
  - changed row explanation from a temporary floating popover to an inline expandable panel inside the selected subtitle row
  - the `讲解` button toggles to `收起`, and the expanded state is cleared only when the video/script context resets
  - pending extension reload and Chrome review

- Local `0.1.98` compact row action layout recovery:
  - user reported a large blank area inside short right-side subtitle rows
  - root cause: the vertical per-row action column stretched short subtitle rows, leaving unused space in the text column
  - changed row actions to a compact horizontal toolbar under the subtitle text and moved the inline explanation panel into the text column
  - pending extension reload and Chrome review

- Local `0.1.99` right-list density recovery:
  - row actions now stay hidden until the row is active, hovered, or focused
  - this keeps normal subtitle reading dense while preserving `练习`, `收藏`, and `讲解` on the current/selected row
  - pending extension reload and Chrome review

- Local `0.1.100` startup official-caption retry recovery:
  - user repeatedly observed that official captions often load only after clicking `重读字幕`
  - added delayed startup official-caption retries at 1.8s, 5.2s, and 11s after a new YouTube video id is detected
  - retries are skipped once official rows exist and are cleared on video changes, page leave, official lock, and manual reload
  - pending extension reload and Chrome review

- Local `0.1.101` ad playback subtitle pause:
  - user reported subtitle overlay and right-panel active rows keep moving while a YouTube ad is playing
  - added YouTube ad-state detection using player `ad-showing` / `ad-interrupting` classes and visible ad controls
  - while ads are active, the plugin hides the video subtitle overlay and stops right-list active scrolling, word highlighting, and visible-CC fallback collection
  - subtitle rows are kept in memory and resume after the ad ends
  - pending extension reload and ad playback review

- Local `0.1.102` ad-aware retry and dense list recovery:
  - official scheduled retries and startup retries now skip while a YouTube ad is playing, then reschedule shortly after
  - direct subtitle loading also exits early in ad state so background attempts cannot advance content captions during ads
  - right-side row action buttons no longer appear just because a row is active; they show only on hover or keyboard focus to keep the list dense
  - pending extension reload and Chrome review

- Local `0.1.103` free translation stability recovery:
  - free Google web translation previously sent one full subtitle batch concurrently, which could make translations fail or return empty during rate limiting
  - changed free translation to a small 4-request concurrency queue with one short retry per cue
  - the UI and AI translation path are unchanged; this only stabilizes the V1 no-API translation fallback
  - pending extension reload and Chrome review

- Local `0.1.104` production panel cleanup:
  - removed the always-visible `诊断日志` toolbar button from the right-side panel
  - diagnostic logs are still available by Alt-clicking the `YouTube Language Lab` title, so debugging remains possible without cluttering normal use
  - pending extension reload and Chrome review

- Local `0.1.105` current-cue practice recovery:
  - `练习当前句` previously fell back to the first subtitle row when the active row key was not set yet
  - it now selects the cue nearest to the current video clock, so the practice entry follows playback even before the list has highlighted a row
  - pending extension reload and Chrome review

- Local `0.1.106` learning-library lifecycle recovery:
  - user reported clicking `学习库` flashes the panel and immediately closes it
  - added explicit library open state and a short toggle debounce
  - normal YouTube page/video-state refresh no longer closes the learning library panel
  - close buttons, extension-context invalidation, and practice-from-library now use one close helper that clears state consistently
  - pending extension reload and Chrome review

- Local `0.1.107` caption-panel empty-state recovery:
  - screenshot showed a large blank right-side subtitle area while the page was in an ad/loading state
  - right-side list now renders an explicit empty state for ads, official-caption loading, and no-subtitle cases
  - floating subtitle settings panel now has an internal close button and a narrower width to reduce overlap
  - pending extension reload and Chrome review

- Local `0.1.108` official-caption startup speed recovery:
  - official-caption startup retries previously waited until 1800ms, which made fresh YouTube pages feel slow
  - startup probing now runs at 250ms, 900ms, 1800ms, 5200ms, and 11000ms
  - slower retries remain in place so early misses do not prevent later official-track recovery
  - pending extension reload and Chrome review

- Local `0.1.109` right-panel height recovery:
  - previous panel height was capped at 860px even on tall displays
  - max panel height is now 1040px and the header is slightly shorter
  - this should show more subtitle rows without changing the panel anchor position
  - pending extension reload and Chrome review

- Local `0.1.110` panel-header and source-state recovery:
  - user screenshot showed the right subtitle list covering the `学习库` toolbar area after the header was compacted
  - header now uses auto height with a larger minimum instead of a fixed clipped height
  - caption status now includes a source badge: `官方`, `Transcript`, `TimedText`, `TextTrack`, or `页面采集`
  - fallback-to-official retry interval shortened from 12s to 6s so page-capture rows do not delay official-track recovery as long
  - pending extension reload and Chrome review

- Local `0.1.111` official-caption parser recovery:
  - compared the current safe script with the older `src/content/youtube.ts` caption parser
  - official caption bodies now tolerate YouTube's `)]}'` JSON prefix
  - official caption parsing now supports `WEBVTT` and XML `<p t d>` paragraph nodes in addition to json3 and `<text start dur>`
  - this reduces cases where an official caption request succeeds but parses into zero rows
  - pending extension reload and Chrome review

- Local `0.1.112` official-caption multi-format recovery:
  - each official caption track now tries `fmt=json3`, `fmt=srv3`, and `fmt=vtt`
  - this reduces cases where the track exists but one requested format returns empty or unparsable text
  - debug logs now include the attempted caption format per track request
  - pending extension reload and Chrome review

- Local `0.1.113` official-caption speed and word-highlight recovery:
  - official loading now reads the background snapshot and watch-page HTML player response in parallel
  - the watch-page HTML response is capped at 1.6s so it can add tracks without delaying faster sources
  - caption tracks from snapshot, inline scripts, fetched watch HTML, and YouTubei are merged before trying `json3` / `srv3` / `vtt`
  - word highlighting now rejects sparse or mismatched JSON3 word timings instead of mapping them directly to rendered words
  - estimated word highlighting now uses the overlay readable duration, so extended subtitle display no longer jumps directly to the final word
  - pending extension reload and Chrome review

- Local `0.1.114` overlay interaction and auto-open recovery:
  - word highlighting now uses the same synced clock as sentence selection, instead of a separate raw video clock
  - estimated word progress no longer uses the 3.2s overlay minimum display duration, which was slowing highlights behind speech
  - video overlay words are now pointer-interactive and support hover/focus/click lookup
  - word lookup reuses the existing free translation path and caches results for the current page
  - closing the right panel no longer clears the content-script timers, so opening a new watch page can auto-mount the panel again
  - added a quality guard for coarse YouTube json3 word timings; low-span timings now fall back to smoother estimated word progress instead of jumping to the final word
  - added a small default word-highlight lead while keeping sentence timing unchanged
  - pending extension reload and Chrome review

- Local `0.1.115` YouTube SPA auto-injection recovery:
  - broadened the content-script match from `https://www.youtube.com/watch*` to `https://www.youtube.com/*`
  - the script still no-ops outside watch pages, but it can now survive YouTube homepage/search to watch-page SPA navigation and auto-mount without popup wake
  - word hover lookup now reuses pending per-word translation requests, avoiding repeated calls while the overlay refreshes under the mouse
  - pending extension reload and fresh YouTube route-change review

- Local `0.1.116` popup account entry recovery:
  - extension icon popup now loads `GET_BOOTSTRAP` and displays account state
  - anonymous users see email/password login and registration controls directly in the popup
  - signed-in users see account, plan, settings, and sign-out controls
  - pending extension reload and popup review

- Local `0.1.117` translation stability and account dashboard recovery:
  - translation status no longer updates on every batch, reducing the constantly changing status line
  - zero-translation results no longer trigger a 1.8s immediate retry loop; retries now use a slower capped backoff
  - diagnostic snapshot now records translation retry count, translated row count, last translation failure, and last summary
  - popup signed-in state now uses a compact account dashboard with vocab, saved sentence, practice, and mastered tiles inspired by Relingo
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - Chrome page inspection still showed stale `0.1.116` content script, so runtime review must wait for extension reload or fresh YouTube tab

- Local `0.1.118` popup account/settings stabilization:
  - popup no longer renders the anonymous login form while `GET_BOOTSTRAP` is pending, avoiding the brief false logged-out state for previously signed-in users
  - added a bottom `我的` / `设置` popup switcher inspired by Relingo's extension panel
  - the new popup settings view exposes enable plugin, wordbook, source/target language, bilingual subtitles, native CC hiding, practice behavior, playback rate, and AI toggle controls through the existing `UPDATE_SETTINGS` path
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - runtime review still needs Chrome extension reload and a fresh YouTube watch tab because current Chrome is not exposed through a remote debugging control port

- Local `0.1.119` popup settings expansion:
  - increased the extension icon popup container from 360x520 to 390x680 so the settings view exposes more rows before scrolling
  - added signed-in account actions for membership management and sign-out inside the popup settings tab
  - added local export, cloud sync, and save-recording controls through existing background runtime messages/settings storage
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.120` popup size and playback-speed expansion:
  - increased the extension icon popup container to 410x760 to show more of the account and settings content at once
  - expanded playback speed options from four values to fine-grained 0.5x through 2.0x choices
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.121` login-gated popup actions and taller container:
  - hides the full-screen mixed-practice entry, practice settings, recording-save toggle, wordbook/learning-library entry, cloud-sync toggle, and learning-data export until the Supabase account is signed in
  - keeps anonymous users focused on login, page detection, panel wake, and caption reread controls
  - increased the requested popup container to 430x860; Chrome may still cap action-popup height on smaller screens, so runtime review must confirm whether the host browser adds its own scrollbar
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.122` Relingo-style signed-in popup dashboard:
  - added a signed-in `我的` dashboard with feature cards for vocab, mastered words, sentence library, mixed practice, and PDF translation placeholder
  - added site-level controls for plugin enablement and always-translate behavior using existing settings storage
  - added a compact learning-library preview list sourced from local vocab and saved sentence records
  - added an account detail subpage with email, plan, expiry, stats, personal center, and sign-out actions
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.123` popup height and playback-rate application:
  - popup now computes its target height from the active YouTube page viewport using the same 520px / viewport-minus-92px / 1040px rule as the right subtitle panel
  - popup body scrolling is contained inside the main panel while the requested outer height stays aligned to the subtitle panel target
  - playback speed changes now save settings and immediately apply `video.playbackRate` to the active YouTube tab
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.124` page-docked popup and wordbook entry recovery:
  - removed the Chrome action `default_popup` and changed extension-icon clicks to toggle a YouTube page dock that uses the same height rule as the right subtitle panel
  - the dock embeds the existing popup UI as an extension iframe, avoiding Chrome action-popup host height limits and outer mouse scrolling
  - account bootstrap now caches signed-in snapshots and falls back quickly when the remote account endpoint is slow, preventing the UI from getting stuck in `LOADING`
  - wordbook and library cards now open the in-page learning library panel before falling back to the options page
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.125` dock-preserving subtitle reload:
  - `唤醒面板` and `重读字幕` now probe the active page script version first and use the in-page reload event when the version already matches
  - popup-triggered subtitle reload no longer calls the full content-script stop path that removes the page dock
  - the content-script stop helper now preserves the page dock so future reader reloads do not close the container
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.126` multi-wordbook and translation-speed recovery:
  - added a local `wordbooks` IndexedDB store and includes wordbooks in the export bundle
  - learning library now supports selecting a wordbook, creating new wordbooks, exporting the current wordbook CSV, and importing vocab CSV/JSON into the selected wordbook
  - saved vocabulary now attaches to the selected wordbook, with older unassigned words staying under the default wordbook
  - translation now prioritizes the current playback cue, uses a smaller first batch, increases web-translation concurrency moderately, and updates the UI after the first nearby batch
  - stale content scripts that hit `Extension context invalidated` now stop timers and remove overlays so old scripts do not keep flickering subtitles after extension reload
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and popup review

- Local `0.1.127` wordbook deletion and library-panel height fix:
  - added a `DELETE_VOCAB` runtime path that verifies the local user before deleting a saved vocabulary item
  - current-wordbook rows now include a manual delete button and refresh the learning library after deletion
  - the learning-library panel now takes over the subtitle panel content area while open, hides the caption list beneath it, and no longer creates its own internal scrollbar
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.128` persistent learning-library mount:
  - status updates now re-ensure the learning-library panel remains mounted when the user has it open
  - extension-context-invalidated handling no longer closes the learning library; it only removes volatile overlay/settings/practice UI
  - subtitle reload keeps the learning-library open flag and restores the panel after restarting the reader
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.129` peer-style vocabulary manager:
  - replaced the plain current-wordbook vocab list with peer-style `本页生词` / `已掌握` tabs
  - added a `模糊本页生词释义` toggle, orange mastery progress lines, saved-heart removal, mastered toggle, and detail expansion per word
  - added `UPDATE_VOCAB_MASTERY` so marking a word mastered or moving it back to new words persists in IndexedDB
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.130` page-word source and signed-in gates:
  - `本页生词` now derives from the current video subtitle rows, deduplicates English words, and excludes words whose persisted mastery is already complete
  - clicking the mastered action upserts unsaved page words into the selected wordbook and moves them into `已掌握`; moving back persists mastery `0`
  - the right-panel `练习当前句` and `学习库` toolbar entries are hidden unless `GET_BOOTSTRAP.auth.status` is `signed-in`, with event-level guards for popup-triggered opens
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.131` runtime invalidation and official-caption priority:
  - wrapped `chrome.runtime.sendMessage` and `chrome.runtime.lastError` access so invalidated extension contexts resolve into handled status instead of uncaught page errors
  - moved complete `video.textTracks` and direct `/api/timedtext` attempts ahead of slower caption-track/transcript paths
  - expanded direct timedtext language candidates and logs failed direct attempts for easier diagnosis
  - background caption fetch now returns content type so the content script can distinguish empty/HTML responses from usable caption bodies
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.132` popup current-page vocabulary:
  - popup `本页生词` now reads all deduped words from the active YouTube page's current subtitle rows instead of showing only saved vocabulary
  - page words merge with local saved/mastery state so `掌握` persists mastery `5` and moves the word to `已掌握`, while `生词` upserts the word into the default wordbook with mastery `0`
  - the popup vocabulary preview has an internal scroll area for long videos with hundreds of words, keeping the outer popup height stable
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.133` subtitle-panel simplification:
  - removed `练习当前句`, `字幕设置`, and `学习库` toolbar buttons from the right-side YouTube subtitle panel
  - removed hover row actions for practice, sentence collection, and inline explanation so the panel displays subtitle rows only
  - popup and docked popup still own the learning/practice/settings entry points
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.134` Supabase learning-data sync and popup navigation:
  - docked popup/settings view scrolls again by restoring vertical overflow in dock mode
  - settings page now exposes direct entries for `学习库 / 词本管理`, `打开混合练习`, and `立即同步到 Supabase`
  - added local-to-Supabase sync for wordbooks, vocab items, sentence notes, practice attempts, and settings through authenticated REST upserts
  - applied cloud migration `learning_data_sync` to project `ehmgfpksqyvtqqopuaii`, creating `yll_*` learning data tables with per-user RLS
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and signed-in Chrome sync review

- Local `0.1.135` learning-library live refresh and official reload path:
  - added a popup/dock learning-library page so `学习库 / 词本管理` no longer renders inside the right subtitle panel or blocks subtitle rows
  - disabled automatic restoration of the old in-page library panel when caption status text changes
  - broadcast learning-library changes after vocab, sentence, wordbook, import, mastery, and practice writes so popup lists refresh without reopening
  - popup `本页生词` now updates its local bootstrap state immediately after `生词` or `掌握` actions, then reloads from background storage
  - `重读字幕` now marks the next caption load as a forced official-track pass, instead of only restarting the regular poll loop
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.136` official-caption retry and popup library management:
  - reviewed the known-good `0.1.53` caption recovery notes, where official subtitles loaded through captured timedtext, captionTracks/playerResponse, transcript, player timedtext, and YouTubei retries before visible fallback
  - raised official auto attempts from 2 to 6 and widened slow official attempt timeout from 8.5s to 12s so late YouTube caption tracks have time to resolve
  - added signed-in popup action `收藏当前句`, which sends an in-page event to save the current active subtitle cue as a sentence note
  - added popup/dock learning-library controls for selecting a wordbook, creating a new wordbook, exporting the current wordbook, and previewing saved sentences
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.137` popup polish, vocab deletion, and early subtitle fallback:
  - after two failed official-caption attempts, the reader now enables visible-caption fallback while scheduling a background forced official retry, preventing a long empty subtitle panel
  - added delete controls for saved vocab rows in the popup/dock learning-library wordbook list
  - `立即同步到 Supabase` now asks for confirmation and shows a browser alert for success or failure, in addition to popup status text
  - reduced the `检测页面`, `唤醒面板`, and `重读字幕` action buttons into a compact three-column row
  - moved `收藏当前句` into the `收藏句` preview area so it is closer to sentence collection instead of the page action buttons
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.138` wordbook cleanup and site access management:
  - official direct timedtext now first reads YouTube's track list and tries listed language/kind/name combinations across json3, srv3, and vtt formats before falling back to guessed English tracks
  - background library loading now merges duplicate `默认词本` records and reassigns vocab from duplicates to the canonical default wordbook
  - added `DELETE_WORDBOOK` for non-default wordbooks; deleting a wordbook deletes its saved vocab and remote rows when cloud sync is enabled
  - popup learning-library view now shows a wordbook delete button next to the selector, disabled for `默认词本`
  - added black/white list settings fields and a popup `管理黑白名单` page modeled after Relingo's mode cards, add field, and deletable site list
  - page-vocab rows now include `收藏句`, saving the source subtitle sentence for that word
  - local checks passed: `npm run typecheck`, `npm run build`, `npm audit --audit-level=moderate`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.138` popup feature-card compacting:
  - reduced the signed-in home feature cards from 72px to 54px minimum height, with tighter gaps, padding, and smaller label/count text
  - local checks passed: `npm run build`, `git diff --check`
  - pending extension reload and Chrome review

- Local `0.1.138` popup version-card compacting:
  - reduced the current-version status card padding and margin, aligned the badge vertically, and constrained the description to a single ellipsized line
  - local checks passed: `npm run build`, `git diff --check`
  - pending extension reload and Chrome review

### 2026-06-03

- Local `0.1.90` translation auto-retry recovery:
  - added a capped auto-retry guard for cases where subtitle rows exist but no translated rows are rendered
  - retry is active only when translations are enabled and subtitle mode is not source-only
  - retry state is scoped to the current subtitle row generation and limited to three attempts to avoid repeated free-translation calls
  - pending extension reload and Chrome review

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
