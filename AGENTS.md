# YouTube Language Lab Agent Notes

## Development Rules

- Keep `docs/feature-timeline.md` updated. Whenever a feature is completed, restored, paused, or regressed, add a timestamped note with validation status.
- Protect the official YouTube caption loading path first. Fallback CC collection is only a temporary display path and must not block later official-track retries.
- After rebuilding the unpacked Chrome extension, reload the extension in `chrome://extensions`, then refresh the YouTube watch page. A page refresh alone can keep an old content script alive.
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
