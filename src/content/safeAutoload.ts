type LabCue = {
  startMs: number;
  durationMs: number;
  text: string;
  source: "official" | "transcript" | "transcript-panel" | "text-track" | "timedtext" | "visible";
  translatedText?: string;
  translationProvider?: "web" | "ai" | "youtube" | "none";
};

type RawCaptionTrack = {
  baseUrl?: string;
  base_url?: string;
  url?: string;
  languageCode?: string;
  language_code?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> } | string;
};

type PlayerResponse = {
  videoDetails?: {
    videoId?: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: RawCaptionTrack[];
    };
  };
};

type RuntimeResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type PlayerSnapshot = {
  playerResponse?: PlayerResponse;
  captionTracks?: RawCaptionTrack[];
  transcriptParams?: string[];
  playerCaptionTracks?: RawCaptionTrack[];
  innertubeApiKey?: string;
  innertubeClientVersion?: string;
  visitorData?: string;
};

type CaptionFetchResult = {
  body: string;
  finalUrl: string;
  status: number;
  contentType?: string;
};

type CapturedTimedText = {
  url: string;
  body: string;
  status: number;
  contentType?: string;
  capturedAt: number;
};

const PANEL_ID = "yll-lab-panel-v2";
const STATUS_ID = "yll-lab-status-v2";
const LIST_ID = "yll-lab-list-v2";
const STYLE_ID = "yll-lab-style-v2";
const OVERLAY_ID = "yll-lab-overlay-v2";
const WORD_POPOVER_ID = "yll-lab-word-popover-v2";
const SETTINGS_PANEL_ID = "yll-lab-settings-v2";
const PRACTICE_ID = "yll-lab-practice-v2";
const DEBUG_PANEL_ID = "yll-lab-debug-v2";
const OLD_PANEL_ID = "yll-safe-panel";
const OLD_OVERLAY_ID = "yll-safe-overlay";
const OLD_WORD_POPOVER_ID = "yll-safe-word-popover";
const OLD_SETTINGS_PANEL_ID = "yll-safe-settings";
const OLD_PRACTICE_ID = "yll-safe-practice";
const LEGACY_HOST_ID = "youtube-language-lab-root";
const LEGACY_NATIVE_HIDE_STYLE_ID = "yll-hide-native-captions-style";
const SETTINGS_KEY = "yll-safe-settings-v1";
const SCRIPT_VERSION = "0.1.58";
const POLL_MS = 500;
const MAX_VISIBLE_ROWS = 260;
const DEFAULT_DISPLAY_LEAD_MS = 350;
const MIN_OVERLAY_DURATION_MS = 2200;
const TARGET_LANGUAGE = "zh-CN";
const TRANSLATION_BATCH_SIZE = 18;
const OFFICIAL_RETRY_MS = 3500;
const OFFICIAL_AUTO_ATTEMPTS = 2;
const OFFICIAL_ATTEMPT_TIMEOUT_MS = 5000;

type SafeSettings = {
  hideNativeCaptions: boolean;
  showTranslations: boolean;
  overlayPositionPercent: number;
  overlayFontSize: number;
};

const DEFAULT_SETTINGS: SafeSettings = {
  hideNativeCaptions: true,
  showTranslations: true,
  overlayPositionPercent: 82,
  overlayFontSize: 24
};

const runtime = window as typeof window & {
  __yllSafeTimer?: number;
  __yllSafeLastHref?: string;
  __yllSafeRows?: LabCue[];
  __yllSafeActiveKey?: string;
  __yllSafeLoadedVideoId?: string;
  __yllSafeLoadingVideoId?: string;
  __yllSafeTranslationToken?: number;
  __yllSafeTranslatedVideoId?: string;
  __yllSafeIsTranslating?: boolean;
  __yllSafeSettings?: SafeSettings;
  __yllSafeScriptVersion?: string;
  __yllSafeIsLoadingOfficial?: boolean;
  __yllSafeCanUseVisibleFallback?: boolean;
  __yllSafeLastFailure?: string;
  __yllSafeLastOfficialAttemptAt?: number;
  __yllSafeOfficialAttemptCount?: number;
  __yllSafeLastOfficialDebug?: string[];
  __yllSafeDebugLog?: string[];
  __yllSafeDebugSnapshot?: () => unknown;
  __yllTimedTextBridgeListening?: boolean;
  __yllTimedTextBridgeInstalled?: boolean;
  __yllCapturedTimedText?: CapturedTimedText[];
  ytcfg?: {
    get?: (key: string) => unknown;
  };
};

function removeLegacyContentApp() {
  document.getElementById(LEGACY_HOST_ID)?.remove();
  document.getElementById(LEGACY_NATIVE_HIDE_STYLE_ID)?.remove();
  document.getElementById(OLD_PANEL_ID)?.remove();
  document.getElementById(OLD_OVERLAY_ID)?.remove();
  document.getElementById(OLD_WORD_POPOVER_ID)?.remove();
  document.getElementById(OLD_SETTINGS_PANEL_ID)?.remove();
  document.getElementById(OLD_PRACTICE_ID)?.remove();
}

function isWatchPage() {
  return location.hostname.includes("youtube.com") && location.pathname === "/watch" && Boolean(getVideoId());
}

function getVideoId() {
  return new URL(location.href).searchParams.get("v") ?? "";
}

function installTimedTextCaptureListener() {
  if (runtime.__yllTimedTextBridgeListening) return;
  runtime.__yllTimedTextBridgeListening = true;
  runtime.__yllCapturedTimedText = runtime.__yllCapturedTimedText ?? [];
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data as Partial<CapturedTimedText> & { source?: string; type?: string };
    if (data?.source !== "yll-timedtext-bridge" || data.type !== "timedtext-body" || !data.url) return;
    const item: CapturedTimedText = {
      url: String(data.url),
      body: String(data.body ?? ""),
      status: Number(data.status ?? 0),
      contentType: data.contentType ? String(data.contentType) : "",
      capturedAt: Number(data.capturedAt ?? Date.now())
    };
    const next = [...(runtime.__yllCapturedTimedText ?? []).filter((entry) => entry.url !== item.url), item];
    runtime.__yllCapturedTimedText = next.slice(-30);
  });
}

async function ensureTimedTextBridge() {
  installTimedTextCaptureListener();
  if (runtime.__yllTimedTextBridgeInstalled) return;
  const response = await sendRuntimeMessage<{ installed: boolean }>({ type: "INSTALL_TIMEDTEXT_BRIDGE" });
  if (!response?.ok) throw new Error(response?.error ?? "timedtext bridge install failed");
  runtime.__yllTimedTextBridgeInstalled = true;
}

function cleanText(value: string) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return textarea.value.trim();
}

function uniqueAdjacentWords(text: string) {
  const words = cleanText(text).split(" ").filter(Boolean);
  if (words.length < 4) return words.join(" ");

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    const next: string[] = [];
    for (let index = 0; index < words.length;) {
      let repeatedSize = 0;
      const maxSize = Math.min(14, Math.floor((words.length - index) / 2));
      for (let size = maxSize; size >= 1; size -= 1) {
        const first = words.slice(index, index + size).join(" ").toLowerCase();
        const second = words.slice(index + size, index + size * 2).join(" ").toLowerCase();
        if (first === second) {
          repeatedSize = size;
          break;
        }
      }
      if (repeatedSize > 0) {
        next.push(...words.slice(index, index + repeatedSize));
        index += repeatedSize * 2;
        changed = true;
      } else {
        next.push(words[index]);
        index += 1;
      }
    }
    words.splice(0, words.length, ...next);
    if (!changed) break;
  }

  return words.join(" ");
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function loadSafeSettings(): SafeSettings {
  if (runtime.__yllSafeSettings) return runtime.__yllSafeSettings;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Partial<SafeSettings>;
    runtime.__yllSafeSettings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      overlayPositionPercent: Math.min(94, Math.max(50, Number(stored.overlayPositionPercent ?? DEFAULT_SETTINGS.overlayPositionPercent))),
      overlayFontSize: Math.min(42, Math.max(16, Number(stored.overlayFontSize ?? DEFAULT_SETTINGS.overlayFontSize)))
    };
  } catch {
    runtime.__yllSafeSettings = DEFAULT_SETTINGS;
  }
  return runtime.__yllSafeSettings;
}

function saveSafeSettings(settings: SafeSettings) {
  runtime.__yllSafeSettings = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySafeSettings();
  renderSettingsPanel();
  renderRows(runtime.__yllSafeRows ?? []);
  updateActiveCue();
}

function applySafeSettings() {
  const settings = loadSafeSettings();
  const hasOfficialRows = (runtime.__yllSafeRows ?? []).some((cue) => cue.source !== "visible");
  document.documentElement.classList.toggle("yll-hide-native-captions", settings.hideNativeCaptions && hasOfficialRows);
}

