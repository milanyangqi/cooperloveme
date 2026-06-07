# YouTube Language Lab 0.2.0 Stable Checkpoint

Last updated: 2026-06-07 12:47 CST

This document records the first stable 0.2 checkpoint. Use it as the restore reference if a later change regresses official captions, translation, page vocabulary, word actions, subtitle overlay, or popup/settings behavior.

## Version Identity

- Extension manifest version: `0.2.0`
- Content script version: `SCRIPT_VERSION = "0.2.0"`
- Built extension directory used by Chrome during validation: `/Users/zhang/Documents/Codex_project/Youtube_Extension`
- Development worktree also synced: `/Users/zhang/.codex/worktrees/2900/Youtube_Extension`
- Git baseline intent: push this state to `origin/main` as the 0.2 stable feature baseline.

When validating in Chrome, the in-page panel must report `data-yll-version="0.2.0"` and the injected style tag must also report `data-yll-version="0.2.0"`. If popup or manifest shows 0.2.0 but the YouTube page panel shows an older version, close and reopen the YouTube watch tab before judging behavior.

## Stable Feature Set

- Official YouTube captions load as the preferred subtitle source.
- Visible/page CC collection remains only a temporary fallback and must not block official caption retries.
- Official rows may replace fallback rows after a later retry.
- Native YouTube CC is hidden when plugin subtitle rows are displayed.
- Right-side caption panel shows full sentence rows, seeks on row click, avoids duplicate rows, and scrolls active rows with playback.
- Video overlay shows bilingual subtitles, highlights the current word, and avoids rebuilding the same cue on every highlight tick.
- Hover/click word lookup positions the popover above the subtitle block with a hard gap to avoid overlap.
- Part-of-speech highlight colors from the highlighter settings are applied to rendered subtitle words.
- Popup page vocabulary reads from the sender YouTube tab first, then falls back to the active tab.
- Page vocabulary can read rows from the content-script cache, right-side panel DOM, and current overlay text.
- Page vocabulary no longer caps results at 400 in the background reader.
- Page vocabulary refreshes repeatedly while popup is open so video changes and late subtitle loads update the count.
- The page-vocab container is taller and shows more rows before scrolling.
- Page-vocab action icons have visible selected states:
  - saved word: yellow filled heart
  - mastered word: green filled check
  - saved sentence: blue filled sentence/book icon
- Saving a sentence from a page word enters a busy/pressed state and optimistically updates the local sentence list after success.
- Wordbook, translation, subtitle style, highlighter, and settings panels are present in the current stable UI.
- Pronunciation and speech-scoring scaffolding remain present through practice scoring, but a dedicated pronunciation settings page is not part of this verified 0.2.0 baseline.
- Local-first usage remains available without registration.
- Signed-in bootstrap, wordbooks, vocab items, sentence notes, practice attempts, and cloud-sync scaffolding remain present.

## Official Caption Path

Official caption acquisition in `src/content/safeAutoload.ts` should keep this priority:

1. Read complete `video.textTracks` only when they look complete enough for the current video.
2. Read player snapshots from the page/background.
3. Parse player responses from scripts and fetched watch HTML.
4. Use captured timedtext requests if available.
5. Load rows from official `captionTracks`.
6. Try direct YouTube timedtext rows.
7. Try transcript rows and transcript-panel rows.
8. Try YouTubei player/transcript paths.
9. Only then allow visible/page fallback as temporary display.

Important guardrails:

- Do not clear official-loading state merely because visible fallback starts.
- Do not treat short current-window `textTracks` as final official rows for long videos.
- Do not lock visible fallback as final while official timedtext, transcript, YouTubei, or captured timedtext can still retry.
- Do not show stale `正在读取官方字幕轨道...` status after final official rows already exist.
- If final official rows are present and locked for the current video, scheduled official retries should stop cleanly.
- Direct timedtext "prestart" was tested before 0.2.0 and reverted because it could delay the normal official stack and make some videos fall back to page capture first.

The 0.2.0 speed improvement is intentionally conservative: per-track official caption format requests now run in parallel for `base`, `json3`, `srv3`, and `vtt`, and direct timedtext format checks do the same per candidate. This reduces serial waiting without enabling fallback early or blocking official replacement.

## Chrome Runtime Validation

Validated on a real YouTube watch page after build/reload:

- Test URL: `https://www.youtube.com/watch?v=gC21G3dUKIM&t=137s`
- Panel version: `0.2.0` expected after reload; previous validation before the final version bump used the same code path at `0.1.150`.
- Stable official result:
  - 82 subtitle rows
  - row keys prefixed with `official:`
  - 82 translated rows
  - status: `官方已加载 82 条字幕；中文译文已生成。`
  - native YouTube caption container hidden with `opacity: 0` and `visibility: hidden`

Previous official-caption validation on the same stable path also passed on:

- `M3H5jtc5CWM`: 166 official rows, 166 translated rows, native CC hidden
- `qROkHxeFpDs`: 135 official rows, 135 translated rows, native CC hidden

## Local Validation Commands

Run these before pushing future caption-related changes:

```bash
npm run typecheck
npm run build
npm audit --audit-level=moderate
git diff --check
```

For 0.2.0, these checks passed in both:

- `/Users/zhang/Documents/Codex_project/Youtube_Extension`
- `/Users/zhang/.codex/worktrees/2900/Youtube_Extension`

## Restore Checklist For Future Bugs

If official captions regress:

- Compare `src/content/safeAutoload.ts` against this release.
- Confirm `loadRowsForCurrentVideo`, `loadOfficialRows`, `loadRowsFromTracks`, `loadDirectTimedTextRows`, `hasFinalOfficialRows`, `lockOfficialRowsForCurrentVideo`, and `enableVisibleFallback`.
- Verify visible fallback does not cancel official retries.
- Verify `captionTracks`, direct timedtext, transcript, YouTubei, and captured timedtext paths can still retry.
- Verify `data-yll-version` on the YouTube page, not only popup or manifest version.
- Close and reopen the YouTube watch tab if stale content-script behavior appears.

If page vocabulary regresses:

- Check `src/background/index.ts` `readActivePageWords(sender)`.
- It should read the sender tab first, merge content-script rows, right-panel DOM rows, and overlay text, filter common stop words, and return all sorted words.
- Check `src/popup/PopupApp.tsx` delayed/interval `refreshPageWords` behavior.
- Check popup preview height in `src/popup/popup.css`.

If action icons regress:

- Check `PreviewWord.sentenceSaved`.
- Check `savedSentenceKeys`.
- Check `PreviewWordRow` classes:
  - `word-action-save is-saved`
  - `word-action-master is-mastered`
  - `word-action-sentence is-sentence-saved`
- Check CSS selected states in `src/popup/popup.css`.

If overlay/hover regresses:

- Check current-cue render signature handling.
- Check hover popover positioning against the subtitle block rectangle.
- Check part-of-speech color settings and rendered word classes.

## Known Manual Review Item

Browser automation could not directly open `chrome-extension://.../popup.html` because of Chrome security policy. Code/build validation for the icon states passed, but actual click feedback should still be manually checked in the popup after loading 0.2.0.
