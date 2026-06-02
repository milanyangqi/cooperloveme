# YouTube Language Lab Feature Timeline

Last updated: 2026-06-02 14:24:02 CST

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
| Caption fallback from visible CC | Partial | 2026-06-02 12:31 CST | `0.1.56` falls back after fast official attempts finish | Native CC must be hidden while fallback/plugin subtitles show. |
| Native YouTube CC hiding | Done | 2026-06-02 | Runtime check showed native visible count 0 | Keep default enabled to avoid duplicate subtitle overlays. |
| Right-side caption panel with full sentences | Done | 2026-06-02 | Runtime test showed hundreds of complete rows | Rows support click-to-seek and word lookup. |
| Right-side newest-on-top / upward scroll behavior | In Review | 2026-06-02 12:03 CST | Local build `0.1.54` passed typecheck/build | Needs manual Chrome reload and visual review. |
| Adjacent duplicate caption filtering | Done | 2026-06-02 | Added near-time same-text filter | Only removes identical neighboring rows within 3 seconds. |
| Bilingual overlay on video | Partial | 2026-06-02 | Runtime test showed bilingual overlay visible | Timing and duration still need tuning. |
| Free translation fallback | Done | 2026-06-02 | Runtime test generated 289 translated rows | Uses free translation path before paid AI configuration. |
| Click word for translation | Partial | 2026-06-02 | Word spans and popover implemented | Needs broader UX review and vocabulary save flow. |
| Subtitle settings panel | Partial | 2026-06-02 | Hide native CC, show translation, position, font size controls exist | Needs full Relingo-style settings expansion. |
| Practice mode shell | Partial | 2026-06-02 | Lightweight practice overlay exists | Needs full Trancy-style mode restoration and real scoring behavior. |
| Shadowing / follow-read | Planned | Pending | Not fully restored | Needs mic flow, replay current sentence, scoring, and save attempt. |
| Dictation mode | Planned | Pending | Not fully restored | Needs sentence playback, input, compare, and retry. |
| Cloze / fill blank mode | Planned | Pending | Not fully restored | Needs generated blanks and answer validation. |
| Comprehension quiz mode | Planned | Pending | Not fully restored | Needs question generation and answer feedback. |
| Sentence save / collection | Partial | 2026-06-01 | Background storage APIs exist | Needs current lightweight panel buttons wired to library UX. |
| Vocabulary library | Partial | 2026-06-01 | Background storage APIs exist | Needs word lookup to save vocabulary cleanly. |
| Export / Anki / CSV | Planned | Pending | Export bundle exists, advanced export not restored | Planned for Pro/high-value workflow. |
| Cloud sync | Planned | Pending | V2 sync model planned | Not part of current V1 recovery. |
| Pro quotas / entitlement UI | Partial | 2026-06-01 | Popup/options/admin scaffolding exists | Backend second-pass checks still future work. |
| Admin console | Partial | 2026-06-01 | `docs/admin-management.md` | Needs production credential and full manual QA. |

## Timeline

### 2026-06-02

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

1. Manually review `0.1.58` right-side newest-on-top behavior after extension reload.
2. Tune overlay timing so subtitles do not flash too briefly.
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