function renderClickableText(text: string) {
  const pattern = /(\p{L}[\p{L}\p{M}'-]*|\p{N}+)/gu;
  let output = "";
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const word = match[0];
    const index = match.index ?? 0;
    output += escapeHtml(text.slice(lastIndex, index));
    output += `<span class="yll-word" role="button" tabindex="0" data-word="${escapeHtml(word)}">${escapeHtml(word)}</span>`;
    lastIndex = index + word.length;
  }
  output += escapeHtml(text.slice(lastIndex));
  return output;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function cueKey(cue: LabCue) {
  return `${cue.source}:${Math.round(cue.startMs / 100)}:${normalizeForCompare(cue.text)}`;
}

function dedupeKey(cue: LabCue) {
  return `${cue.source}:${Math.round(cue.startMs / 500)}:${normalizeForCompare(cue.text)}`;
}

function translationKey(cue: LabCue) {
  return `${Math.round(cue.startMs / 100)}:${normalizeForCompare(cue.text)}`;
}

function normalizeForCompare(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function compactRepeatedPhrases(text: string) {
  const cleaned = uniqueAdjacentWords(text)
    .replace(/\s*([,.!?;:])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned
    .split(/(?<=[.!?])\s+|(?=\s[-–—]\s)|\s(?=[A-Z][a-z]+(?:\s|$))/)
    .map((part) => cleanText(part))
    .filter(Boolean);
  if (parts.length <= 1) return cleaned;

  const seen = new Set<string>();
  const compacted: string[] = [];
  for (const part of parts) {
    const key = normalizeForCompare(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    compacted.push(part);
  }

  return uniqueAdjacentWords(compacted.join(" "));
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function endsWithSentencePunctuation(text: string) {
  return /[.!?。！？]["')\]]?$/.test(text.trim());
}

function mergeAdjacentCues(cues: LabCue[]) {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  const merged: LabCue[] = [];
  let current: LabCue | undefined;

  const commit = () => {
    if (!current) return;
    current.text = compactRepeatedPhrases(current.text);
    if (current.text) merged.push(current);
    current = undefined;
  };

  for (const cue of sorted) {
    const nextCue = { ...cue, text: compactRepeatedPhrases(cue.text) };
    if (!nextCue.text) continue;

    if (!current) {
      current = nextCue;
      continue;
    }

    if (current.source !== nextCue.source) {
      commit();
      current = nextCue;
      continue;
    }

    const currentEndMs = current.startMs + current.durationMs;
    const gapMs = nextCue.startMs - currentEndMs;
    const combinedText = compactRepeatedPhrases(`${current.text} ${nextCue.text}`);
    const combinedDurationMs = Math.max(current.durationMs, nextCue.startMs + nextCue.durationMs - current.startMs);
    const shouldCommitBeforeNext =
      gapMs > 850 ||
      endsWithSentencePunctuation(current.text) ||
      wordCount(combinedText) > 22 ||
      combinedDurationMs > 7600;

    if (shouldCommitBeforeNext) {
      commit();
      current = nextCue;
      continue;
    }

    current = {
      ...current,
      durationMs: combinedDurationMs,
      text: combinedText
    };
  }

  commit();
  return merged;
}

function installStyle() {
  removeLegacyContentApp();
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${OLD_PANEL_ID},
    #${OLD_OVERLAY_ID},
    #${OLD_WORD_POPOVER_ID},
    #${OLD_SETTINGS_PANEL_ID},
    #${OLD_PRACTICE_ID} {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      top: 76px;
      z-index: 2147483647;
      width: 370px;
      height: clamp(420px, calc(100dvh - 104px), 680px);
      overflow: hidden;
      background: #202224;
      color: #f7f8f8;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 16px 42px rgba(0,0,0,.3);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      contain: layout paint style;
      display: flex;
      flex-direction: column;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .yll-head {
      flex: 0 0 112px;
      height: 112px;
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,.12);
      background: #202224;
      overflow: hidden;
    }
    #${PANEL_ID} .yll-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    #${PANEL_ID} .yll-title { font-weight: 750; font-size: 14px; }
    #${PANEL_ID} .yll-close {
      height: 28px;
      padding: 0 10px;
      color: #fff;
      background: #2b2e32;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 6px;
      cursor: pointer;
    }
    #${PANEL_ID} .yll-toolbar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
    }
    #${PANEL_ID} .yll-tool {
      height: 30px;
      color: #121212;
      background: #ffc857;
      border: 0;
      border-radius: 6px;
      font-weight: 750;
      cursor: pointer;
    }
    #${PANEL_ID} .yll-tool.secondary {
      color: #f7f8f8;
      background: #2d3034;
      border: 1px solid rgba(255,255,255,.14);
    }
    #${STATUS_ID} {
      margin-top: 8px;
      height: 30px;
      overflow: hidden;
      color: #a3aab5;
      font-size: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    #${LIST_ID} {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-color: rgba(255,255,255,.38) transparent;
    }
    #${LIST_ID} .yll-row {
      display: grid;
      grid-template-columns: 52px 1fr;
      gap: 8px;
      width: 100%;
      border: 0;
      border-top: 1px solid rgba(255,255,255,.08);
      background: transparent;
      color: inherit;
      text-align: left;
      padding: 9px 12px;
      cursor: pointer;
    }
    #${LIST_ID} .yll-row:hover { background: rgba(255,255,255,.06); }
    #${LIST_ID} .yll-row.is-active { background: rgba(255,200,87,.14); }
    #${LIST_ID} .yll-time {
      color: #ffc857;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${LIST_ID} .yll-text {
      white-space: normal;
      overflow-wrap: anywhere;
      font-weight: 650;
    }
    #${LIST_ID} .yll-translation {
      margin-top: 4px;
      color: #cfd4dc;
      font-size: 12px;
      font-weight: 500;
      overflow-wrap: anywhere;
    }
    #${LIST_ID}.hide-translations .yll-translation { display: none; }
    #${LIST_ID} .yll-word {
      border-radius: 3px;
      cursor: help;
    }
    #${LIST_ID} .yll-word:hover,
    #${LIST_ID} .yll-word:focus {
      color: #111;
      background: #ffc857;
      outline: none;
    }
    #${WORD_POPOVER_ID} {
      position: fixed;
      z-index: 2147483647;
      right: 394px;
      top: 86px;
      width: 260px;
      max-width: calc(100vw - 430px);
      padding: 10px 12px;
      color: #f7f8f8;
      background: #25282c;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 12px 30px rgba(0,0,0,.32);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${WORD_POPOVER_ID} strong { display: block; margin-bottom: 4px; color: #ffc857; }
    #${WORD_POPOVER_ID} p { margin: 0; color: #d7dbe1; }
    #${SETTINGS_PANEL_ID} {
      position: fixed;
      z-index: 2147483647;
      right: 394px;
      top: 76px;
      width: 300px;
      max-width: calc(100vw - 430px);
      padding: 14px;
      color: #f7f8f8;
      background: #25282c;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 14px 34px rgba(0,0,0,.34);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${SETTINGS_PANEL_ID} h3 { margin: 0 0 10px; font-size: 15px; }
    #${SETTINGS_PANEL_ID} label {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid rgba(255,255,255,.09);
    }
    #${SETTINGS_PANEL_ID} input[type="range"] { width: 120px; }
    #${SETTINGS_PANEL_ID} .yll-setting-value { color: #ffc857; font-variant-numeric: tabular-nums; }
    #${DEBUG_PANEL_ID} {
      position: fixed;
      z-index: 2147483647;
      right: 394px;
      top: 76px;
      width: 420px;
      max-width: calc(100vw - 430px);
      max-height: 70vh;
      padding: 12px;
      color: #f7f8f8;
      background: #202224;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 12px 30px rgba(0,0,0,.32);
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow: auto;
      white-space: pre-wrap;
    }
    #${DEBUG_PANEL_ID} strong { display: block; margin-bottom: 8px; color: #ffc857; font: 700 13px/1.2 system-ui, sans-serif; }
    #${PRACTICE_ID} {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      background: rgba(0,0,0,.82);
      color: #f7f8f8;
      font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PRACTICE_ID} .yll-practice-card {
      width: min(860px, calc(100vw - 48px));
      min-height: 460px;
      padding: 26px;
      background: #181a1d;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 8px;
      box-shadow: 0 18px 60px rgba(0,0,0,.46);
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 18px;
    }
    #${PRACTICE_ID} .yll-practice-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    #${PRACTICE_ID} h2 { margin: 0; font-size: 18px; }
    #${PRACTICE_ID} .yll-practice-sentence {
      margin: 20px 0 10px;
      font-size: 28px;
      font-weight: 760;
      line-height: 1.35;
    }
    #${PRACTICE_ID} .yll-practice-translation { color: #f5e86e; font-size: 20px; }
    #${PRACTICE_ID} textarea {
      width: 100%;
      min-height: 100px;
      resize: vertical;
      margin-top: 16px;
      padding: 12px;
      color: #fff;
      background: #24272b;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 6px;
      font: inherit;
    }
    #${PRACTICE_ID} .yll-practice-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    #${PRACTICE_ID} button {
      height: 34px;
      padding: 0 14px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,.14);
      background: #2d3034;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    #${PRACTICE_ID} button.primary {
      color: #151515;
      background: #ffc857;
      border: 0;
    }
    #${OVERLAY_ID} {
      position: fixed;
      z-index: 2147483646;
      left: 50%;
      top: 72%;
      transform: translateX(-50%);
      max-width: min(860px, 72vw);
      padding: 8px 12px;
      color: #fff;
      background: rgba(0,0,0,.78);
      border-radius: 6px;
      text-align: center;
      font: 700 24px/1.32 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-shadow: 0 1px 2px rgba(0,0,0,.7);
      pointer-events: none;
      opacity: 0;
    }
    #${OVERLAY_ID}.is-visible { opacity: 1; }
    #${OVERLAY_ID} .yll-overlay-source { display: block; }
    #${OVERLAY_ID} .yll-overlay-translation {
      display: block;
      margin-top: 4px;
      color: #f5e86e;
      font-size: 20px;
      font-weight: 650;
    }
    html.yll-hide-native-captions .ytp-caption-window-container,
    html.yll-hide-native-captions .caption-window,
    html.yll-hide-native-captions .ytp-caption-segment {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function mountPanel() {
  removeLegacyContentApp();
  installStyle();
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    if (existing.getAttribute("data-yll-version") === SCRIPT_VERSION) return existing;
    existing.remove();
  }

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.setAttribute("data-yll-version", SCRIPT_VERSION);
  panel.innerHTML = `
    <div class="yll-head">
      <div class="yll-title-row">
        <div class="yll-title">YouTube Language Lab</div>
        <button class="yll-close" type="button">关闭</button>
      </div>
      <div class="yll-toolbar">
        <button class="yll-tool" type="button" data-yll-action="practice">练习当前句</button>
        <button class="yll-tool secondary" type="button" data-yll-action="settings">字幕设置</button>
        <button class="yll-tool secondary" type="button" data-yll-action="debug">诊断日志</button>
      </div>
      <div id="${STATUS_ID}">正在连接当前 YouTube 视频页...</div>
    </div>
    <div id="${LIST_ID}"></div>
  `;
  panel.querySelector<HTMLButtonElement>(".yll-close")?.addEventListener("click", () => {
    panel.remove();
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(WORD_POPOVER_ID)?.remove();
    document.getElementById(SETTINGS_PANEL_ID)?.remove();
    document.getElementById(PRACTICE_ID)?.remove();
    document.documentElement.classList.remove("yll-hide-native-captions");
    if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
    runtime.__yllSafeTimer = undefined;
    runtime.__yllSafeTranslationToken = undefined;
  });
  panel.querySelector<HTMLButtonElement>('[data-yll-action="settings"]')?.addEventListener("click", () => {
    toggleSettingsPanel();
  });
  panel.querySelector<HTMLButtonElement>('[data-yll-action="practice"]')?.addEventListener("click", () => {
    openPracticeOverlay();
  });
  panel.querySelector<HTMLButtonElement>('[data-yll-action="debug"]')?.addEventListener("click", () => {
    toggleDebugPanel();
  });
  document.documentElement.appendChild(panel);
  applySafeSettings();
  return panel;
}

function setStatus(text: string) {
  const status = document.getElementById(STATUS_ID);
  if (status) {
    status.textContent = text;
    status.title = text;
  }
}

function addDebugLog(event: string, details?: unknown) {
  const video = getMainVideo();
  const time = new Date().toISOString().slice(11, 19);
  const videoTime = video ? `${video.currentTime.toFixed(1)}s` : "-";
  let suffix = "";
  if (details !== undefined) {
    try {
      suffix = ` ${JSON.stringify(details)}`;
    } catch {
      suffix = ` ${String(details)}`;
    }
  }
  runtime.__yllSafeDebugLog = [
    ...(runtime.__yllSafeDebugLog ?? []),
    `[${time} @${videoTime}] ${event}${suffix}`
  ].slice(-140);
  renderDebugPanel();
}

