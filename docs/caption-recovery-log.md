# Caption Recovery Log

Date: 2026-06-02

## Context

The extension had regressed after several iterations around safe loading, fallback CC capture, native-caption hiding, right-side panel behavior, and translation. The user observed that an earlier pushed version could still read official captions, while later local builds mostly fell back to visible YouTube CC text.

The main symptom was that the right-side panel could show fallback captions only after CC was enabled, while official caption reading appeared unavailable. This also created risk of duplicate subtitles because YouTube native CC and plugin subtitles could overlap.

## Root Cause

The official caption path itself was not fully broken. The bigger product bug was control flow:

- once fallback CC collection started, the current video could be treated as already handled
- official caption retries stopped too early
- late-arriving `captionTracks`, captured timedtext requests, or YouTubei transcript data could not replace fallback rows
- stale content scripts from older unpacked-extension builds made debugging confusing because the page could show an older panel version even after rebuilding locally

This made the extension look like it could only use CC text, even when official captions became readable after the page/player finished loading.

## Fix Summary

Version `0.1.53` restores the official-caption-first behavior:

- Official caption loading continues to retry in the background when only fallback rows exist.
- Fallback CC collection no longer marks the video as permanently loaded.
- When official rows succeed, they replace fallback rows and disable fallback capture for that video.
- Native YouTube captions are hidden while plugin subtitles are shown.
- The panel uses versioned DOM IDs so stale older panels can be removed or hidden.
- Translation continues for official and fallback rows.
- A small adjacent duplicate filter removes near-identical neighboring official rows.

## Important Implementation Notes

Primary file:

- `src/content/safeAutoload.ts`

Important constants and runtime flags:

- `SCRIPT_VERSION`
- `OFFICIAL_RETRY_MS`
- `__yllSafeLastOfficialAttemptAt`
- `__yllSafeOfficialAttemptCount`
- `__yllSafeLastOfficialDebug`
- `__yllSafeCanUseVisibleFallback`
- `__yllSafeLoadedVideoId`

The important behavior is:

1. `loadRowsForCurrentVideo()` should skip only when official rows already exist for the current video.
2. If only fallback rows exist, the function may retry official loading after `OFFICIAL_RETRY_MS`.
3. `saveRows()` should mark the video as loaded only when rows include a non-`visible` source.
4. `captureVisibleFallback()` should never run when official rows exist.
5. `applySafeSettings()` should hide YouTube native captions when plugin official subtitles are active.

## Verified Behavior

Local checks passed:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Runtime Chrome verification on a real YouTube watch page showed:

- panel version reached `0.1.53` after extension reload
- official subtitle source loaded
- 289 official subtitle rows loaded on the tested video
- 289 translated rows were generated
- native YouTube CC visible count was 0
- plugin overlay was visible with bilingual subtitles

## Chrome Reload Lesson

For unpacked extensions, rebuilding `dist/` is not enough.

Correct manual QA sequence:

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Click reload on the YouTube Language Lab extension card.
4. Refresh the YouTube watch page.
5. Confirm popup and panel version match the expected version.

If a page still shows an older `data-yll-version`, the content script is stale and the test result should not be trusted.

## Remaining Work

The official caption path is restored enough to continue feature recovery. Next work should proceed in small steps:

- improve row order and scroll behavior
- improve overlay timing and duration
- finish settings panel controls
- restore practice modes beyond the lightweight placeholder
- improve translation quality and fallback behavior
- add safer regression diagnostics for official caption failures
