# YouTube Language Lab

Chrome Manifest V3 extension for YouTube-first language learning.

## What is implemented

- YouTube content script with an isolated Shadow DOM UI.
- Caption loading from YouTube `json3` caption tracks.
- Dual subtitle panel with seek, save sentence, and AI explanation actions.
- Full-screen practice mode inspired by Trancy:
  - shadowing / follow-read with microphone recording
  - speech scoring through browser transcript + optional AI
  - dictation
  - cloze / fill-in-the-blank
  - comprehension quiz
- Local anonymous V1 account model.
- V2-ready account and entitlement data structures:
  - `UserProfile`
  - `EntitlementSnapshot`
  - `LocalUserMigration`
  - `UsageEvent`
  - `SyncRecord`
- Free quota enforcement for AI translation, explanation, and speech scoring.
- Local IndexedDB stores for vocabulary, sentence notes, practice attempts, usage events, and sync records.
- Popup with quota, library stats, and quick actions.
- Options page with account planning, AI settings, privacy controls, export, and local data deletion.

## Development

```bash
npm install
npm run build
```

Load the built extension from `dist/` in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this repo's `dist/` folder.

After every rebuild, click the reload icon on the extension card in `chrome://extensions`, then refresh the YouTube video tab. Chrome does not automatically replace an already-running unpacked extension/content script.

## How to use

1. Open a normal YouTube video page. The URL should look like `https://www.youtube.com/watch?v=...`.
2. Click the extension icon.
3. Click "读取字幕". The popup will close and the in-page subtitle panel should appear near the lower-right side of the YouTube page.
4. Click "开始练习" to load subtitles and open the full-screen practice mode.

If the current video has no readable YouTube subtitle track, the panel will show an error. Try a video with the CC/subtitle button available.

## AI setup

The extension works without AI keys. In that mode, speech scoring falls back to browser transcript/local heuristics and explanations show a local placeholder.

To enable AI:

1. Open extension options.
2. Enable AI.
3. Configure an OpenAI-compatible chat completions endpoint.
4. Save an API key. The key is stored only in `chrome.storage.local`.

## Privacy defaults

- No registration is required in V1.
- Learning data is local-first.
- Microphone permission is requested only when the user starts follow-read recording.
- Raw recordings are not saved by default.
- Cloud sync is a V2 placeholder switch and does not upload data in this implementation.

## 会员后端

账号登录和 Pro 权限校验的 Supabase/Stripe 后端骨架在 `supabase/`。
数据库、函数和部署说明见 `docs/supabase-membership.md`。

扩展设置页已经接入第一版 Supabase 邮箱/密码登录。登录 session 存在 `chrome.storage.local`，后台 service worker 会自动刷新，并调用已部署的 `me` Edge Function 读取当前权限快照。

没有默认管理员账号或密码。管理员后台会构建为 `admin.html`，账号需要先加入 Supabase 的 `public.admin_users` 表；具体登录、授权、权限和额度管理方式见 `docs/admin-management.md`。