function debugSnapshot() {
  const rows = runtime.__yllSafeRows ?? [];
  return {
    version: SCRIPT_VERSION,
    videoId: getVideoId(),
    rows: rows.length,
    sources: Array.from(new Set(rows.map((cue) => cue.source))),
    loadingVideoId: runtime.__yllSafeLoadingVideoId,
    loadedVideoId: runtime.__yllSafeLoadedVideoId,
    isLoadingOfficial: runtime.__yllSafeIsLoadingOfficial,
    canUseFallback: runtime.__yllSafeCanUseVisibleFallback,
    attempts: runtime.__yllSafeOfficialAttemptCount,
    lastFailure: runtime.__yllSafeLastFailure,
    lastOfficialDebug: runtime.__yllSafeLastOfficialDebug,
    log: runtime.__yllSafeDebugLog ?? []
  };
}

function toggleDebugPanel() {
  const existing = document.getElementById(DEBUG_PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }
  const panel = document.createElement("section");
  panel.id = DEBUG_PANEL_ID;
  document.documentElement.appendChild(panel);
  renderDebugPanel();
}

function renderDebugPanel() {
  const panel = document.getElementById(DEBUG_PANEL_ID);
  if (!panel) return;
  const snapshot = debugSnapshot();
  panel.innerHTML = `<strong>字幕诊断日志</strong>${escapeHtml(JSON.stringify(snapshot, null, 2))}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
    promise.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
}

function mountWordPopover() {
  let popover = document.getElementById(WORD_POPOVER_ID);
  if (popover) return popover;
  popover = document.createElement("div");
  popover.id = WORD_POPOVER_ID;
  popover.hidden = true;
  document.documentElement.appendChild(popover);
  document.addEventListener("click", (event) => {
    if (!popover || popover.hidden) return;
    const target = event.target as Element | null;
    if (target?.closest(`#${WORD_POPOVER_ID}`) || target?.closest(`#${PANEL_ID}`)) return;
    popover.hidden = true;
  });
  return popover;
}

function showWordPopover(word: string, message: string) {
  const popover = mountWordPopover();
  popover.hidden = false;
  popover.innerHTML = `<strong>${escapeHtml(word)}</strong><p>${escapeHtml(message)}</p>`;
}

function toggleSettingsPanel() {
  const existing = document.getElementById(SETTINGS_PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }
  ensureSettingsPanel();
  renderSettingsPanel();
}

function renderSettingsPanel() {
  const existing = document.getElementById(SETTINGS_PANEL_ID);
  const settings = loadSafeSettings();
  if (!existing) return;
  existing.innerHTML = settingsPanelHtml(settings);
  bindSettingsPanel(existing);
}

function settingsPanelHtml(settings: SafeSettings) {
  return `
    <h3>视频字幕</h3>
    <label>
      <span>隐藏 YouTube 原生字幕</span>
      <input type="checkbox" data-setting="hideNativeCaptions" ${settings.hideNativeCaptions ? "checked" : ""}>
    </label>
    <label>
      <span>显示中文译文</span>
      <input type="checkbox" data-setting="showTranslations" ${settings.showTranslations ? "checked" : ""}>
    </label>
    <label>
      <span>字幕位置</span>
      <span><input type="range" min="50" max="94" step="1" data-setting="overlayPositionPercent" value="${settings.overlayPositionPercent}"> <span class="yll-setting-value">${settings.overlayPositionPercent}%</span></span>
    </label>
    <label>
      <span>原文字号</span>
      <span><input type="range" min="16" max="42" step="1" data-setting="overlayFontSize" value="${settings.overlayFontSize}"> <span class="yll-setting-value">${settings.overlayFontSize}px</span></span>
    </label>
  `;
}

function bindSettingsPanel(panel: HTMLElement) {
  panel.querySelectorAll<HTMLInputElement>("input[data-setting]").forEach((input) => {
    input.addEventListener("input", () => {
      const current = loadSafeSettings();
      const key = input.dataset.setting as keyof SafeSettings;
      const next: SafeSettings = { ...current };
      if (input.type === "checkbox") {
        (next[key] as boolean | number) = input.checked;
      } else {
        (next[key] as boolean | number) = Number(input.value);
      }
      saveSafeSettings(next);
    });
  });
}

function ensureSettingsPanel() {
  let panel = document.getElementById(SETTINGS_PANEL_ID);
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = SETTINGS_PANEL_ID;
  document.documentElement.appendChild(panel);
  return panel;
}

function currentCue() {
  const rows = runtime.__yllSafeRows ?? [];
  if (!rows.length) return undefined;
  const activeKey = runtime.__yllSafeActiveKey;
  return rows.find((cue) => cueKey(cue) === activeKey) ?? rows[0];
}

function clozeText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4) return text.replace(/\S+/, "____");
  return words.map((word, index) => (index % 5 === 2 ? "____" : word)).join(" ");
}

function openPracticeOverlay() {
  const cue = currentCue();
  if (!cue) {
    setStatus("还没有可练习的字幕句子。");
    return;
  }
  const video = getMainVideo();
  video?.pause();
  document.getElementById(PRACTICE_ID)?.remove();
  const overlay = document.createElement("section");
  overlay.id = PRACTICE_ID;
  overlay.innerHTML = `
    <div class="yll-practice-card">
      <header class="yll-practice-head">
        <div>
          <h2>全屏混合练习</h2>
          <span>${formatClock(cue.startMs)} · 跟读 / 听写 / 填空 / 理解选择</span>
        </div>
        <button type="button" data-practice-close>关闭</button>
      </header>
      <main>
        <div class="yll-practice-sentence" data-practice-sentence>${escapeHtml(cue.text)}</div>
        <div class="yll-practice-translation">${escapeHtml(cue.translatedText ?? "译文生成后会显示在这里")}</div>
        <textarea placeholder="听写模式：在这里输入你听到的句子"></textarea>
      </main>
      <footer class="yll-practice-actions">
        <button class="primary" type="button" data-practice-mode="shadowing">跟读当前句</button>
        <button type="button" data-practice-mode="dictation">听写</button>
        <button type="button" data-practice-mode="cloze">填空</button>
        <button type="button" data-practice-mode="quiz">理解选择</button>
        <button type="button" data-practice-replay>播放原声</button>
      </footer>
    </div>
  `;
  overlay.querySelector<HTMLElement>("[data-practice-close]")?.addEventListener("click", () => overlay.remove());
  overlay.querySelector<HTMLElement>("[data-practice-replay]")?.addEventListener("click", () => {
    const player = getMainVideo();
    if (!player) return;
    player.currentTime = cue.startMs / 1000;
    void player.play();
  });
  overlay.querySelectorAll<HTMLElement>("[data-practice-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.practiceMode;
      const sentence = overlay.querySelector<HTMLElement>("[data-practice-sentence]");
      if (!sentence) return;
      if (mode === "cloze") sentence.textContent = clozeText(cue.text);
      if (mode === "dictation") sentence.textContent = "听原声，写下完整句子";
      if (mode === "quiz") sentence.textContent = cue.translatedText ? `选择与译文匹配的原句：${cue.translatedText}` : "译文生成后可进行理解选择";
      if (mode === "shadowing") sentence.textContent = cue.text;
    });
  });
  document.documentElement.appendChild(overlay);
}

function mountOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  document.documentElement.appendChild(overlay);
  return overlay;
}

function getMainVideo() {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
  if (!videos.length) return undefined;
  return videos
    .map((video) => {
      const rect = video.getBoundingClientRect();
      const style = window.getComputedStyle(video);
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0";
      return { video, score: visible ? rect.width * rect.height : 0 };
    })
    .sort((a, b) => b.score - a.score)[0]?.video ?? videos[0];
}

function positionOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  const video = getMainVideo();
  if (!overlay || !video) return;
  const settings = loadSafeSettings();
  const rect = video.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    overlay.classList.remove("is-visible");
    return;
  }
  overlay.style.left = `${rect.left + rect.width / 2}px`;
  overlay.style.top = `${rect.top + rect.height * (settings.overlayPositionPercent / 100)}px`;
  overlay.style.maxWidth = `${Math.max(280, Math.min(rect.width * 0.86, 980))}px`;
  overlay.style.fontSize = `${settings.overlayFontSize}px`;
}

function setOverlayCue(cue?: LabCue) {
  const overlay = mountOverlay();
  positionOverlay();
  if (!cue?.text) {
    overlay.innerHTML = "";
    overlay.classList.remove("is-visible");
    return;
  }
  const translation = cue.translatedText?.trim();
  const settings = loadSafeSettings();
  overlay.innerHTML = `
    <span class="yll-overlay-source">${escapeHtml(cue.text)}</span>
    ${translation && settings.showTranslations ? `<span class="yll-overlay-translation">${escapeHtml(translation)}</span>` : ""}
  `;
  overlay.classList.add("is-visible");
}

