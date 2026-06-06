# YouTube Language Lab Agent Notes

## Development Rules

- Keep `docs/feature-timeline.md` updated. Whenever a feature is completed, restored, paused, or regressed, add a timestamped note with validation status.
- Protect the official YouTube caption loading path first. Fallback CC collection is only a temporary display path and must not block later official-track retries.
- UI, practice, learning-library, popup, settings, and fallback changes must not regress or interrupt official subtitle acquisition. Do not clear official-loading state, cancel official retry timers, lock visible fallback rows, or treat page/visible captions as final while `captionTracks`, timedtext, transcript, YouTubei, or captured timedtext paths can still retry. Official rows must always be allowed to replace fallback rows when they become available.
- After rebuilding the unpacked Chrome extension, reload the extension in `chrome://extensions`, then force the YouTube watch page to run the new content script. A page refresh alone can keep an old content script timer alive.
- Before judging any browser result, verify the in-page panel `data-yll-version` matches `public/manifest.json` / `SCRIPT_VERSION`. If popup shows a newer version but the page panel is older, the page is stale; do not debug product behavior until the page script is current.
- To replace a stale page script after extension reload, rely on the background auto-wake path first. If the panel version is still old, close/reopen the YouTube watch tab or navigate away and back to force a fresh content-script instance.
- Stale content-script protocol:
  - Symptom: popup shows the new version, but the YouTube in-page panel still shows an older `data-yll-version`.
  - Treat this as an extension lifecycle issue, not a product bug. Do not change subtitle, scrolling, translation, or practice code based on stale-page behavior.
  - First wait for the extension install/startup auto-wake to inject the current content script into existing YouTube watch tabs.
  - If still stale, fully close the YouTube watch tab and open the video again. A normal reload may preserve timers or DOM from the older content script on YouTube's SPA page.
  - Re-check `document.querySelector("#yll-lab-panel-v2")?.getAttribute("data-yll-version")` before any further browser QA.
  - Only continue functional QA when popup version, manifest version, `SCRIPT_VERSION`, and in-page panel version all match.
  - If any in-page action reports `Extension context invalidated`, the visible panel is stale even if subtitles still appear. Close/reopen the YouTube tab before testing save, translate, library, or background-backed features.
- Before pushing caption-related changes, run:
  - `npm run typecheck`
  - `npm run build`
  - `npm audit --audit-level=moderate`
- Runtime validation must include a real YouTube watch page and check:
  - the panel version matches the built version
  - official captions load when available
  - native YouTube CC is hidden when plugin subtitles are shown
  - right-side rows are not duplicated
  - translated rows appear when translation is enabled

## Product Priorities

- V1 should remain local-first and usable without registration.
- Official captions are preferred over visible CC text.
- Visible CC fallback may be used only when official caption tracks are unavailable, and it should keep native CC hidden to avoid overlay duplication.
- The right panel should show full sentence rows, support seeking by clicking rows, and scroll with playback.
- The video overlay should show plugin subtitles, stay synced with audio, and avoid short flashes.