function renderRows(rows: LabCue[]) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;

  const settings = loadSafeSettings();
  list.classList.toggle("hide-translations", !settings.showTranslations);
  const sorted = [...rows].sort((a, b) => b.startMs - a.startMs);
  list.innerHTML = sorted
    .map((cue) => {
      const key = cueKey(cue);
      const activeClass = key === runtime.__yllSafeActiveKey ? " is-active" : "";
      return `
        <div class="yll-row${activeClass}" role="button" tabindex="0" data-start="${cue.startMs}" data-key="${escapeHtml(key)}">
          <span class="yll-time">${formatClock(cue.startMs)}</span>
          <span>
            <span class="yll-text">${renderClickableText(cue.text)}</span>
            ${cue.translatedText ? `<span class="yll-translation">${escapeHtml(cue.translatedText)}</span>` : ""}
          </span>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll<HTMLElement>(".yll-row[data-start]").forEach((button) => {
    const activateRow = () => {
      const video = getMainVideo();
      if (!video) return;
      video.currentTime = Number(button.dataset.start ?? "0") / 1000;
      void video.play();
    };
    button.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const wordElement = target?.closest<HTMLElement>(".yll-word");
      if (wordElement?.dataset.word) {
        event.preventDefault();
        event.stopPropagation();
        void lookupWord(wordElement.dataset.word, button.dataset.start);
        return;
      }
      activateRow();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activateRow();
    });
  });
}

function updateActiveCue() {
  const rows = runtime.__yllSafeRows ?? [];
  const video = getMainVideo();
  const list = document.getElementById(LIST_ID);
  if (!rows.length || !video || !list) return;

  const currentMs = (video.currentTime * 1000) + DEFAULT_DISPLAY_LEAD_MS;
  const sortedRows = [...rows].sort((a, b) => a.startMs - b.startMs);
  const active =
    sortedRows.find((cue, index) => {
      const nextStartMs = sortedRows[index + 1]?.startMs ?? Number.POSITIVE_INFINITY;
      const holdUntilMs = Math.min(
        cue.startMs + Math.max(cue.durationMs, MIN_OVERLAY_DURATION_MS),
        nextStartMs + 350
      );
      return currentMs >= cue.startMs - 250 && currentMs <= holdUntilMs;
    }) ??
    [...sortedRows].reverse().find((cue) => cue.startMs <= currentMs);
  if (!active) {
    setOverlayCue(undefined);
    return;
  }

  const nextKey = cueKey(active);
  if (active.source === "visible" && !runtime.__yllSafeCanUseVisibleFallback) {
    setOverlayCue(undefined);
  } else {
    setOverlayCue(active);
  }
  if (nextKey === runtime.__yllSafeActiveKey) return;
  runtime.__yllSafeActiveKey = nextKey;

  list.querySelectorAll(".yll-row.is-active").forEach((element) => element.classList.remove("is-active"));
  const activeRow = list.querySelector<HTMLElement>(`.yll-row[data-key="${CSS.escape(nextKey)}"]`);
  activeRow?.classList.add("is-active");
  if (activeRow) {
    const rowTop = activeRow.offsetTop;
    const rowCenter = rowTop + activeRow.offsetHeight / 2;
    const targetTop = Math.max(0, rowCenter - list.clientHeight * 0.24);
    if (Math.abs(list.scrollTop - targetTop) > 12) {
      list.scrollTo({ top: targetTop, behavior: "auto" });
    }
  }
}

function saveRows(rows: LabCue[], sourceLabel: string) {
  const unique = new Map<string, LabCue>();
  const existingTranslations = new Map(
    (runtime.__yllSafeRows ?? [])
      .filter((cue) => cue.translatedText)
      .map((cue) => [translationKey(cue), { translatedText: cue.translatedText, translationProvider: cue.translationProvider }])
  );
  for (const cue of rows) {
    if (!cue.text) continue;
    const compactCue = { ...cue, text: compactRepeatedPhrases(cue.text) };
    const translated = existingTranslations.get(translationKey(compactCue));
    if (translated?.translatedText) {
      compactCue.translatedText = translated.translatedText;
      compactCue.translationProvider = translated.translationProvider;
    }
    const key = dedupeKey(compactCue);
    const existing = unique.get(key);
    unique.set(key, existing && existing.text.length >= compactCue.text.length ? existing : compactCue);
  }
  const sortedUnique = Array.from(unique.values()).sort((a, b) => a.startMs - b.startMs);
  runtime.__yllSafeRows = sortedUnique.filter((cue, index, all) => {
    const previous = all[index - 1];
    if (!previous) return true;
    const sameText = normalizeForCompare(previous.text) === normalizeForCompare(cue.text);
    const nearby = Math.abs(cue.startMs - previous.startMs) < 3000;
    return !(sameText && nearby);
  });
  if (runtime.__yllSafeRows.some((cue) => cue.source !== "visible")) {
    runtime.__yllSafeLoadedVideoId = getVideoId() || runtime.__yllSafeLoadedVideoId;
    runtime.__yllSafeCanUseVisibleFallback = false;
  }
  applySafeSettings();
  renderRows(runtime.__yllSafeRows);
  setStatus(`已加载 ${runtime.__yllSafeRows.length} 条字幕，来源：${sourceLabel}。`);
  updateActiveCue();
  void translateRowsForCurrentVideo(sourceLabel);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "未知错误";
}

function parsePlayerResponseFromScripts() {
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent ?? "";
    if (!text.includes("ytInitialPlayerResponse")) continue;
    const json = extractJsonObjectAfterMarker(text, "ytInitialPlayerResponse");
    if (!json) continue;
    try {
      return JSON.parse(json) as PlayerResponse;
    } catch {
      continue;
    }
  }
  return undefined;
}

function extractJsonObjectAfterMarker(text: string, marker: string) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return undefined;
  const equalsIndex = text.indexOf("=", markerIndex);
  const start = text.indexOf("{", equalsIndex >= 0 ? equalsIndex : markerIndex);
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

async function fetchPlayerResponseFromPage() {
  try {
    const response = await fetch(location.href, { credentials: "include", cache: "no-store" });
    if (!response.ok) return undefined;
    const html = await response.text();
    const json = extractJsonObjectAfterMarker(html, "ytInitialPlayerResponse");
    if (!json) return undefined;
    return JSON.parse(json) as PlayerResponse;
  } catch {
    return undefined;
  }
}

function getTrackName(track: RawCaptionTrack) {
  if (typeof track.name === "string") return track.name;
  return track.name?.simpleText ?? track.name?.runs?.map((run) => run.text ?? "").join("") ?? "";
}

function trackPriority(track: RawCaptionTrack) {
  const language = track.languageCode ?? track.language_code ?? "";
  const url = track.baseUrl ?? track.base_url ?? track.url ?? "";
  const isEnglish = language.startsWith("en") ? 0 : 100;
  const isGenerated = track.kind === "asr" ? 5 : 0;
  const requiresPoToken = url.includes("exp=xpe") ? 12 : 0;
  return requiresPoToken + isEnglish + isGenerated;
}

function captionUrlRequiresPoToken(url: URL | string) {
  return String(url).includes("exp=xpe");
}

function orderedTracks(tracks: RawCaptionTrack[]) {
  return [...tracks].sort((a, b) => trackPriority(a) - trackPriority(b));
}

function trackLanguage(track: RawCaptionTrack) {
  return track.languageCode ?? track.language_code ?? "";
}

function recentTimedTextUrls(videoId: string) {
  return performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.hostname.endsWith("youtube.com") &&
          parsed.pathname.includes("/api/timedtext") &&
          parsed.searchParams.get("v") === videoId;
      } catch {
        return false;
      }
    })
    .filter((url, index, all) => all.indexOf(url) === index)
    .reverse();
}

async function waitForTimedTextUrl(videoId: string, previousUrls: Set<string>, timeoutMs = 5500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const match = recentTimedTextUrls(videoId).find((url) => !previousUrls.has(url));
    if (match) return match;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return recentTimedTextUrls(videoId).find((url) => !previousUrls.has(url));
}

function capturedTimedTextForVideo(videoId: string) {
  return (runtime.__yllCapturedTimedText ?? [])
    .filter((item) => {
      try {
        const parsed = new URL(item.url);
        return parsed.pathname.includes("/api/timedtext") && parsed.searchParams.get("v") === videoId;
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.capturedAt - a.capturedAt);
}

async function waitForCapturedTimedText(videoId: string, previousUrls: Set<string>, timeoutMs = 5500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const match = capturedTimedTextForVideo(videoId).find((item) => !previousUrls.has(item.url) && item.body.trim());
    if (match) return match;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return capturedTimedTextForVideo(videoId).find((item) => !previousUrls.has(item.url) && item.body.trim());
}

function loadRowsFromCapturedTimedText(videoId: string) {
  const failures: string[] = [];
  for (const item of capturedTimedTextForVideo(videoId)) {
    if (!item.body.trim()) continue;
    try {
      const rows = parseCaptionBody(videoId, item.body, "official").filter((cue) => cue.text && videoId);
      if (rows.length) return mergeAdjacentCues(rows);
      failures.push(`body=${item.body.length} parsed=0 status=${item.status}`);
    } catch (error) {
      failures.push(toErrorMessage(error));
    }
  }
  throw new Error(`capturedTimedText=0 usable; ${failures.slice(0, 2).join(" | ")}`);
}

function getMoviePlayer() {
  return document.getElementById("movie_player") as
    | (HTMLElement & {
        setOption?: (section: string, key: string, value: unknown) => void;
        getOption?: (section: string, key: string) => unknown;
      })
    | null;
}

async function loadRowsViaPlayerRequest(videoId: string, tracks: RawCaptionTrack[]) {
  const player = getMoviePlayer();
  if (!player?.setOption || !tracks.length) {
    throw new Error("player caption loader unavailable");
  }

  await ensureTimedTextBridge();

  const track = orderedTracks(tracks).find((item) => trackLanguage(item).startsWith("en")) ?? orderedTracks(tracks)[0];
  const previousUrls = new Set(recentTimedTextUrls(videoId));
  const previousCapturedUrls = new Set(capturedTimedTextForVideo(videoId).map((item) => item.url));
  document.documentElement.classList.add("yll-hide-native-captions");

  try {
    player.setOption("captions", "track", track);
  } catch {
    try {
      player.setOption("captions", "reload", true);
    } catch {
      // Continue: YouTube may still load captions through existing player state.
    }
  }

  const captured = await waitForCapturedTimedText(videoId, previousCapturedUrls);
  const url = captured?.url ?? await waitForTimedTextUrl(videoId, previousUrls);
  if (!url) throw new Error("player did not request timedtext");

  const parsed = new URL(url);
  if (!parsed.searchParams.get("fmt")) parsed.searchParams.set("fmt", "json3");
  const body = captured?.body.trim() ? captured.body : await fetchCaptionText(parsed.toString());
  const rows = parseCaptionBody(videoId, body, "official").filter((cue) => cue.text && videoId);
  if (!rows.length) throw new Error(`player timedtext body=${body.length} parsed=0 captured=${Boolean(captured)}`);
  return mergeAdjacentCues(rows);
}

async function sendRuntimeMessage<T>(message: { type: string; payload?: unknown }) {
  if (!chrome?.runtime?.sendMessage) return undefined;
  return new Promise<RuntimeResponse<T> | undefined>((resolve) => {
    chrome.runtime.sendMessage(message, (response: RuntimeResponse<T> | undefined) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message ?? "Runtime message failed" });
        return;
      }
      resolve(response);
    });
  });
}

function createVideoContext(videoId: string) {
  const video = getMainVideo();
  return {
    videoId,
    url: location.href,
    title: document.title.replace(/\s+-\s+YouTube$/, ""),
    durationSeconds: video?.duration && Number.isFinite(video.duration) ? Math.round(video.duration) : undefined
  };
}

function cueForTranslation(cue: LabCue, videoId: string, idPrefix = "cue") {
  return {
    id: `${idPrefix}-${Math.round(cue.startMs)}-${Math.abs(hashString(cue.text))}`,
    videoId,
    startMs: cue.startMs,
    durationMs: cue.durationMs,
    text: cue.text,
    sourceLanguage: "en"
  };
}

function hashString(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

async function translateCueBatch(videoId: string, cues: LabCue[]) {
  const response = await sendRuntimeMessage<Array<{ id: string; translatedText?: string; provider?: string }>>({
    type: "TRANSLATE_CUES",
    payload: {
      videoContext: createVideoContext(videoId),
      targetLanguage: TARGET_LANGUAGE,
      cues: cues.map((cue) => cueForTranslation(cue, videoId))
    }
  });
  if (!response?.ok) throw new Error(response?.error ?? "翻译请求没有返回结果");
  return response.data;
}

async function translateRowsForCurrentVideo(sourceLabel: string) {
  const videoId = getVideoId();
  const rows = runtime.__yllSafeRows ?? [];
  if (!videoId || !rows.length) return;
  if (runtime.__yllSafeIsTranslating) return;
  if (runtime.__yllSafeTranslatedVideoId === videoId && rows.every((row) => row.translatedText)) return;

  const token = Date.now();
  runtime.__yllSafeTranslationToken = token;
  runtime.__yllSafeTranslatedVideoId = videoId;
  runtime.__yllSafeIsTranslating = true;
  const translatable = rows.filter((row) => !row.translatedText);
  if (!translatable.length) {
    runtime.__yllSafeIsTranslating = false;
    return;
  }

  try {
    setStatus(`已加载 ${rows.length} 条字幕，来源：${sourceLabel}；正在生成中文译文...`);
    const translatedByKey = new Map<string, { translatedText?: string; provider?: string }>();
    for (let index = 0; index < translatable.length; index += TRANSLATION_BATCH_SIZE) {
      if (runtime.__yllSafeTranslationToken !== token || getVideoId() !== videoId) return;
      const batch = translatable.slice(index, index + TRANSLATION_BATCH_SIZE);
      try {
        const translated = await translateCueBatch(videoId, batch);
        translated.forEach((item, itemIndex) => {
          const sourceCue = batch[itemIndex];
          if (!sourceCue) return;
          translatedByKey.set(translationKey(sourceCue), {
            translatedText: item.translatedText,
            provider: item.provider
          });
        });
      } catch (error) {
        setStatus(`已加载 ${rows.length} 条字幕；免费翻译暂时不可用：${toErrorMessage(error)}`);
        break;
      }

      runtime.__yllSafeRows = (runtime.__yllSafeRows ?? []).map((row) => {
        const translated = translatedByKey.get(translationKey(row));
        if (!translated?.translatedText) return row;
        return {
          ...row,
          translatedText: translated.translatedText,
          translationProvider: translated.provider === "ai" || translated.provider === "youtube" || translated.provider === "web" ? translated.provider : "none"
        };
      });
      renderRows(runtime.__yllSafeRows);
      updateActiveCue();
      setStatus(`已加载 ${runtime.__yllSafeRows.length} 条字幕，来源：${sourceLabel}；译文同步中 ${Math.min(index + TRANSLATION_BATCH_SIZE, translatable.length)}/${translatable.length}`);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    if (runtime.__yllSafeTranslationToken === token && getVideoId() === videoId) {
      setStatus(`已加载 ${runtime.__yllSafeRows?.length ?? rows.length} 条字幕，来源：${sourceLabel}；中文译文已生成。`);
    }
  } finally {
    if (runtime.__yllSafeTranslationToken === token) runtime.__yllSafeIsTranslating = false;
  }
}

async function lookupWord(word: string, startMs?: string) {
  const cleaned = cleanText(word).slice(0, 48);
  if (!cleaned) return;
  showWordPopover(cleaned, "正在查询...");
  const videoId = getVideoId() || "current";
  const cue: LabCue = {
    startMs: Number(startMs ?? "0"),
    durationMs: 1200,
    text: cleaned,
    source: "official"
  };
  try {
    const translated = await translateCueBatch(videoId, [cue]);
    const translatedText = translated[0]?.translatedText;
    showWordPopover(cleaned, translatedText || "暂时没有查到译文。");
  } catch (error) {
    showWordPopover(cleaned, `查词失败：${toErrorMessage(error)}`);
  }
}

async function readPlayerSnapshotViaBackground() {
  const response = await sendRuntimeMessage<PlayerSnapshot>({ type: "READ_PAGE_PLAYER_RESPONSE" });
  return response?.ok ? response.data : undefined;
}

async function fetchCaptionTextViaBackground(url: string) {
  const response = await sendRuntimeMessage<CaptionFetchResult>({
    type: "FETCH_CAPTION_TEXT",
    payload: { url }
  });
  if (!response?.ok) throw new Error(response?.error ?? "字幕代理请求没有返回结果");
  return response.data;
}

async function fetchCaptionTextViaMainWorld(url: string) {
  const response = await sendRuntimeMessage<CaptionFetchResult>({
    type: "FETCH_CAPTION_TEXT_MAIN",
    payload: { url }
  });
  if (!response?.ok) throw new Error(response?.error ?? "字幕主世界请求没有返回结果");
  return response.data;
}

function looksLikeHtmlOrEmpty(result: CaptionFetchResult) {
  const body = result.body.trim();
  const contentType = result.contentType ?? "";
  return !body || contentType.includes("text/html") || body.toLowerCase().startsWith("<!doctype html") || body.toLowerCase().startsWith("<html");
}

async function fetchCaptionText(url: string) {
  let backgroundError = "";
  try {
    const result = await fetchCaptionTextViaBackground(url);
    if (!looksLikeHtmlOrEmpty(result)) return result.body;
    backgroundError = `background status=${result.status} body=${result.body.length} type=${result.contentType ?? ""}`;
  } catch (error) {
    backgroundError = toErrorMessage(error);
  }

  try {
    const result = await fetchCaptionTextViaMainWorld(url);
    if (!looksLikeHtmlOrEmpty(result)) return result.body;
    throw new Error(`main status=${result.status} body=${result.body.length} type=${result.contentType ?? ""}`);
  } catch (error) {
    throw new Error(`字幕请求无有效正文；background=${backgroundError}; main=${toErrorMessage(error)}`);
  }
}

async function fetchYoutubeiPlayerViaBackground(videoId: string, snapshot?: PlayerSnapshot) {
  const response = await sendRuntimeMessage<PlayerResponse>({
    type: "FETCH_YOUTUBEI_PLAYER",
    payload: {
      videoId,
      innertubeApiKey: snapshot?.innertubeApiKey,
      innertubeClientVersion: snapshot?.innertubeClientVersion,
      visitorData: snapshot?.visitorData
    }
  });
  if (!response?.ok) throw new Error(response?.error ?? "youtubei 代理请求没有返回结果");
  return response.data;
}

async function fetchYoutubeiTranscriptViaBackground(params: string, snapshot?: PlayerSnapshot) {
  const response = await sendRuntimeMessage<unknown>({
    type: "FETCH_YOUTUBEI_TRANSCRIPT",
    payload: {
      params,
      innertubeApiKey: snapshot?.innertubeApiKey,
      innertubeClientVersion: snapshot?.innertubeClientVersion,
      visitorData: snapshot?.visitorData
    }
  });
  if (!response?.ok) throw new Error(response?.error ?? "youtubei transcript 代理请求没有返回结果");
  return response.data;
}

function uniqueTracks(tracks: RawCaptionTrack[]) {
  return tracks.filter((track, index, all) => {
    const url = track.baseUrl ?? track.base_url ?? track.url;
    return Boolean(url) && all.findIndex((candidate) => (candidate.baseUrl ?? candidate.base_url ?? candidate.url) === url) === index;
  });
}

async function readPlayerResponseViaYoutubei(videoId: string, snapshot?: PlayerSnapshot) {
  try {
    const backgroundResponse = await fetchYoutubeiPlayerViaBackground(videoId, snapshot);
    if (backgroundResponse) return backgroundResponse;
  } catch (error) {
    runtime.__yllSafeLastFailure = `youtubei-bg: ${toErrorMessage(error)}`;
  }

  const clientVersion =
    snapshot?.innertubeClientVersion ||
    (typeof runtime.ytcfg?.get === "function" ? String(runtime.ytcfg.get("INNERTUBE_CLIENT_VERSION") ?? "") : "") ||
    "2.20240501.00.00";
  const visitorData = snapshot?.visitorData || (typeof runtime.ytcfg?.get === "function" ? String(runtime.ytcfg.get("VISITOR_DATA") ?? "") : "");
  const apiKey = snapshot?.innertubeApiKey || (typeof runtime.ytcfg?.get === "function" ? String(runtime.ytcfg.get("INNERTUBE_API_KEY") ?? "") : "");
  const payload = {
    context: {
      client: {
        clientName: "WEB",
        clientVersion,
        visitorData
      }
    },
    videoId,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: "HTML5_PREF_WANTS"
      }
    },
    contentCheckOk: true,
    racyCheckOk: true
  };

  const endpoint = new URL("https://www.youtube.com/youtubei/v1/player");
  endpoint.searchParams.set("prettyPrint", "false");
  if (apiKey) endpoint.searchParams.set("key", apiKey);
  const response = await fetch(endpoint.toString(), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`youtubei player HTTP ${response.status}`);
  return response.json() as Promise<PlayerResponse>;
}

function tracksFromPlayerResponse(playerResponse?: PlayerResponse) {
  return playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

function parseInitialDataFromScripts() {
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent ?? "";
    if (!text.includes("ytInitialData")) continue;
    const json = extractJsonObjectAfterMarker(text, "ytInitialData");
    if (!json) continue;
    try {
      return JSON.parse(json) as unknown;
    } catch {
      continue;
    }
  }
  return undefined;
}

function extractTranscriptParams(value: unknown, maxDepth = 8) {
  const seen = new WeakSet<object>();
  const found = new Set<string>();

  const visit = (current: unknown, depth: number) => {
    if (depth > maxDepth || !current || typeof current !== "object") return;
    const objectValue = current as Record<string, unknown>;
    if (seen.has(objectValue)) return;
    seen.add(objectValue);

    const endpoint = objectValue.getTranscriptEndpoint;
    if (endpoint && typeof endpoint === "object") {
      const params = (endpoint as Record<string, unknown>).params;
      if (typeof params === "string" && params) found.add(params);
    }

    if (Array.isArray(current)) {
      current.slice(0, 160).forEach((item) => visit(item, depth + 1));
      return;
    }

    Object.entries(objectValue).forEach(([key, child]) => {
      if (key.toLowerCase().includes("transcript") || key === "engagementPanels" || depth < 3) {
        visit(child, depth + 1);
      }
    });
  };

  visit(value, 0);
  return Array.from(found);
}

function textFromRuns(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const objectValue = value as Record<string, unknown>;
  const directText = objectValue.text;
  if (typeof directText === "string") return directText;
  const simpleText = objectValue.simpleText;
  if (typeof simpleText === "string") return simpleText;
  const runs = objectValue.runs;
  if (Array.isArray(runs)) {
    return runs.map((run) => typeof run === "object" && run ? String((run as Record<string, unknown>).text ?? "") : "").join("");
  }
  return "";
}

function objectField(value: unknown, key: string) {
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function parseTranscriptRows(videoId: string, response: unknown) {
  const seen = new WeakSet<object>();
  const rows: LabCue[] = [];

  const visit = (current: unknown, depth = 0) => {
    if (depth > 18 || !current || typeof current !== "object") return;
    const objectValue = current as Record<string, unknown>;
    if (seen.has(objectValue)) return;
    seen.add(objectValue);

    const segment = objectValue.transcriptSegmentRenderer;
    if (segment && typeof segment === "object") {
      const segmentValue = segment as Record<string, unknown>;
      const startMs = Number(segmentValue.startMs ?? segmentValue.start_ms);
      const endMs = Number(segmentValue.endMs ?? segmentValue.end_ms);
      const text = cleanText(
        textFromRuns(segmentValue.snippet) ||
        textFromRuns(segmentValue.snippetText) ||
        textFromRuns(objectField(segmentValue.accessibility, "accessibilityData"))
      );
      if (text && Number.isFinite(startMs)) {
        rows.push({
          startMs: Math.max(0, Math.round(startMs)),
          durationMs: Math.max(500, Number.isFinite(endMs) ? Math.round(endMs - startMs) : 1800),
          text,
          source: "transcript"
        });
      }
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, depth + 1));
      return;
    }

    Object.values(objectValue).forEach((child) => visit(child, depth + 1));
  };

  visit(response);
  return mergeAdjacentCues(rows)
    .sort((a, b) => a.startMs - b.startMs)
    .filter((cue) => cue.text && videoId);
}

async function loadTranscriptRows(videoId: string, snapshot?: PlayerSnapshot, playerResponse?: PlayerResponse) {
  const paramsList = [
    ...(snapshot?.transcriptParams ?? []),
    ...extractTranscriptParams(playerResponse),
    ...extractTranscriptParams(parseInitialDataFromScripts())
  ].filter((params, index, all) => params && all.indexOf(params) === index);

  const failures: string[] = [];
  for (const params of paramsList) {
    try {
      const response = await fetchYoutubeiTranscriptViaBackground(params, snapshot);
      const rows = parseTranscriptRows(videoId, response);
      if (rows.length) return rows;
      failures.push("parsed=0");
    } catch (error) {
      failures.push(toErrorMessage(error));
    }
  }

  throw new Error(`transcriptParams=${paramsList.length}; ${failures.slice(0, 3).join(" | ") || "no transcript endpoint"}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function deepElements(root: ParentNode, limit = 1800): Element[] {
  const output: Element[] = [];
  const stack: Array<ParentNode | Element | ShadowRoot> = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node instanceof Element) {
      output.push(node);
      if (output.length >= limit) break;
      if (node.shadowRoot) stack.push(node.shadowRoot);
    }
    const children = "children" in node ? Array.from(node.children) : [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }
  return output;
}

function parseTranscriptTimestamp(text?: string | null) {
  const value = String(text ?? "").trim();
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
  if (!match) return undefined;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] === undefined ? undefined : Number(match[3]);
  if (![first, second, third ?? 0].every(Number.isFinite)) return undefined;
  return third === undefined ? (first * 60 + second) * 1000 : (first * 3600 + second * 60 + third) * 1000;
}

function stripTranscriptTimestamp(text: string, timestamp?: string | null) {
  let value = cleanText(text);
  const ts = cleanText(timestamp ?? "");
  if (ts && value.startsWith(ts)) value = value.slice(ts.length).trim();
  return value.replace(/^\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*/, "").trim();
}

function transcriptPanelRoot() {
  const selectors = [
    "ytd-transcript-search-panel-renderer",
    "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-searchable-transcript']",
    "#engagement-panel-searchable-transcript",
    "ytd-transcript-renderer"
  ];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) return element;
  }
  return Array.from(document.querySelectorAll<HTMLElement>(
    "#panels ytd-engagement-panel-section-list-renderer, ytd-engagement-panel-section-list-renderer, ytd-transcript-search-panel-renderer, ytd-transcript-renderer"
  )).find((element) => {
    const tag = element.tagName.toLowerCase();
    const targetId = element.getAttribute("target-id")?.toLowerCase() ?? "";
    return targetId.includes("transcript") || (tag.startsWith("ytd-") && tag.includes("transcript"));
  });
}

function textLooksLikeTranscriptAction(text: string) {
  const value = text.toLowerCase();
  return (
    value.includes("transcript") ||
    value.includes("show transcript") ||
    value.includes("字幕") ||
    value.includes("转录") ||
    value.includes("转写") ||
    value.includes("文字稿") ||
    value.includes("内容转文字")
  );
}

function clickableTranscriptTarget(element?: Element | null) {
  if (!element) return undefined;
  return element.querySelector<HTMLElement>("button, ytd-button-renderer, tp-yt-paper-button") ?? (element as HTMLElement);
}

function parseTranscriptRow(row: Element) {
  const timestampElement =
    row.querySelector<HTMLElement>(".segment-timestamp") ??
    row.querySelector<HTMLElement>("[class*='segment-timestamp']") ??
    row.querySelector<HTMLElement>("button");
  const timestampText =
    cleanText(timestampElement?.textContent ?? "") ||
    cleanText(timestampElement?.getAttribute("aria-label") ?? "") ||
    cleanText(row.textContent ?? "").match(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\b/)?.[0];
  const startMs = parseTranscriptTimestamp(timestampText);
  if (startMs === undefined) return undefined;

  const textElement =
    row.querySelector<HTMLElement>(".segment-text") ??
    row.querySelector<HTMLElement>("yt-formatted-string.segment-text") ??
    row.querySelector<HTMLElement>("[class*='segment-text']");
  const ariaText = cleanText(textElement?.getAttribute("aria-label") ?? row.getAttribute("aria-label") ?? "");
  const rawText = ariaText || cleanText(textElement?.textContent ?? row.textContent ?? "");
  const text = compactRepeatedPhrases(stripTranscriptTimestamp(rawText, timestampText));
  if (!text || parseTranscriptTimestamp(text) !== undefined) return undefined;
  return { startMs, text };
}

function transcriptRowsFromDom(videoId: string) {
  const roots = [transcriptPanelRoot(), document.querySelector<HTMLElement>("#panels")]
    .filter((root, index, all): root is HTMLElement => Boolean(root) && all.indexOf(root) === index);
  const rows: Array<{ startMs: number; text: string }> = [];
  const seen = new Set<string>();

  for (const root of roots) {
    const segmentRows = deepElements(root, 3200).filter((element) => {
      const tag = element.tagName.toLowerCase();
      const inTranscriptRegion =
        tag.includes("transcript") ||
        Boolean(element.closest("ytd-transcript-search-panel-renderer, ytd-transcript-renderer, [target-id*='transcript'], #engagement-panel-searchable-transcript"));
      return inTranscriptRegion && (
        tag === "ytd-transcript-segment-renderer" ||
        tag === "transcript-segment-view-model" ||
        element.getAttribute("role") === "listitem"
      );
    });
    for (const row of segmentRows) {
      const parsed = parseTranscriptRow(row);
      if (!parsed) continue;
      const key = `${parsed.startMs}:${normalizeForCompare(parsed.text)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(parsed);
    }
  }

  const sorted = rows.sort((a, b) => a.startMs - b.startMs);
  return sorted.map((row, index): LabCue => {
    const next = sorted[index + 1];
    return {
      startMs: row.startMs,
      durationMs: Math.max(800, next ? next.startMs - row.startMs : 2200),
      text: row.text,
      source: "transcript-panel"
    };
  }).filter((cue) => cue.text && videoId);
}

async function scrollTranscriptPanel() {
  const root = transcriptPanelRoot();
  const containers = [
    root?.querySelector<HTMLElement>("#segments-container"),
    root?.querySelector<HTMLElement>("#content"),
    root
  ].filter(Boolean) as HTMLElement[];

  for (const container of containers.slice(0, 2)) {
    let lastHeight = -1;
    for (let index = 0; index < 8; index += 1) {
      container.scrollTop = container.scrollHeight;
      await sleep(120);
      if (container.scrollHeight === lastHeight) break;
      lastHeight = container.scrollHeight;
    }
    container.scrollTop = 0;
  }
}

async function openTranscriptPanel() {
  const clickIfFound = async (element?: Element | null) => {
    if (!element) return false;
    clickableTranscriptTarget(element)?.click();
    await sleep(500);
    return transcriptRowsFromDom(getVideoId()).length > 0 || Boolean(transcriptPanelRoot());
  };

  if (transcriptRowsFromDom(getVideoId()).length > 0) return true;

  const expand =
    document.querySelector("#expand") ??
    document.querySelector("tp-yt-paper-button#expand") ??
    Array.from(document.querySelectorAll<HTMLElement>("button")).find((button) => /show more|更多|展开/i.test(button.textContent ?? button.getAttribute("aria-label") ?? ""));
  if (expand) {
    (expand as HTMLElement).click();
    await sleep(300);
  }

  if (await clickIfFound(document.querySelector("ytd-video-description-transcript-section-renderer"))) return true;

  const transcriptButton = Array.from(document.querySelectorAll<HTMLElement>(
    "button, tp-yt-paper-button, ytd-button-renderer, ytd-video-description-transcript-section-renderer"
  )).find((element) => {
    const tag = element.tagName.toLowerCase();
    if (!["button", "tp-yt-paper-button", "ytd-button-renderer", "ytd-video-description-transcript-section-renderer"].includes(tag)) return false;
    const text = `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""}`.toLowerCase();
    return textLooksLikeTranscriptAction(text);
  });
  if (await clickIfFound(transcriptButton)) return true;

  const moreButton = Array.from(document.querySelectorAll<HTMLElement>("button")).find((button) => {
    const label = `${button.textContent ?? ""} ${button.getAttribute("aria-label") ?? ""}`.toLowerCase();
    return label.includes("more actions") || label.includes("更多");
  });
  if (moreButton) {
    moreButton.click();
    await sleep(350);
  }

  const transcriptMenuItem = Array.from(document.querySelectorAll<HTMLElement>("ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item"))
    .find((element) => {
      const text = (element.textContent ?? "").toLowerCase();
      const html = element.outerHTML ?? "";
      return textLooksLikeTranscriptAction(text) || html.includes("getTranscriptEndpoint") || html.includes("searchable-transcript");
    });
  return clickIfFound(transcriptMenuItem);
}

function closeTranscriptPanel() {
  const root = transcriptPanelRoot();
  if (!root) return;
  const panel =
    root.closest<HTMLElement>("ytd-engagement-panel-section-list-renderer") ??
    root.closest<HTMLElement>("#engagement-panel-searchable-transcript") ??
    root;
  const closeButton = Array.from(panel.querySelectorAll<HTMLElement>("button, yt-icon-button"))
    .find((element) => {
      const label = `${element.textContent ?? ""} ${element.getAttribute("aria-label") ?? ""} ${element.title ?? ""}`.toLowerCase();
      return label.includes("close") || label.includes("hide") || label.includes("关闭") || label.includes("隐藏");
    });
  closeButton?.click();
}

async function loadRowsFromTranscriptPanel(videoId: string) {
  try {
    await openTranscriptPanel();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await scrollTranscriptPanel();
      const rows = transcriptRowsFromDom(videoId);
      if (rows.length >= 3) return mergeAdjacentCues(rows);
      if (attempt === 4 || attempt === 8) await openTranscriptPanel();
      await sleep(350);
    }
    const rows = transcriptRowsFromDom(videoId);
    if (rows.length) return mergeAdjacentCues(rows);
    throw new Error("transcript panel parsed=0");
  } finally {
    closeTranscriptPanel();
  }
}

function parseCaptionBody(videoId: string, body: string, source: LabCue["source"]) {
  try {
    const data = JSON.parse(body) as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> };
    const rows = parseJson3Rows(videoId, data, source);
    if (rows.length) return rows;
  } catch {
    // Fall through to XML parsing.
  }

  const documentValue = new DOMParser().parseFromString(body, "text/xml");
  const textNodes = Array.from(documentValue.querySelectorAll("text"));
  return textNodes
    .map((node) => {
      const startSeconds = Number(node.getAttribute("start") ?? "0");
      const durationSeconds = Number(node.getAttribute("dur") ?? "1.8");
      const text = cleanText(node.textContent ?? "");
      if (!text || Number.isNaN(startSeconds)) return undefined;
      return {
        startMs: Math.max(0, Math.round(startSeconds * 1000)),
        durationMs: Math.max(500, Math.round((Number.isNaN(durationSeconds) ? 1.8 : durationSeconds) * 1000)),
        text,
        source
      };
    })
    .filter(Boolean) as LabCue[];
}

async function loadRowsFromTracks(videoId: string, tracks: RawCaptionTrack[], source: LabCue["source"]) {
  addDebugLog("tracks:start", { source, tracks: tracks.length });
  if (!tracks.length) {
    throw new Error(`${source}: captionTracks=0`);
  }

  const failures: string[] = [];
  for (const track of orderedTracks(tracks)) {
    const baseUrl = track.baseUrl ?? track.base_url ?? track.url;
    if (!baseUrl) continue;

    const url = new URL(baseUrl, location.href);
    if (!url.searchParams.get("fmt")) url.searchParams.set("fmt", "json3");
    const language = track.languageCode ?? track.language_code ?? getTrackName(track) ?? "unknown";
    try {
      addDebugLog("tracks:fetch", { source, language, host: url.hostname, token: captionUrlRequiresPoToken(url) });
      const body = await fetchCaptionText(url.toString());
      const rows = parseCaptionBody(videoId, body, source).filter((cue) => cue.text && videoId && language);
      addDebugLog("tracks:parsed", { source, language, body: body.length, rows: rows.length });
      if (rows.length) return mergeAdjacentCues(rows);
      const tokenHint = captionUrlRequiresPoToken(url) && !body.trim() ? " token-gated exp=xpe" : "";
      failures.push(`${language}: body=${body.length} parsed=0 host=${url.hostname}${tokenHint}`);
    } catch (error) {
      const tokenHint = captionUrlRequiresPoToken(url) ? " token-gated exp=xpe;" : "";
      failures.push(`${language}:${tokenHint} ${toErrorMessage(error)}`);
    }
  }

  throw new Error(`${source}: tracks=${tracks.length}; ${failures.slice(0, 3).join(" | ") || "no usable baseUrl"}`);
}

async function loadOfficialRows(videoId: string, options: { includeSlowPaths?: boolean } = {}) {
  addDebugLog("official:start", { videoId, includeSlowPaths: Boolean(options.includeSlowPaths) });
  const snapshot = await readPlayerSnapshotViaBackground();
  const playerResponse = snapshot?.playerResponse ?? parsePlayerResponseFromScripts() ?? await fetchPlayerResponseFromPage();
  const tracks = uniqueTracks([
    ...(snapshot?.captionTracks ?? []),
    ...tracksFromPlayerResponse(playerResponse)
  ]);
  addDebugLog("official:snapshot", {
    snapshotTracks: snapshot?.captionTracks?.length ?? 0,
    playerTracks: tracksFromPlayerResponse(playerResponse).length,
    mergedTracks: tracks.length,
    transcriptParams: snapshot?.transcriptParams?.length ?? 0
  });
  try {
    const capturedRows = loadRowsFromCapturedTimedText(videoId);
    addDebugLog("official:captured-success", { rows: capturedRows.length });
    return capturedRows;
  } catch {
    // Captured timedtext is opportunistic; continue with official APIs.
  }

  try {
    return await loadRowsFromTracks(videoId, tracks, "official");
  } catch (error) {
    runtime.__yllSafeLastFailure = `official: ${toErrorMessage(error)}`;
  }

  try {
    return await loadTranscriptRows(videoId, snapshot, playerResponse);
  } catch (error) {
    runtime.__yllSafeLastFailure = `${runtime.__yllSafeLastFailure ?? "official failed"}; transcript: ${toErrorMessage(error)}`;
  }

  try {
    return loadRowsFromCapturedTimedText(videoId);
  } catch {
    // A late page/player request may have been captured while official APIs were attempted.
  }

  if (options.includeSlowPaths) {
    try {
      return await loadRowsFromTranscriptPanel(videoId);
    } catch (error) {
      runtime.__yllSafeLastFailure = `${runtime.__yllSafeLastFailure ?? "official failed"}; transcriptPanel: ${toErrorMessage(error)}`;
    }

    try {
      return await loadRowsViaPlayerRequest(videoId, uniqueTracks([
        ...(snapshot?.playerCaptionTracks ?? []),
        ...tracks
      ]));
    } catch (error) {
      runtime.__yllSafeLastFailure = `${runtime.__yllSafeLastFailure ?? "official failed"}; playerLoad: ${toErrorMessage(error)}`;
    }
  }

  const youtubeiPlayerResponse = await readPlayerResponseViaYoutubei(videoId, snapshot);
  const youtubeiTracks = uniqueTracks(tracksFromPlayerResponse(youtubeiPlayerResponse));
  try {
    return await loadRowsFromTracks(videoId, youtubeiTracks, "official");
  } catch (error) {
    runtime.__yllSafeLastFailure = `${runtime.__yllSafeLastFailure ?? "official failed"}; youtubeiTracks=${youtubeiTracks.length}; ${toErrorMessage(error)}`;
  }

  try {
    return await loadTranscriptRows(videoId, snapshot, youtubeiPlayerResponse);
  } catch (error) {
    throw new Error(`${runtime.__yllSafeLastFailure ?? "official failed"}; transcript2: ${toErrorMessage(error)}`);
  }
}

function parseJson3Rows(videoId: string, data: { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> }, source: LabCue["source"]) {
  return (data.events ?? [])
    .map((event) => {
      const text = cleanText((event.segs ?? []).map((seg) => seg.utf8 ?? "").join(""));
      if (!text || event.tStartMs === undefined) return undefined;
      return {
        startMs: event.tStartMs,
        durationMs: Math.max(500, event.dDurationMs ?? 1800),
        text,
        source
      };
    })
    .filter(Boolean)
    .map((cue) => cue as LabCue)
    .filter((cue) => cue.text && videoId);
}

async function loadDirectTimedTextRows(videoId: string) {
  const languageCandidates = ["en", "en-US"];
  for (const languageCode of languageCandidates) {
    for (const kind of [undefined, "asr"] as const) {
      const url = new URL("https://www.youtube.com/api/timedtext");
      url.searchParams.set("v", videoId);
      url.searchParams.set("lang", languageCode);
      url.searchParams.set("fmt", "json3");
      if (kind) url.searchParams.set("kind", kind);

      try {
        const text = await fetchCaptionText(url.toString());
        if (!text.trim()) continue;
        const rows = parseCaptionBody(videoId, text, "timedtext");
        if (rows.length) return mergeAdjacentCues(rows);
      } catch {
        continue;
      }
    }
  }
  return [];
}

function readTextTrackRows() {
  const video = getMainVideo();
  if (!video?.textTracks?.length) return [];

  const tracks = Array.from(video.textTracks);
  const target =
    tracks.find((track) => track.language?.startsWith("en") && (track.kind === "captions" || track.kind === "subtitles")) ??
    tracks.find((track) => track.kind === "captions" || track.kind === "subtitles") ??
    tracks[0];
  if (!target) return [];

  tracks.forEach((track) => {
    track.mode = track === target ? "hidden" : "disabled";
  });

  return Array.from(target.cues ?? [])
    .map((cue) => {
      const text = cleanText("text" in cue ? String(cue.text) : "");
      if (!text) return undefined;
      return {
        startMs: Math.max(0, Math.round(cue.startTime * 1000)),
        durationMs: Math.max(500, Math.round((cue.endTime - cue.startTime) * 1000)),
        text,
        source: "text-track" as const
      };
    })
    .filter(Boolean) as LabCue[];
}

function readVisibleCaptionCue(allowHiddenCaptions = false) {
  const isVisible = (element: HTMLElement) => {
    if (allowHiddenCaptions) return element.getBoundingClientRect().width > 0 || Boolean(element.textContent?.trim());
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  };
  const captionRoots = Array.from(document.querySelectorAll<HTMLElement>(".ytp-caption-window-container .caption-window, .caption-window"))
    .filter(isVisible);
  const texts = captionRoots.length
    ? captionRoots.flatMap((root) => {
      const segments = Array.from(root.querySelectorAll<HTMLElement>(".ytp-caption-segment")).filter(isVisible);
      if (segments.length) return [segments.map((segment) => segment.innerText || segment.textContent || "").join(" ")];
      return [root.innerText || root.textContent || ""];
    })
    : [Array.from(document.querySelectorAll<HTMLElement>(".ytp-caption-window-container .ytp-caption-segment, .ytp-caption-segment"))
      .filter(isVisible)
      .map((element) => element.innerText || element.textContent || "")
      .join(" ")];
  const seen = new Set<string>();
  const text = sanitizeVisibleCaptionText(compactRepeatedPhrases(texts
    .map(cleanText)
    .filter((item) => {
      const key = normalizeForCompare(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" ")));

  const video = getMainVideo();
  if (!text || !video) return undefined;
  return {
    startMs: Math.max(0, Math.round(video.currentTime * 1000)),
    durationMs: 1600,
    text,
    source: "visible" as const
  };
}

function sanitizeVisibleCaptionText(text: string) {
  return cleanText(text
    .replace(/(?:English|英语)\s*[（(]\s*(?:auto-generated|自动生成)\s*[）)]\s*(?:Click|点击)?\s*(?:Settings|查看设置)?/gi, " ")
    .replace(/(?:Click|点击)\s*(?:Settings|查看设置)/gi, " ")
    .replace(/(?:English|英语)\s*$/gi, " ")
    .replace(/\s+/g, " "));
}

function ensureNativeCaptionsForFallback() {
  const player = getMoviePlayer();
  try {
    player?.setOption?.("captions", "track", {});
    player?.setOption?.("captions", "reload", true);
  } catch {
    // Continue with the toolbar button fallback.
  }

  const captionButton = document.querySelector<HTMLButtonElement>(".ytp-subtitles-button");
  if (captionButton?.getAttribute("aria-pressed") !== "true") {
    captionButton?.click();
  }
  document.documentElement.classList.add("yll-hide-native-captions");
}

async function loadRowsForCurrentVideo() {
  const videoId = getVideoId();
  if (!videoId || runtime.__yllSafeLoadingVideoId === videoId) return;
  const rows = runtime.__yllSafeRows ?? [];
  const hasOfficialRows = rows.some((cue) => cue.source !== "visible");
  if (runtime.__yllSafeLoadedVideoId === videoId && hasOfficialRows) return;
  const now = Date.now();
  if (!hasOfficialRows && runtime.__yllSafeLastOfficialAttemptAt && now - runtime.__yllSafeLastOfficialAttemptAt < OFFICIAL_RETRY_MS) {
    addDebugLog("load:cooldown", {
      rows: rows.length,
      waitMs: OFFICIAL_RETRY_MS - (now - runtime.__yllSafeLastOfficialAttemptAt)
    });
    return;
  }

  runtime.__yllSafeLoadingVideoId = videoId;
  runtime.__yllSafeIsLoadingOfficial = true;
  runtime.__yllSafeCanUseVisibleFallback = false;
  runtime.__yllSafeLastFailure = undefined;
  runtime.__yllSafeLastOfficialAttemptAt = now;
  runtime.__yllSafeOfficialAttemptCount = (runtime.__yllSafeOfficialAttemptCount ?? 0) + 1;
  runtime.__yllSafeLastOfficialDebug = [];
  addDebugLog("load:start", { videoId, pass: runtime.__yllSafeOfficialAttemptCount, existingRows: rows.length, hasOfficialRows });
  if (!rows.length || hasOfficialRows) {
    runtime.__yllSafeRows = [];
    runtime.__yllSafeActiveKey = undefined;
    renderRows([]);
  }
  if (!rows.some((cue) => cue.source === "visible")) {
    document.documentElement.classList.remove("yll-hide-native-captions");
  }
  setStatus(`正在读取官方字幕轨道... 第 ${runtime.__yllSafeOfficialAttemptCount} 次`);
  await ensureTimedTextBridge().catch((error) => {
    runtime.__yllSafeLastFailure = `bridge: ${toErrorMessage(error)}`;
    runtime.__yllSafeLastOfficialDebug?.push(runtime.__yllSafeLastFailure);
  });

  for (let attempt = 0; attempt < OFFICIAL_AUTO_ATTEMPTS; attempt += 1) {
    setStatus(`正在读取官方字幕轨道... ${attempt + 1}/${OFFICIAL_AUTO_ATTEMPTS}`);
    try {
      addDebugLog("load:official-attempt", { attempt: attempt + 1, max: OFFICIAL_AUTO_ATTEMPTS });
      const officialRows = await withTimeout(loadOfficialRows(videoId), OFFICIAL_ATTEMPT_TIMEOUT_MS, "official auto attempt");
      addDebugLog("load:official-result", { rows: officialRows.length, sources: Array.from(new Set(officialRows.map((row) => row.source))) });
      if (officialRows.length) {
        const sourceLabel =
          officialRows.some((row) => row.source === "transcript-panel") ? "YouTube Transcript 面板" :
            officialRows.some((row) => row.source === "transcript") ? "YouTube transcript" :
              "官方字幕轨道";
        saveRows(officialRows, sourceLabel);
        runtime.__yllSafeIsLoadingOfficial = false;
        runtime.__yllSafeLoadingVideoId = undefined;
        runtime.__yllSafeLoadedVideoId = videoId;
        runtime.__yllSafeLastOfficialDebug = [`success:${sourceLabel}:${officialRows.length}`];
        addDebugLog("load:official-success", { sourceLabel, rows: officialRows.length });
        return;
      }
    } catch (error) {
      runtime.__yllSafeLastFailure = `official: ${toErrorMessage(error)}`;
      runtime.__yllSafeLastOfficialDebug?.push(runtime.__yllSafeLastFailure);
      addDebugLog("load:official-error", { attempt: attempt + 1, error: toErrorMessage(error) });
    }

    try {
      const textTrackRows = readTextTrackRows();
      if (textTrackRows.length) {
        saveRows(textTrackRows, "video.textTracks");
        runtime.__yllSafeIsLoadingOfficial = false;
        runtime.__yllSafeLoadingVideoId = undefined;
        runtime.__yllSafeLoadedVideoId = videoId;
        runtime.__yllSafeLastOfficialDebug = [`success:video.textTracks:${textTrackRows.length}`];
        addDebugLog("load:text-track-success", { rows: textTrackRows.length });
        return;
      }
    } catch (error) {
      runtime.__yllSafeLastFailure = `textTracks: ${toErrorMessage(error)}`;
      runtime.__yllSafeLastOfficialDebug?.push(runtime.__yllSafeLastFailure);
    }

    try {
      const directRows = await loadDirectTimedTextRows(videoId);
      if (directRows.length) {
        saveRows(directRows, "YouTube timedtext");
        runtime.__yllSafeIsLoadingOfficial = false;
        runtime.__yllSafeLoadingVideoId = undefined;
        runtime.__yllSafeLoadedVideoId = videoId;
        runtime.__yllSafeLastOfficialDebug = [`success:directTimedText:${directRows.length}`];
        addDebugLog("load:direct-timedtext-success", { rows: directRows.length });
        return;
      }
    } catch (error) {
      runtime.__yllSafeLastFailure = `timedtext: ${toErrorMessage(error)}`;
      runtime.__yllSafeLastOfficialDebug?.push(runtime.__yllSafeLastFailure);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 600));
  }

  runtime.__yllSafeIsLoadingOfficial = false;
  runtime.__yllSafeLoadingVideoId = undefined;
  runtime.__yllSafeCanUseVisibleFallback = true;
  ensureNativeCaptionsForFallback();
  const debug = runtime.__yllSafeLastOfficialDebug?.slice(-2).join(" / ");
  addDebugLog("load:fallback-enabled", { debug });
  setStatus(`官方字幕暂未读到，稍后会自动重试；当前先临时采集页面字幕。${debug ? `最近错误：${debug}` : ""}`);
}

function captureVisibleFallback() {
  if (runtime.__yllSafeIsLoadingOfficial || !runtime.__yllSafeCanUseVisibleFallback) return;
  if ((runtime.__yllSafeRows ?? []).some((cue) => cue.source !== "visible")) return;
  ensureNativeCaptionsForFallback();
  const cue = readVisibleCaptionCue(true);
  if (!cue) return;
  addDebugLog("fallback:cue", { startMs: cue.startMs, text: cue.text.slice(0, 90) });
  setOverlayCue(cue);
  const rows = runtime.__yllSafeRows ?? [];
  cue.text = compactRepeatedPhrases(cue.text);
  const normalizedCue = normalizeForCompare(cue.text);
  let recentSimilarIndex = -1;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const normalizedRow = normalizeForCompare(row.text);
    const nearby = Math.abs(row.startMs - cue.startMs) < 6000;
    const overlap = normalizedRow && normalizedCue && (normalizedRow === normalizedCue || normalizedRow.includes(normalizedCue) || normalizedCue.includes(normalizedRow));
    if (nearby && overlap) {
      recentSimilarIndex = index;
      break;
    }
  }
  if (recentSimilarIndex >= 0) {
    const previous = rows[recentSimilarIndex];
    rows[recentSimilarIndex] = cue.text.length > previous.text.length ? { ...cue, translatedText: previous.translatedText, translationProvider: previous.translationProvider } : previous;
    runtime.__yllSafeRows = rows.slice(-MAX_VISIBLE_ROWS);
    renderRows(runtime.__yllSafeRows);
    updateActiveCue();
    void translateRowsForCurrentVideo("页面字幕采集");
    return;
  }
  runtime.__yllSafeRows = [...rows, cue].slice(-MAX_VISIBLE_ROWS);
  renderRows(runtime.__yllSafeRows);
  setStatus(`已临时采集 ${runtime.__yllSafeRows.length} 条页面字幕；原生 CC 已隐藏，仍建议优先使用官方字幕轨。`);
  void translateRowsForCurrentVideo("页面字幕采集");
}

function tick() {
  try {
    if (!isWatchPage()) {
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(OVERLAY_ID)?.remove();
      document.documentElement.classList.remove("yll-hide-native-captions");
      runtime.__yllSafeLoadedVideoId = undefined;
      runtime.__yllSafeLoadingVideoId = undefined;
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeCanUseVisibleFallback = false;
      runtime.__yllSafeRows = [];
      runtime.__yllSafeTranslationToken = undefined;
      runtime.__yllSafeTranslatedVideoId = undefined;
      runtime.__yllSafeIsTranslating = false;
      runtime.__yllSafeLastOfficialAttemptAt = undefined;
      runtime.__yllSafeOfficialAttemptCount = undefined;
      runtime.__yllSafeLastOfficialDebug = undefined;
      document.getElementById(WORD_POPOVER_ID)?.remove();
    document.getElementById(SETTINGS_PANEL_ID)?.remove();
    document.getElementById(DEBUG_PANEL_ID)?.remove();
      document.getElementById(PRACTICE_ID)?.remove();
      return;
    }

    mountPanel();
    mountOverlay();
    positionOverlay();
    if (runtime.__yllSafeLastHref !== location.href) {
      runtime.__yllSafeLastHref = location.href;
      runtime.__yllSafeLoadedVideoId = undefined;
      runtime.__yllSafeLoadingVideoId = undefined;
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeCanUseVisibleFallback = false;
      runtime.__yllTimedTextBridgeInstalled = false;
      runtime.__yllSafeTranslationToken = undefined;
      runtime.__yllSafeTranslatedVideoId = undefined;
      runtime.__yllSafeIsTranslating = false;
      runtime.__yllSafeLastOfficialAttemptAt = undefined;
      runtime.__yllSafeOfficialAttemptCount = undefined;
      runtime.__yllSafeLastOfficialDebug = undefined;
      document.getElementById(WORD_POPOVER_ID)?.remove();
      document.getElementById(SETTINGS_PANEL_ID)?.remove();
      document.getElementById(PRACTICE_ID)?.remove();
    }
    void loadRowsForCurrentVideo().catch((error) => {
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeLoadingVideoId = undefined;
      runtime.__yllSafeCanUseVisibleFallback = true;
      document.documentElement.classList.remove("yll-hide-native-captions");
      setStatus(`字幕读取任务异常：${toErrorMessage(error)}`);
    });
    captureVisibleFallback();
    updateActiveCue();
  } catch (error) {
    mountPanel();
    document.documentElement.classList.remove("yll-hide-native-captions");
    setStatus(`面板运行异常：${toErrorMessage(error)}`);
  }
}

function start() {
  runtime.__yllSafeDebugSnapshot = debugSnapshot;
  if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
  tick();
  runtime.__yllSafeTimer = window.setInterval(tick, POLL_MS);
}

window.addEventListener("yt-navigate-finish", () => window.setTimeout(start, 350));
window.addEventListener("popstate", () => window.setTimeout(start, 350));
window.addEventListener("yll-safe-reload", () => {
  runtime.__yllSafeLoadedVideoId = undefined;
  runtime.__yllSafeLoadingVideoId = undefined;
  runtime.__yllSafeIsLoadingOfficial = false;
  runtime.__yllSafeCanUseVisibleFallback = false;
  runtime.__yllSafeRows = [];
  runtime.__yllSafeActiveKey = undefined;
  runtime.__yllSafeTranslationToken = undefined;
  runtime.__yllSafeTranslatedVideoId = undefined;
  runtime.__yllSafeIsTranslating = false;
  runtime.__yllSafeLastOfficialAttemptAt = undefined;
  runtime.__yllSafeOfficialAttemptCount = undefined;
  runtime.__yllSafeLastOfficialDebug = undefined;
  document.getElementById(WORD_POPOVER_ID)?.remove();
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
  document.getElementById(PRACTICE_ID)?.remove();
  renderRows([]);
  setOverlayCue(undefined);
  start();
});
window.setTimeout(start, 0);
window.setTimeout(start, 900);
