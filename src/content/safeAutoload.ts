type LabCue = {
  startMs: number;
  durationMs: number;
  text: string;
  source: "official" | "transcript" | "transcript-panel" | "text-track" | "timedtext" | "visible";
  translatedText?: string;
  translationProvider?: "web" | "ai" | "youtube" | "none";
  wordTimings?: WordTiming[];
};

type WordTiming = {
  text: string;
  startMs: number;
  endMs: number;
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

type LibrarySentence = {
  text?: string;
  translatedText?: string;
  videoId?: string;
  cueId?: string;
  language?: string;
  startMs?: number;
  durationMs?: number;
  createdAt?: string;
  updatedAt?: string;
};

type LibraryVocab = {
  id: string;
  text?: string;
  normalizedText?: string;
  language?: string;
  wordbookId?: string;
  meaning?: string;
  sourceSentence?: string;
  translatedSentence?: string;
  videoId?: string;
  cueId?: string;
  mastery?: number;
  createdAt?: string;
  updatedAt?: string;
};

type LibraryAttempt = {
  mode?: string;
  practiceItemId?: string;
  cueId?: string;
  answer?: string;
  expected?: string;
  score?: number;
  durationMs?: number;
  createdAt?: string;
};

type LibrarySnapshot = {
  wordbooks?: LibraryWordbook[];
  vocabItems?: LibraryVocab[];
  sentenceNotes?: LibrarySentence[];
  practiceAttempts?: LibraryAttempt[];
};

type LibraryWordbook = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
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
const LIBRARY_PANEL_ID = "yll-lab-library-v2";
const POPUP_DOCK_ID = "yll-lab-popup-dock-v2";
const OLD_PANEL_ID = "yll-safe-panel";
const OLD_OVERLAY_ID = "yll-safe-overlay";
const OLD_WORD_POPOVER_ID = "yll-safe-word-popover";
const OLD_SETTINGS_PANEL_ID = "yll-safe-settings";
const OLD_PRACTICE_ID = "yll-safe-practice";
const LEGACY_HOST_ID = "youtube-language-lab-root";
const LEGACY_NATIVE_HIDE_STYLE_ID = "yll-hide-native-captions-style";
const SETTINGS_KEY = "yll-safe-settings-v1";
const SCRIPT_VERSION = "0.1.128";
const POLL_MS = 500;
const WORD_HIGHLIGHT_POLL_MS = 90;
const MAX_VISIBLE_ROWS = 260;
const DEFAULT_DISPLAY_LEAD_MS = 250;
const DEFAULT_WORD_HIGHLIGHT_OFFSET_MS = 80;
const MIN_OVERLAY_DURATION_MS = 3200;
const MIN_ESTIMATED_WORD_DURATION_MS = 140;
const MIN_WORD_HIGHLIGHT_DURATION_MS = 850;
const MAX_ESTIMATED_WORD_DURATION_MS = 2400;
const MIN_TIMED_WORD_COVERAGE_RATIO = 0.82;
const MIN_TIMED_WORD_SPAN_RATIO = 0.45;
const TARGET_LANGUAGE = "zh-CN";
const TRANSLATION_INITIAL_BATCH_SIZE = 6;
const TRANSLATION_BATCH_SIZE = 10;
const TRANSLATION_RETRY_LIMIT = 3;
const TRANSLATION_RETRY_BACKOFF_MS = 15000;
const OFFICIAL_RETRY_MS = 3500;
const OFFICIAL_FALLBACK_RETRY_MS = 6000;
const OFFICIAL_AUTO_ATTEMPTS = 2;
const OFFICIAL_FAST_ATTEMPT_TIMEOUT_MS = 3500;
const OFFICIAL_SLOW_ATTEMPT_TIMEOUT_MS = 8500;
const USER_SCROLL_PAUSE_MS = 4200;

type SafeSettings = {
  hideNativeCaptions: boolean;
  showTranslations: boolean;
  subtitleMode: "dual" | "source" | "translation";
  overlayPositionPercent: number;
  overlayFontSize: number;
  translationFontSize: number;
  overlayBackgroundOpacity: number;
  syncOffsetMs: number;
  wordHighlightOffsetMs: number;
  highlightCurrentWord: boolean;
  sourceFontFamily: string;
  translationFontFamily: string;
};

type SubtitleMode = SafeSettings["subtitleMode"];

const DEFAULT_SETTINGS: SafeSettings = {
  hideNativeCaptions: true,
  showTranslations: true,
  subtitleMode: "dual",
  overlayPositionPercent: 82,
  overlayFontSize: 24,
  translationFontSize: 20,
  overlayBackgroundOpacity: 72,
  syncOffsetMs: 0,
  wordHighlightOffsetMs: 0,
  highlightCurrentWord: true,
  sourceFontFamily: "system-ui",
  translationFontFamily: "system-ui"
};

const runtime = window as typeof window & {
  __yllSafeTimer?: number;
  __yllSafeOverlayTimer?: number;
  __yllSafeOfficialRetryTimer?: number;
  __yllSafeStartupRetryTimers?: number[];
  __yllSafeLastHref?: string;
  __yllSafeLastVideoId?: string;
  __yllSafeRows?: LabCue[];
  __yllSafeRowsGeneration?: number;
  __yllSafeActiveKey?: string;
  __yllSafeLoadedVideoId?: string;
  __yllSafeLoadingVideoId?: string;
  __yllSafeOfficialLockedVideoId?: string;
  __yllSafeTranslationToken?: number;
  __yllSafeTranslatedVideoId?: string;
  __yllSafeIsTranslating?: boolean;
  __yllSafeTranslationRetryGeneration?: number;
  __yllSafeTranslationRetryCount?: number;
  __yllSafeLastTranslationRetryAt?: number;
  __yllSafeLastTranslationFailure?: string;
  __yllSafeLastTranslationSummary?: string;
  __yllSafeSettings?: SafeSettings;
  __yllSafeScriptVersion?: string;
  __yllSafeStopCurrentScript?: () => void;
  __yllSafeContextInvalidated?: boolean;
  __yllSafeIsLoadingOfficial?: boolean;
  __yllSafeCanUseVisibleFallback?: boolean;
  __yllSafeLastFailure?: string;
  __yllSafeLastOfficialAttemptAt?: number;
  __yllSafeLastOfficialFailureAt?: number;
  __yllSafeOfficialAttemptCount?: number;
  __yllSafeLastOfficialDebug?: string[];
  __yllSafeDebugLog?: string[];
  __yllSafeDebugSnapshot?: () => unknown;
  __yllSafeLastManualListScrollAt?: number;
  __yllSafeSuppressListScrollUntil?: number;
  __yllSafeExpandedInsightKey?: string;
  __yllSafeWasAdShowing?: boolean;
  __yllSafeLibraryOpen?: boolean;
  __yllSafeLibraryLoading?: boolean;
  __yllSafeLastLibraryToggleAt?: number;
  __yllSafeSelectedWordbookId?: string;
  __yllSafePanelDismissedVideoId?: string;
  __yllSafeWordLookupCache?: Map<string, string>;
  __yllSafeWordLookupPending?: Map<string, Promise<string | undefined>>;
  __yllTimedTextBridgeListening?: boolean;
  __yllTimedTextBridgeInstalled?: boolean;
  __yllCapturedTimedText?: CapturedTimedText[];
  ytcfg?: {
    get?: (key: string) => unknown;
  };
};

runtime.__yllSafeContextInvalidated = false;

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

function compareSemverish(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number(part) || 0);
  const rightParts = right.split(".").map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function stopCurrentScriptInstance() {
  if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
  runtime.__yllSafeTimer = undefined;
  if (runtime.__yllSafeOverlayTimer) window.clearInterval(runtime.__yllSafeOverlayTimer);
  runtime.__yllSafeOverlayTimer = undefined;
  if (runtime.__yllSafeOfficialRetryTimer) window.clearTimeout(runtime.__yllSafeOfficialRetryTimer);
  runtime.__yllSafeOfficialRetryTimer = undefined;
  runtime.__yllSafeLoadingVideoId = undefined;
  runtime.__yllSafeOfficialLockedVideoId = undefined;
  runtime.__yllSafeIsLoadingOfficial = false;
  runtime.__yllSafeCanUseVisibleFallback = false;
  runtime.__yllSafeExpandedInsightKey = undefined;
  runtime.__yllSafeLibraryOpen = false;
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(WORD_POPOVER_ID)?.remove();
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
  document.getElementById(PRACTICE_ID)?.remove();
  document.getElementById(DEBUG_PANEL_ID)?.remove();
  document.getElementById(LIBRARY_PANEL_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  document.documentElement.classList.remove("yll-hide-native-captions");
}

function stopTimers() {
  if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
  runtime.__yllSafeTimer = undefined;
  if (runtime.__yllSafeOverlayTimer) window.clearInterval(runtime.__yllSafeOverlayTimer);
  runtime.__yllSafeOverlayTimer = undefined;
  if (runtime.__yllSafeOfficialRetryTimer) window.clearTimeout(runtime.__yllSafeOfficialRetryTimer);
  runtime.__yllSafeOfficialRetryTimer = undefined;
  clearScheduledOfficialRetry();
  clearStartupOfficialRetries();
}

function announceScriptVersion() {
  runtime.__yllSafeScriptVersion = SCRIPT_VERSION;
  runtime.__yllSafeStopCurrentScript = stopCurrentScriptInstance;
  try {
    window.dispatchEvent(new CustomEvent("yll-safe-version-active", { detail: { version: SCRIPT_VERSION } }));
  } catch {
    // Browser event creation can fail in unusual execution worlds; the runtime guard above still helps.
  }
}

window.addEventListener("yll-safe-version-active", (event) => {
  const version = String((event as CustomEvent<{ version?: string }>).detail?.version ?? "");
  if (!version || version === SCRIPT_VERSION) return;
  if (compareSemverish(version, SCRIPT_VERSION) > 0) stopCurrentScriptInstance();
});

window.addEventListener("error", (event) => {
  if (!isExtensionContextInvalidated(event.message)) return;
  event.preventDefault();
  handleInvalidatedExtensionContext();
});

window.addEventListener("unhandledrejection", (event) => {
  if (!isExtensionContextInvalidated(toErrorMessage(event.reason))) return;
  event.preventDefault();
  handleInvalidatedExtensionContext();
});

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

function cssFontFamily(value: string) {
  if (value === "serif") return "Georgia, 'Times New Roman', serif";
  if (value === "sans-serif") return "Arial, Helvetica, sans-serif";
  if (value === "monospace") return "'SFMono-Regular', Menlo, Consolas, monospace";
  return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
}

function parseSubtitleMode(value: unknown): SubtitleMode {
  return value === "source" || value === "translation" || value === "dual" ? value : DEFAULT_SETTINGS.subtitleMode;
}

function parseFontFamily(value: unknown) {
  return value === "system-ui" || value === "serif" || value === "sans-serif" || value === "monospace" ? value : DEFAULT_SETTINGS.sourceFontFamily;
}

function loadSafeSettings(): SafeSettings {
  if (runtime.__yllSafeSettings) return runtime.__yllSafeSettings;
  let settings: SafeSettings;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Partial<SafeSettings>;
    settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      subtitleMode: parseSubtitleMode(stored.subtitleMode),
      overlayPositionPercent: Math.min(94, Math.max(50, Number(stored.overlayPositionPercent ?? DEFAULT_SETTINGS.overlayPositionPercent))),
      overlayFontSize: Math.min(42, Math.max(16, Number(stored.overlayFontSize ?? DEFAULT_SETTINGS.overlayFontSize))),
      translationFontSize: Math.min(36, Math.max(14, Number(stored.translationFontSize ?? DEFAULT_SETTINGS.translationFontSize))),
      overlayBackgroundOpacity: Math.min(95, Math.max(20, Number(stored.overlayBackgroundOpacity ?? DEFAULT_SETTINGS.overlayBackgroundOpacity))),
      syncOffsetMs: Math.min(2000, Math.max(-2000, Number(stored.syncOffsetMs ?? DEFAULT_SETTINGS.syncOffsetMs))),
      wordHighlightOffsetMs: Math.min(1500, Math.max(-1500, Number(stored.wordHighlightOffsetMs ?? DEFAULT_SETTINGS.wordHighlightOffsetMs))),
      highlightCurrentWord: Boolean(stored.highlightCurrentWord ?? DEFAULT_SETTINGS.highlightCurrentWord),
      sourceFontFamily: parseFontFamily(stored.sourceFontFamily),
      translationFontFamily: parseFontFamily(stored.translationFontFamily)
    };
  } catch {
    settings = DEFAULT_SETTINGS;
  }
  runtime.__yllSafeSettings = settings;
  return settings;
}

function saveSafeSettings(settings: SafeSettings) {
  runtime.__yllSafeSettings = settings;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySafeSettings();
  updateModeSelect();
  renderSettingsPanel();
  renderRows(runtime.__yllSafeRows ?? []);
  updateActiveCue();
}

function applySafeSettings() {
  const settings = loadSafeSettings();
  const hasPluginRows = (runtime.__yllSafeRows ?? []).length > 0;
  document.documentElement.classList.toggle("yll-hide-native-captions", settings.hideNativeCaptions && hasPluginRows);
}

function updateModeSelect() {
  const select = document.querySelector<HTMLSelectElement>(`#${PANEL_ID} [data-yll-mode-select]`);
  if (select) select.value = loadSafeSettings().subtitleMode;
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

function renderOverlaySourceText(cue: LabCue, settings: SafeSettings) {
  if (!settings.highlightCurrentWord) return escapeHtml(cue.text);
  const pattern = /(\p{L}[\p{L}\p{M}'-]*|\p{N}+)/gu;
  const words = Array.from(cue.text.matchAll(pattern));
  if (!words.length) return escapeHtml(cue.text);
  const video = getMainVideo();
  const currentMs = video ? wordHighlightCurrentMs(video, settings) : cue.startMs;
  const activeWordIndex = activeWordIndexForCue(cue, words, currentMs);
  let output = "";
  let lastIndex = 0;
  words.forEach((match, index) => {
    const word = match[0];
    const start = match.index ?? 0;
    output += escapeHtml(cue.text.slice(lastIndex, start));
    output += `<span class="yll-overlay-word ${index === activeWordIndex ? "is-current" : ""}" role="button" tabindex="0" data-word="${escapeHtml(word)}" data-start="${cue.startMs}">${escapeHtml(word)}</span>`;
    lastIndex = start + word.length;
  });
  output += escapeHtml(cue.text.slice(lastIndex));
  return output;
}

function wordHighlightCurrentMs(video: HTMLVideoElement, settings: SafeSettings) {
  return syncedCurrentMs(video, settings) + settings.wordHighlightOffsetMs + DEFAULT_WORD_HIGHLIGHT_OFFSET_MS;
}

function activeWordIndexForCue(cue: LabCue, words: RegExpMatchArray[], currentMs: number) {
  const timingIndex = activeWordIndexFromTimings(cue, words.length, currentMs);
  if (timingIndex !== undefined) return timingIndex;

  const elapsedMs = Math.max(0, currentMs - cue.startMs);
  const weights = words.map((match, index) => {
    const end = (match.index ?? 0) + match[0].length;
    const nextStart = words[index + 1]?.index ?? cue.text.length;
    return wordHighlightWeight(match[0], cue.text.slice(end, nextStart));
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || words.length || 1;
  const cueDurationMs = cue.durationMs > 0 ? cue.durationMs : words.length * 260;
  const minimumReadableDurationMs = Math.min(
    MAX_ESTIMATED_WORD_DURATION_MS,
    Math.max(MIN_WORD_HIGHLIGHT_DURATION_MS, words.length * MIN_ESTIMATED_WORD_DURATION_MS)
  );
  const highlightDurationMs = Math.max(1, Math.max(cueDurationMs, minimumReadableDurationMs));
  const targetWeight = Math.min(totalWeight - 0.001, Math.max(0, (elapsedMs / highlightDurationMs) * totalWeight));
  let cursor = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cursor += weights[index];
    if (targetWeight < cursor) return index;
  }
  return Math.max(0, words.length - 1);
}

function activeWordIndexFromTimings(cue: LabCue, wordCountValue: number, currentMs: number) {
  const timings = (cue.wordTimings ?? []).filter((timing) => timing.endMs > timing.startMs);
  if (!timings.length) return undefined;
  const coverageRatio = Math.min(timings.length, wordCountValue) / Math.max(timings.length, wordCountValue, 1);
  if (coverageRatio < MIN_TIMED_WORD_COVERAGE_RATIO) return undefined;
  const timedStartMs = timings[0]?.startMs ?? cue.startMs;
  const timedEndMs = timings[timings.length - 1]?.endMs ?? timedStartMs;
  const cueReadableDurationMs = Math.max(cue.durationMs, Math.min(MAX_ESTIMATED_WORD_DURATION_MS, Math.max(MIN_WORD_HIGHLIGHT_DURATION_MS, wordCountValue * MIN_ESTIMATED_WORD_DURATION_MS)));
  const timedSpanRatio = (timedEndMs - timedStartMs) / Math.max(cueReadableDurationMs, 1);
  if (timings.length > 2 && timedSpanRatio < MIN_TIMED_WORD_SPAN_RATIO) return undefined;

  const normalizedCurrentMs = Math.max(cue.startMs, currentMs);
  const activeIndex = timings.findIndex((timing, index) => {
    const nextStart = timings[index + 1]?.startMs ?? timing.endMs;
    return normalizedCurrentMs >= timing.startMs - 80 && normalizedCurrentMs < Math.max(timing.endMs, nextStart);
  });
  if (activeIndex >= 0) return mapTimingIndexToWordIndex(activeIndex, timings.length, wordCountValue);
  const readableEndMs = cue.startMs + cueReadableDurationMs;
  if (normalizedCurrentMs < readableEndMs) return undefined;
  for (let index = timings.length - 1; index >= 0; index -= 1) {
    if (timings[index].startMs <= normalizedCurrentMs) return mapTimingIndexToWordIndex(index, timings.length, wordCountValue);
  }
  return 0;
}

function mapTimingIndexToWordIndex(timingIndex: number, timingCount: number, wordCountValue: number) {
  if (wordCountValue <= 1) return 0;
  if (timingCount === wordCountValue) return Math.max(0, Math.min(wordCountValue - 1, timingIndex));
  const ratio = timingIndex / Math.max(1, timingCount - 1);
  return Math.max(0, Math.min(wordCountValue - 1, Math.round(ratio * (wordCountValue - 1))));
}

function wordHighlightWeight(word: string, followingText: string) {
  const normalized = word.toLowerCase();
  const compactFunctionWords = new Set(["a", "an", "the", "to", "of", "in", "on", "at", "and", "or", "is", "are", "was", "were", "be", "do", "did", "it", "we", "you", "i", "he", "she", "my", "our"]);
  const base = compactFunctionWords.has(normalized)
    ? 0.58
    : Math.min(1.75, Math.max(0.78, Math.sqrt(Math.max(1, normalized.length)) / 1.65));
  const pause = /[,.!?;:]/.test(followingText) ? 0.22 : 0;
  return base + pause;
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

function normalizedWords(text: string) {
  return normalizeForCompare(text).split(" ").filter(Boolean);
}

function wordContainmentScore(a: string, b: string) {
  const aWords = normalizedWords(a);
  const bWords = normalizedWords(b);
  if (!aWords.length || !bWords.length) return 0;
  const shorter = aWords.length <= bWords.length ? aWords : bWords;
  const longer = aWords.length <= bWords.length ? bWords : aWords;
  let matched = 0;
  const used = new Set<number>();
  for (const word of shorter) {
    const index = longer.findIndex((candidate, candidateIndex) => candidate === word && !used.has(candidateIndex));
    if (index >= 0) {
      used.add(index);
      matched += 1;
    }
  }
  return matched / shorter.length;
}

function combineOverlappingText(left: string, right: string) {
  const leftWords = cleanText(left).split(" ").filter(Boolean);
  const rightWords = cleanText(right).split(" ").filter(Boolean);
  if (!leftWords.length) return rightWords.join(" ");
  if (!rightWords.length) return leftWords.join(" ");

  const leftNorm = leftWords.map(normalizeForCompare);
  const rightNorm = rightWords.map(normalizeForCompare);
  const leftJoined = leftNorm.join(" ");
  const rightJoined = rightNorm.join(" ");
  if (leftJoined === rightJoined) return leftWords.length >= rightWords.length ? leftWords.join(" ") : rightWords.join(" ");
  if (leftJoined.includes(rightJoined)) return leftWords.join(" ");
  if (rightJoined.includes(leftJoined)) return rightWords.join(" ");

  const maxOverlap = Math.min(leftWords.length, rightWords.length);
  for (let size = maxOverlap; size >= 2; size -= 1) {
    const leftTail = leftNorm.slice(leftNorm.length - size).join(" ");
    const rightHead = rightNorm.slice(0, size).join(" ");
    if (leftTail && leftTail === rightHead) {
      return [...leftWords, ...rightWords.slice(size)].join(" ");
    }
  }

  return `${leftWords.join(" ")} ${rightWords.join(" ")}`;
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
    const combinedText = compactRepeatedPhrases(combineOverlappingText(current.text, nextCue.text));
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
      text: combinedText,
      wordTimings: [...(current.wordTimings ?? []), ...(nextCue.wordTimings ?? [])].filter((timing) => timing.text)
    };
  }

  commit();
  return merged;
}

function installStyle() {
  removeLegacyContentApp();
  const existing = document.getElementById(STYLE_ID);
  if (existing?.getAttribute("data-yll-version") === SCRIPT_VERSION) return;
  existing?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.setAttribute("data-yll-version", SCRIPT_VERSION);
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
      height: clamp(520px, calc(100dvh - 92px), 1040px);
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
    #${POPUP_DOCK_ID} {
      position: fixed;
      right: 402px;
      top: 76px;
      z-index: 2147483647;
      width: 460px;
      height: clamp(520px, calc(100dvh - 92px), 1040px);
      overflow: hidden;
      background: #0c0d0e;
      color: #f7f8f8;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 16px 42px rgba(0,0,0,.34);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      contain: layout paint style;
    }
    #${POPUP_DOCK_ID} iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #0c0d0e;
    }
    #${POPUP_DOCK_ID} .yll-popup-dock-close {
      position: absolute;
      right: 12px;
      top: 12px;
      z-index: 1;
      width: 30px;
      height: 30px;
      color: #a3aab5;
      background: #202326;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 999px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }
    #${POPUP_DOCK_ID} .yll-popup-dock-close:hover,
    #${POPUP_DOCK_ID} .yll-popup-dock-close:focus {
      color: #17191b;
      background: #f4f5f5;
      outline: none;
    }
    @media (max-width: 920px) {
      #${POPUP_DOCK_ID} {
        left: 16px;
        right: auto;
        width: min(460px, calc(100vw - 32px));
      }
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .yll-head {
      flex: 0 0 auto;
      min-height: 128px;
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,.12);
      background: #202224;
      overflow: visible;
    }
    #${PANEL_ID} .yll-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    #${PANEL_ID} .yll-title { font-weight: 750; font-size: 14px; }
    #${PANEL_ID} .yll-title-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #${PANEL_ID} .yll-mode-select {
      height: 28px;
      max-width: 112px;
      color: #f7f8f8;
      background: #2b2e32;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
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
      min-height: 30px;
      overflow: hidden;
      color: #a3aab5;
      font-size: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    #${STATUS_ID} .yll-source-badge {
      display: inline-block;
      margin-right: 6px;
      padding: 1px 6px;
      border-radius: 999px;
      color: #111;
      background: #ffc857;
      font-size: 11px;
      font-weight: 800;
      vertical-align: 1px;
    }
    #${LIST_ID} {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-color: rgba(255,255,255,.38) transparent;
    }
    #${PANEL_ID}.yll-library-open #${LIST_ID} {
      display: none;
    }
    #${LIST_ID} .yll-row {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr);
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
      display: block;
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
    #${LIST_ID} .yll-row-actions {
      display: none;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      margin-top: 7px;
    }
    #${LIST_ID} .yll-row:hover .yll-row-actions,
    #${LIST_ID} .yll-row:focus-within .yll-row-actions {
      display: flex;
    }
    #${LIST_ID} .yll-row-action {
      min-height: 24px;
      padding: 0 9px;
      color: #f7f8f8;
      background: #2d3034;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 750;
      cursor: pointer;
    }
    #${LIST_ID} .yll-row-action:hover,
    #${LIST_ID} .yll-row-action:focus {
      color: #111;
      background: #ffc857;
      outline: none;
    }
    #${LIST_ID} .yll-empty-state {
      margin: 18px 14px;
      padding: 14px;
      color: #c7ccd4;
      background: rgba(255,255,255,.045);
      border: 1px solid rgba(255,255,255,.11);
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
    }
    #${LIST_ID} .yll-empty-state strong {
      display: block;
      margin-bottom: 4px;
      color: #f7f8f8;
      font-size: 14px;
    }
    #${LIST_ID} .yll-row-insight {
      grid-column: 2 / 3;
      margin-top: 8px;
      padding: 10px;
      color: #d7dbe1;
      background: rgba(0,0,0,.24);
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 7px;
      font-size: 12px;
      line-height: 1.48;
    }
    #${LIST_ID} .yll-row-insight strong {
      display: block;
      margin: 8px 0 3px;
      color: #ffc857;
      font-size: 12px;
    }
    #${LIST_ID} .yll-row-insight strong:first-child { margin-top: 0; }
    #${LIST_ID} .yll-row-insight ul {
      margin: 0;
      padding-left: 16px;
    }
    #${LIST_ID} .yll-row-insight li { margin: 2px 0; }
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
    #${WORD_POPOVER_ID} .yll-insight-block {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid rgba(255,255,255,.12);
    }
    #${WORD_POPOVER_ID} .yll-insight-title {
      margin-bottom: 4px;
      color: #ffc857;
      font-size: 12px;
      font-weight: 800;
    }
    #${WORD_POPOVER_ID} .yll-insight-list {
      margin: 0;
      padding-left: 16px;
      color: #d7dbe1;
    }
    #${WORD_POPOVER_ID} .yll-insight-list li { margin: 3px 0; }
    #${WORD_POPOVER_ID} button {
      margin-top: 10px;
      height: 30px;
      padding: 0 10px;
      border: 0;
      border-radius: 6px;
      color: #151515;
      background: #ffc857;
      font-weight: 750;
      cursor: pointer;
    }
    #${SETTINGS_PANEL_ID} {
      position: fixed;
      z-index: 2147483647;
      right: 394px;
      top: 76px;
      width: 286px;
      max-width: calc(100vw - 430px);
      max-height: calc(100dvh - 112px);
      padding: 14px;
      color: #f7f8f8;
      background: #25282c;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 14px 34px rgba(0,0,0,.34);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow-y: auto;
    }
    #${SETTINGS_PANEL_ID} .yll-settings-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }
    #${SETTINGS_PANEL_ID} h3 { margin: 0; font-size: 15px; }
    #${SETTINGS_PANEL_ID} .yll-settings-close {
      min-height: 26px;
      padding: 0 9px;
      color: #f7f8f8;
      background: #2d3034;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 750;
      cursor: pointer;
    }
    #${SETTINGS_PANEL_ID} h4 {
      margin: 14px 0 6px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,.12);
      color: #ffc857;
      font-size: 13px;
    }
    #${SETTINGS_PANEL_ID} label {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 9px 0;
      border-top: 1px solid rgba(255,255,255,.09);
    }
    #${SETTINGS_PANEL_ID} input[type="range"] { width: 120px; }
    #${SETTINGS_PANEL_ID} select {
      min-width: 112px;
      height: 28px;
      color: #f7f8f8;
      background: #2d3034;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px;
      padding: 0 6px;
    }
    #${SETTINGS_PANEL_ID} .yll-setting-value { color: #ffc857; font-variant-numeric: tabular-nums; }
    #${LIBRARY_PANEL_ID} {
      flex: 1 1 auto;
      min-height: 0;
      margin: 8px 12px 12px;
      padding: 14px;
      color: #f7f8f8;
      background: #25282c;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 10px 24px rgba(0,0,0,.26);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: visible;
    }
    #${LIBRARY_PANEL_ID} .yll-library-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    #${LIBRARY_PANEL_ID} h3 { margin: 0; font-size: 15px; }
    #${LIBRARY_PANEL_ID} .yll-library-close {
      height: 28px;
      padding: 0 10px;
      color: #fff;
      background: #2b2e32;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 6px;
      cursor: pointer;
    }
    #${LIBRARY_PANEL_ID} .yll-library-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }
    #${LIBRARY_PANEL_ID} .yll-library-stat {
      padding: 10px;
      color: #cfd4dc;
      background: rgba(255,255,255,.07);
      border-radius: 6px;
      text-align: center;
    }
    #${LIBRARY_PANEL_ID} .yll-library-stat strong {
      display: block;
      color: #ffc857;
      font-size: 20px;
    }
    #${LIBRARY_PANEL_ID} .yll-library-section {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,.12);
    }
    #${LIBRARY_PANEL_ID} .yll-library-section h4 {
      margin: 0 0 8px;
      color: #ffc857;
      font-size: 13px;
    }
    #${LIBRARY_PANEL_ID} .yll-library-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0 2px;
    }
    #${LIBRARY_PANEL_ID} .yll-wordbook-tools {
      display: grid;
      gap: 8px;
      margin-bottom: 12px;
    }
    #${LIBRARY_PANEL_ID} .yll-wordbook-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    #${LIBRARY_PANEL_ID} .yll-wordbook-create {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    #${LIBRARY_PANEL_ID} select,
    #${LIBRARY_PANEL_ID} input[type="text"] {
      min-height: 32px;
      min-width: 0;
      color: #f7f8f8;
      background: #1d2023;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 7px;
      padding: 0 9px;
      outline: none;
    }
    #${LIBRARY_PANEL_ID} .yll-wordbook-meta {
      color: #a3aab5;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    #${LIBRARY_PANEL_ID} .yll-library-actions button {
      padding: 8px 10px;
      color: #161616;
      background: #ffc857;
      border: 0;
      border-radius: 7px;
      font-weight: 820;
      cursor: pointer;
    }
    #${LIBRARY_PANEL_ID} .yll-library-actions button.secondary,
    #${LIBRARY_PANEL_ID} .yll-wordbook-create button,
    #${LIBRARY_PANEL_ID} .yll-wordbook-row button {
      color: #f7f8f8;
      background: #2d3034;
      border: 1px solid rgba(255,255,255,.14);
    }
    #${LIBRARY_PANEL_ID} .yll-library-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-top: 1px solid rgba(255,255,255,.08);
    }
    #${LIBRARY_PANEL_ID} .yll-library-item-text {
      min-width: 0;
    }
    #${LIBRARY_PANEL_ID} .yll-library-item:first-of-type { border-top: 0; }
    #${LIBRARY_PANEL_ID} .yll-library-delete {
      min-width: 48px;
      height: 28px;
      padding: 0 9px;
      color: #ffdbdb;
      background: rgba(255,86,86,.12);
      border: 1px solid rgba(255,120,120,.25);
      border-radius: 7px;
      font-weight: 760;
      cursor: pointer;
    }
    #${LIBRARY_PANEL_ID} .yll-library-delete:hover,
    #${LIBRARY_PANEL_ID} .yll-library-delete:focus {
      color: #fff;
      background: rgba(255,86,86,.28);
      outline: none;
    }
    #${LIBRARY_PANEL_ID} .yll-library-main {
      color: #fff;
      font-weight: 720;
      overflow-wrap: anywhere;
    }
    #${LIBRARY_PANEL_ID} .yll-library-sub {
      margin-top: 3px;
      color: #cfd4dc;
      overflow-wrap: anywhere;
    }
    #${LIBRARY_PANEL_ID} .yll-library-empty { color: #a3aab5; }
    #${DEBUG_PANEL_ID} {
      flex: 0 0 auto;
      max-height: 220px;
      margin: 8px 12px 12px;
      padding: 10px;
      color: #f7f8f8;
      background: #202224;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      overflow: auto;
      white-space: pre-wrap;
    }
    #${DEBUG_PANEL_ID} .yll-debug-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    #${DEBUG_PANEL_ID} strong { color: #ffc857; font: 700 13px/1.2 system-ui, sans-serif; }
    #${DEBUG_PANEL_ID} .yll-debug-copy {
      padding: 5px 8px;
      color: #f7f8f8;
      background: #2d3034;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px;
      font: 700 12px/1 system-ui, sans-serif;
      cursor: pointer;
    }
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
    #${PRACTICE_ID} .yll-practice-tabs,
    #${PRACTICE_ID} .yll-practice-sentence {
      margin: 20px 0 10px;
      font-size: 28px;
      font-weight: 760;
      line-height: 1.35;
    }
    #${PRACTICE_ID} .yll-practice-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 14px;
      font-size: 14px;
      font-weight: 700;
    }
    #${PRACTICE_ID} .yll-practice-tabs button.is-active {
      color: #151515;
      background: #ffc857;
      border: 0;
    }
    #${PRACTICE_ID} .yll-practice-prompt {
      margin: 8px 0 10px;
      color: #cfd4dc;
    }
    #${PRACTICE_ID} .yll-practice-translation { color: #f5e86e; font-size: 20px; }
    #${PRACTICE_ID} .yll-practice-feedback {
      min-height: 24px;
      margin-top: 10px;
      color: #ffc857;
      font-weight: 750;
    }
    #${PRACTICE_ID} .yll-practice-diff {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
      color: #dfe3e8;
      font-size: 14px;
      font-weight: 650;
    }
    #${PRACTICE_ID} .yll-practice-token {
      padding: 3px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,.08);
    }
    #${PRACTICE_ID} .yll-practice-token.hit {
      color: #161616;
      background: #65d6a3;
    }
    #${PRACTICE_ID} .yll-practice-token.miss {
      color: #fff;
      background: rgba(255,96,96,.26);
      border: 1px solid rgba(255,96,96,.38);
    }
    #${PRACTICE_ID} .yll-practice-score-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    #${PRACTICE_ID} .yll-practice-score-card {
      padding: 10px;
      border-radius: 6px;
      background: rgba(255,255,255,.07);
      color: #dfe3e8;
      font-size: 12px;
    }
    #${PRACTICE_ID} .yll-practice-score-card strong {
      display: block;
      margin-top: 3px;
      color: #ffc857;
      font-size: 20px;
    }
    #${PRACTICE_ID} .yll-practice-options {
      display: grid;
      gap: 8px;
      margin-top: 14px;
    }
    #${PRACTICE_ID} .yll-practice-option {
      height: auto;
      min-height: 42px;
      padding: 10px 12px;
      text-align: left;
    }
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
    #${PRACTICE_ID} input[data-practice-cloze-answer] {
      width: min(420px, 100%);
      height: 42px;
      margin-top: 16px;
      padding: 0 12px;
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
    #${OVERLAY_ID} .yll-overlay-source {
      display: block;
      font-family: var(--yll-source-font, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    }
    #${OVERLAY_ID} .yll-overlay-word {
      border-radius: 4px;
      padding: 0 2px;
      pointer-events: auto;
      cursor: help;
    }
    #${OVERLAY_ID} .yll-overlay-word:hover,
    #${OVERLAY_ID} .yll-overlay-word:focus {
      color: #121212;
      background: #ffe08a;
      text-shadow: none;
      outline: none;
    }
    #${OVERLAY_ID} .yll-overlay-word.is-current {
      color: #121212;
      background: #ffc857;
      text-shadow: none;
    }
    #${OVERLAY_ID} .yll-overlay-translation {
      display: block;
      margin-top: 4px;
      color: #f5e86e;
      font-family: var(--yll-translation-font, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      font-size: var(--yll-translation-size, 20px);
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
        <div class="yll-title-actions">
          <select class="yll-mode-select" aria-label="字幕模式" data-yll-mode-select>
            <option value="dual">双语字幕</option>
            <option value="source">原文字幕</option>
            <option value="translation">译文字幕</option>
          </select>
          <button class="yll-close" type="button">关闭</button>
        </div>
      </div>
      <div class="yll-toolbar">
        <button class="yll-tool" type="button" data-yll-action="practice">练习当前句</button>
        <button class="yll-tool secondary" type="button" data-yll-action="settings">字幕设置</button>
        <button class="yll-tool secondary" type="button" data-yll-action="library">学习库</button>
      </div>
      <div id="${STATUS_ID}">正在连接当前 YouTube 视频页...</div>
    </div>
    <div id="${LIST_ID}"></div>
  `;
  panel.querySelector<HTMLButtonElement>(".yll-close")?.addEventListener("click", () => {
    runtime.__yllSafePanelDismissedVideoId = getVideoId();
    panel.remove();
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(WORD_POPOVER_ID)?.remove();
    document.getElementById(SETTINGS_PANEL_ID)?.remove();
    document.getElementById(PRACTICE_ID)?.remove();
    closeLibraryPanel();
    document.documentElement.classList.remove("yll-hide-native-captions");
  });
  panel.querySelector<HTMLSelectElement>("[data-yll-mode-select]")?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    const settings = loadSafeSettings();
    const subtitleMode = parseSubtitleMode(select.value);
    saveSafeSettings({ ...settings, subtitleMode });
    addDebugLog("subtitle-mode-change", { subtitleMode, version: SCRIPT_VERSION });
  });
  panel.querySelector<HTMLButtonElement>('[data-yll-action="settings"]')?.addEventListener("click", () => {
    toggleSettingsPanel();
  });
  panel.querySelector<HTMLButtonElement>('[data-yll-action="practice"]')?.addEventListener("click", () => {
    openPracticeOverlay();
  });
  panel.querySelector<HTMLButtonElement>('[data-yll-action="library"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void toggleLibraryPanel();
  });
  panel.querySelector<HTMLElement>(".yll-title")?.addEventListener("click", (event) => {
    if (!event.altKey) return;
    toggleDebugPanel();
  });
  document.documentElement.appendChild(panel);
  bindCaptionListScrollState(panel.querySelector<HTMLElement>(`#${LIST_ID}`));
  applySafeSettings();
  updateModeSelect();
  ensureLibraryPanelVisible();
  return panel;
}

function openPopupDock() {
  removeLegacyContentApp();
  installStyle();
  const existing = document.getElementById(POPUP_DOCK_ID);
  if (existing?.getAttribute("data-yll-version") === SCRIPT_VERSION) return existing;
  existing?.remove();

  const dock = document.createElement("aside");
  dock.id = POPUP_DOCK_ID;
  dock.setAttribute("data-yll-version", SCRIPT_VERSION);

  const closeButton = document.createElement("button");
  closeButton.className = "yll-popup-dock-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "关闭 YouTube Language Lab");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => dock.remove());

  const iframe = document.createElement("iframe");
  iframe.title = "YouTube Language Lab";
  const popupUrl = getRuntimeUrl(`popup.html?dock=1&v=${SCRIPT_VERSION}`);
  if (!popupUrl) return undefined;
  iframe.src = popupUrl;
  iframe.setAttribute("allow", "microphone");

  dock.append(closeButton, iframe);
  document.documentElement.appendChild(dock);
  return dock;
}

function togglePopupDock() {
  const existing = document.getElementById(POPUP_DOCK_ID);
  if (existing?.getAttribute("data-yll-version") === SCRIPT_VERSION) {
    existing.remove();
    return;
  }
  openPopupDock();
}

function bindCaptionListScrollState(list: HTMLElement | null) {
  if (!list) return;
  const markManualScroll = () => {
    runtime.__yllSafeLastManualListScrollAt = Date.now();
  };
  list.addEventListener("wheel", markManualScroll, { passive: true });
  list.addEventListener("touchstart", markManualScroll, { passive: true });
  list.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) return;
    markManualScroll();
  });
  list.addEventListener("scroll", () => {
    if (Date.now() < (runtime.__yllSafeSuppressListScrollUntil ?? 0)) return;
    markManualScroll();
  }, { passive: true });
}

function setStatus(text: string) {
  const status = document.getElementById(STATUS_ID);
  if (status) {
    status.textContent = text;
    status.title = text;
  }
  ensureLibraryPanelVisible();
}

function setCaptionStatus(text: string, sourceLabel?: string) {
  const status = document.getElementById(STATUS_ID);
  if (!status) return;
  const badge = sourceLabel ? captionSourceBadge(sourceLabel) : "";
  status.innerHTML = `${badge}${escapeHtml(text)}`;
  status.title = sourceLabel ? `${captionSourceText(sourceLabel)} · ${text}` : text;
  ensureLibraryPanelVisible();
}

function captionSourceText(sourceLabel: string) {
  if (/页面字幕|采集|visible/i.test(sourceLabel)) return "页面采集";
  if (/Transcript|transcript/i.test(sourceLabel)) return "Transcript";
  if (/textTracks/i.test(sourceLabel)) return "TextTrack";
  if (/timedtext/i.test(sourceLabel)) return "TimedText";
  return "官方";
}

function captionSourceBadge(sourceLabel: string) {
  return `<span class="yll-source-badge">${escapeHtml(captionSourceText(sourceLabel))}</span>`;
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
  const translatedRows = rows.filter((cue) => cue.translatedText).length;
  return {
    version: SCRIPT_VERSION,
    videoId: getVideoId(),
    adShowing: isYouTubeAdShowing(),
    rows: rows.length,
    sources: Array.from(new Set(rows.map((cue) => cue.source))),
    loadingVideoId: runtime.__yllSafeLoadingVideoId,
    loadedVideoId: runtime.__yllSafeLoadedVideoId,
    isTranslating: Boolean(runtime.__yllSafeIsTranslating),
    translatedRows,
    translationRetryCount: runtime.__yllSafeTranslationRetryCount,
    lastTranslationFailure: runtime.__yllSafeLastTranslationFailure,
    lastTranslationSummary: runtime.__yllSafeLastTranslationSummary,
    isLoadingOfficial: runtime.__yllSafeIsLoadingOfficial,
    canUseFallback: runtime.__yllSafeCanUseVisibleFallback,
    attempts: runtime.__yllSafeOfficialAttemptCount,
    lastFailure: runtime.__yllSafeLastFailure,
    lastOfficialDebug: runtime.__yllSafeLastOfficialDebug,
    log: runtime.__yllSafeDebugLog ?? []
  };
}

async function toggleLibraryPanel(options: { forceOpen?: boolean } = {}) {
  const now = Date.now();
  if (runtime.__yllSafeLastLibraryToggleAt && now - runtime.__yllSafeLastLibraryToggleAt < 350) return;
  runtime.__yllSafeLastLibraryToggleAt = now;

  const existing = document.getElementById(LIBRARY_PANEL_ID);
  if (existing) {
    if (options.forceOpen) {
      runtime.__yllSafeLibraryOpen = true;
      document.getElementById(PANEL_ID)?.classList.add("yll-library-open");
      return;
    }
    closeLibraryPanel();
    return;
  }

  await openLibraryPanel();
}

async function openLibraryPanel() {
  if (runtime.__yllSafeLibraryLoading) return;
  runtime.__yllSafeLibraryOpen = true;
  runtime.__yllSafeLibraryLoading = true;

  const panel = mountLibraryPanelElement();
  panel.innerHTML = `
    <div class="yll-library-head">
      <h3>本地学习库</h3>
      <button class="yll-library-close" type="button">关闭</button>
    </div>
    <div class="yll-library-empty">正在读取本地学习记录...</div>
  `;
  panel.querySelector<HTMLButtonElement>(".yll-library-close")?.addEventListener("click", () => closeLibraryPanel());

  try {
    const response = await sendRuntimeMessage<LibrarySnapshot>({ type: "GET_LIBRARY" });
    if (!response?.ok) throw new Error(response?.error ?? "读取学习库失败");
    renderLibraryPanel(panel, response.data ?? {});
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    const message = isExtensionContextInvalidated(errorMessage)
      ? "扩展上下文已过期。请打开 popup 并点击“唤醒面板”后再试。"
      : `读取失败：${errorMessage}`;
    panel.innerHTML = `
      <div class="yll-library-head">
        <h3>本地学习库</h3>
        <button class="yll-library-close" type="button">关闭</button>
      </div>
      <div class="yll-library-empty">${escapeHtml(message)}</div>
    `;
    panel.querySelector<HTMLButtonElement>(".yll-library-close")?.addEventListener("click", () => closeLibraryPanel());
  } finally {
    runtime.__yllSafeLibraryLoading = false;
  }
}

function mountLibraryPanelElement() {
  const existing = document.getElementById(LIBRARY_PANEL_ID);
  document.getElementById(PANEL_ID)?.classList.add("yll-library-open");
  if (existing) return existing;

  const panel = document.createElement("section");
  panel.id = LIBRARY_PANEL_ID;
  const host = document.getElementById(PANEL_ID) ?? document.documentElement;
  const list = document.getElementById(LIST_ID);
  if (host === document.documentElement || !list) {
    host.appendChild(panel);
  } else {
    host.insertBefore(panel, list);
  }
  return panel;
}

function ensureLibraryPanelVisible() {
  if (!runtime.__yllSafeLibraryOpen) return;
  document.getElementById(PANEL_ID)?.classList.add("yll-library-open");
  if (document.getElementById(LIBRARY_PANEL_ID) || runtime.__yllSafeLibraryLoading) return;
  void openLibraryPanel();
}

function closeLibraryPanel() {
  runtime.__yllSafeLibraryOpen = false;
  runtime.__yllSafeLibraryLoading = false;
  document.getElementById(PANEL_ID)?.classList.remove("yll-library-open");
  document.getElementById(LIBRARY_PANEL_ID)?.remove();
}

function renderLibraryPanel(panel: HTMLElement, library: LibrarySnapshot) {
  const wordbooks = sortLibraryItems(library.wordbooks ?? []);
  const vocabItems = sortLibraryItems(library.vocabItems ?? []);
  const sentenceNotes = sortLibraryItems(library.sentenceNotes ?? []);
  const practiceAttempts = sortLibraryItems(library.practiceAttempts ?? []);
  const selectedWordbook = selectLibraryWordbook(wordbooks, vocabItems);
  const selectedWordbookId = selectedWordbook?.id ?? "";
  const legacyWordbookId = (wordbooks.find((item) => item.name === "默认词本") ?? wordbooks[0])?.id ?? selectedWordbookId;
  runtime.__yllSafeSelectedWordbookId = selectedWordbookId || undefined;
  const wordbookVocabItems = vocabItems.filter((item) => (item.wordbookId ?? legacyWordbookId) === selectedWordbookId);
  panel.innerHTML = `
    <div class="yll-library-head">
      <h3>本地学习库</h3>
      <button class="yll-library-close" type="button">关闭</button>
    </div>
    <div class="yll-wordbook-tools">
      <div class="yll-wordbook-row">
        <select data-wordbook-select aria-label="选择词本">
          ${wordbooks.map((wordbook) => `
            <option value="${escapeHtml(wordbook.id)}" ${wordbook.id === selectedWordbookId ? "selected" : ""}>
              ${escapeHtml(wordbook.name)} (${vocabItems.filter((item) => (item.wordbookId ?? legacyWordbookId) === wordbook.id).length})
            </option>
          `).join("")}
        </select>
        <button type="button" data-wordbook-export>导出词本</button>
      </div>
      <div class="yll-wordbook-create">
        <input type="text" maxlength="40" placeholder="新建词本名称" data-wordbook-name>
        <button type="button" data-wordbook-create>新建</button>
      </div>
      <div class="yll-wordbook-meta">
        当前词本：${escapeHtml(selectedWordbook?.name ?? "默认词本")} · ${wordbookVocabItems.length} 个单词
      </div>
    </div>
    <div class="yll-library-stats">
      <div class="yll-library-stat"><strong>${sentenceNotes.length}</strong>句子</div>
      <div class="yll-library-stat"><strong>${vocabItems.length}</strong>词汇</div>
      <div class="yll-library-stat"><strong>${practiceAttempts.length}</strong>练习</div>
    </div>
    <div class="yll-library-actions">
      ${sentenceNotes.length ? `<button type="button" data-library-practice-sentences>练习收藏句</button>` : ""}
      <button class="secondary" type="button" data-wordbook-import>导入单词</button>
      <button type="button" data-library-export-json>导出 JSON</button>
      <button type="button" data-library-export-csv>导出 CSV</button>
      <button type="button" data-library-export-anki>导出 Anki</button>
    </div>
    <input data-wordbook-import-file type="file" accept=".csv,.json,text/csv,application/json" hidden>
    ${renderLibrarySection("最近收藏句", sentenceNotes.slice(0, 6), (item) => ({
      main: item.text ?? "",
      sub: item.translatedText ?? formatLibraryTime(item.createdAt)
    }))}
    ${renderVocabLibrarySection(`当前词本：${selectedWordbook?.name ?? "默认词本"}`, wordbookVocabItems)}
    ${renderLibrarySection("最近练习", practiceAttempts.slice(0, 6), (item) => ({
      main: `${practiceModeLabel(item.mode)} · ${Math.round(Number(item.score ?? 0))} 分`,
      sub: item.expected || formatLibraryTime(item.createdAt)
    }))}
  `;
  panel.querySelector<HTMLButtonElement>(".yll-library-close")?.addEventListener("click", () => closeLibraryPanel());
  panel.querySelector<HTMLSelectElement>("[data-wordbook-select]")?.addEventListener("change", (event) => {
    const select = event.currentTarget as HTMLSelectElement;
    runtime.__yllSafeSelectedWordbookId = select.value || undefined;
    renderLibraryPanel(panel, library);
  });
  panel.querySelector<HTMLButtonElement>("[data-wordbook-create]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const input = panel.querySelector<HTMLInputElement>("[data-wordbook-name]");
    const name = input?.value.trim() ?? "";
    if (!name) {
      if (input) input.focus();
      return;
    }
    const originalLabel = button.textContent ?? "新建";
    button.textContent = "创建中...";
    try {
      const response = await sendRuntimeMessage<LibraryWordbook>({ type: "CREATE_WORDBOOK", payload: { name } });
      if (!response?.ok) throw new Error(response?.error ?? "创建词本失败");
      runtime.__yllSafeSelectedWordbookId = response.data.id;
      const updated = await sendRuntimeMessage<LibrarySnapshot>({ type: "GET_LIBRARY" });
      if (!updated?.ok) throw new Error(updated?.error ?? "刷新词本失败");
      renderLibraryPanel(panel, updated.data ?? {});
    } catch (error) {
      button.textContent = `失败：${toErrorMessage(error).slice(0, 12)}`;
      window.setTimeout(() => {
        button.textContent = originalLabel;
      }, 1600);
    }
  });
  panel.querySelector<HTMLButtonElement>("[data-wordbook-export]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const filename = `youtube-language-lab-${safeFilename(selectedWordbook?.name ?? "wordbook")}-${dateSlug()}.csv`;
    downloadTextFile(filename, vocabToCsv(wordbookVocabItems, selectedWordbook), "text/csv;charset=utf-8");
    button.textContent = "已导出";
    window.setTimeout(() => {
      button.textContent = "导出词本";
    }, 1400);
  });
  panel.querySelector<HTMLButtonElement>("[data-wordbook-import]")?.addEventListener("click", () => {
    panel.querySelector<HTMLInputElement>("[data-wordbook-import-file]")?.click();
  });
  panel.querySelector<HTMLInputElement>("[data-wordbook-import-file]")?.addEventListener("change", async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const importButton = panel.querySelector<HTMLButtonElement>("[data-wordbook-import]");
    const originalLabel = importButton?.textContent ?? "导入单词";
    if (importButton) importButton.textContent = "导入中...";
    try {
      const items = parseVocabImport(await file.text(), file.name);
      const response = await sendRuntimeMessage<{ imported: number }>({
        type: "IMPORT_VOCAB",
        payload: { wordbookId: selectedWordbookId || undefined, items }
      });
      if (!response?.ok) throw new Error(response?.error ?? "导入失败");
      const updated = await sendRuntimeMessage<LibrarySnapshot>({ type: "GET_LIBRARY" });
      if (!updated?.ok) throw new Error(updated?.error ?? "刷新学习库失败");
      renderLibraryPanel(panel, updated.data ?? {});
      setStatus(`已导入 ${response.data.imported} 个单词。`);
    } catch (error) {
      if (importButton) {
        importButton.textContent = `失败：${toErrorMessage(error).slice(0, 12)}`;
        window.setTimeout(() => {
          importButton.textContent = originalLabel;
        }, 1800);
      }
    } finally {
      input.value = "";
    }
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-vocab-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = button.getAttribute("data-vocab-delete");
      if (!id) return;
      const originalLabel = button.textContent ?? "删除";
      button.disabled = true;
      button.textContent = "删除中";
      try {
        const response = await sendRuntimeMessage<{ deleted: boolean }>({ type: "DELETE_VOCAB", payload: { id } });
        if (!response?.ok) throw new Error(response?.error ?? "删除失败");
        const updated = await sendRuntimeMessage<LibrarySnapshot>({ type: "GET_LIBRARY" });
        if (!updated?.ok) throw new Error(updated?.error ?? "刷新学习库失败");
        renderLibraryPanel(panel, updated.data ?? {});
        setStatus(response.data.deleted ? "已删除单词。" : "单词已不存在。");
      } catch (error) {
        button.disabled = false;
        button.textContent = `失败`;
        button.title = toErrorMessage(error);
        window.setTimeout(() => {
          button.textContent = originalLabel;
          button.title = "";
        }, 1600);
      }
    });
  });
  panel.querySelector<HTMLButtonElement>("[data-library-export-json]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const originalLabel = button.textContent ?? "导出 JSON";
    button.textContent = "导出中...";
    try {
      const response = await sendRuntimeMessage<unknown>({ type: "EXPORT_DATA" });
      if (!response?.ok) throw new Error(response?.error ?? "导出失败");
      downloadTextFile(`youtube-language-lab-${dateSlug()}.json`, JSON.stringify(response.data, null, 2), "application/json");
      button.textContent = "已导出";
    } catch (error) {
      button.textContent = `失败：${toErrorMessage(error).slice(0, 18)}`;
      window.setTimeout(() => {
        button.textContent = originalLabel;
      }, 1800);
    }
  });
  panel.querySelector<HTMLButtonElement>("[data-library-export-csv]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    downloadTextFile(`youtube-language-lab-library-${dateSlug()}.csv`, libraryToCsv({ wordbooks, vocabItems, sentenceNotes, practiceAttempts }), "text/csv;charset=utf-8");
    button.textContent = "已导出 CSV";
    window.setTimeout(() => {
      button.textContent = "导出 CSV";
    }, 1400);
  });
  panel.querySelector<HTMLButtonElement>("[data-library-export-anki]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    downloadTextFile(`youtube-language-lab-anki-${dateSlug()}.csv`, sentenceNotesToAnkiCsv(sentenceNotes), "text/csv;charset=utf-8");
    button.textContent = "已导出 Anki";
    window.setTimeout(() => {
      button.textContent = "导出 Anki";
    }, 1400);
  });
  panel.querySelector<HTMLButtonElement>("[data-library-practice-sentences]")?.addEventListener("click", () => {
    const practiceRows = sentenceNotesToPracticeRows(sentenceNotes);
    if (!practiceRows.length) return;
    closeLibraryPanel();
    openPracticeOverlay(practiceRows, 0);
  });
}

function sentenceNotesToPracticeRows(sentenceNotes: LibrarySentence[]) {
  return sentenceNotes
    .filter((item) => item.text?.trim())
    .map((item, index) => ({
      startMs: Number.isFinite(item.startMs) ? Number(item.startMs) : index * 3000,
      durationMs: Math.max(900, Number(item.durationMs ?? 2600)),
      text: item.text ?? "",
      translatedText: item.translatedText,
      source: "official" as const
    }));
}

function dateSlug(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function csvEscape(value: unknown) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvLine(values: unknown[]) {
  return values.map(csvEscape).join(",");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function libraryToCsv(library: { vocabItems: LibraryVocab[]; sentenceNotes: LibrarySentence[]; practiceAttempts: LibraryAttempt[]; wordbooks?: LibraryWordbook[] }) {
  const wordbookNameById = new Map((library.wordbooks ?? []).map((wordbook) => [wordbook.id, wordbook.name]));
  const rows: string[] = [
    csvLine(["type", "wordbook", "text", "translation_or_meaning", "mode", "score", "video_id", "cue_id", "start_ms", "duration_ms", "created_at"])
  ];
  library.sentenceNotes.forEach((item) => {
    rows.push(csvLine([
      "sentence",
      "",
      item.text,
      item.translatedText,
      "",
      "",
      item.videoId,
      item.cueId,
      item.startMs,
      item.durationMs,
      item.createdAt
    ]));
  });
  library.vocabItems.forEach((item) => {
    rows.push(csvLine([
      "vocab",
      wordbookNameById.get(item.wordbookId ?? "") ?? "默认词本",
      item.text,
      item.meaning || item.translatedSentence || item.sourceSentence,
      "",
      item.mastery,
      item.videoId,
      item.cueId,
      "",
      "",
      item.createdAt
    ]));
  });
  library.practiceAttempts.forEach((item) => {
    rows.push(csvLine([
      "practice",
      "",
      item.expected,
      item.answer,
      practiceModeLabel(item.mode),
      item.score,
      "",
      item.cueId,
      "",
      item.durationMs,
      item.createdAt
    ]));
  });
  return `${rows.join("\n")}\n`;
}

function selectLibraryWordbook(wordbooks: LibraryWordbook[], vocabItems: LibraryVocab[]) {
  const selectedId = runtime.__yllSafeSelectedWordbookId;
  const selected = selectedId ? wordbooks.find((item) => item.id === selectedId) : undefined;
  if (selected) return selected;
  const defaultWordbook = wordbooks.find((item) => item.name === "默认词本") ?? wordbooks[0];
  if (defaultWordbook) return defaultWordbook;
  if (!vocabItems.length) return undefined;
  return { id: "", name: "默认词本" };
}

function vocabToCsv(vocabItems: LibraryVocab[], wordbook?: LibraryWordbook) {
  const rows = [
    csvLine(["wordbook", "text", "meaning", "language", "source_sentence", "translated_sentence", "mastery", "created_at"]),
    ...vocabItems.map((item) => csvLine([
      wordbook?.name ?? "默认词本",
      item.text,
      item.meaning,
      item.language ?? "en",
      item.sourceSentence,
      item.translatedSentence,
      item.mastery,
      item.createdAt
    ]))
  ];
  return `${rows.join("\n")}\n`;
}

function safeFilename(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 48) || "wordbook";
}

function parseVocabImport(content: string, filename: string): Array<{ text: string; language: string; meaning?: string; sourceSentence?: string; translatedSentence?: string }> {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) throw new Error("JSON 必须是单词数组。");
    return parsed.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        text: String(record.text ?? record.word ?? "").trim(),
        language: String(record.language ?? "en"),
        meaning: record.meaning === undefined ? undefined : String(record.meaning),
        sourceSentence: record.sourceSentence === undefined ? undefined : String(record.sourceSentence),
        translatedSentence: record.translatedSentence === undefined ? undefined : String(record.translatedSentence)
      };
    }).filter((item) => item.text);
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const header = splitCsvLine(lines[0]).map((item) => item.trim().toLowerCase());
  const hasHeader = header.includes("text") || header.includes("word");
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const indexOf = (names: string[], fallback: number) => {
    const index = names.map((name) => header.indexOf(name)).find((index) => index >= 0);
    return index ?? fallback;
  };
  const textIndex = hasHeader ? indexOf(["text", "word", "单词"], 0) : 0;
  const meaningIndex = hasHeader ? indexOf(["meaning", "translation", "释义"], 1) : 1;
  const languageIndex = hasHeader ? indexOf(["language", "lang"], 2) : 2;
  const sourceIndex = hasHeader ? indexOf(["source_sentence", "sourcesentence", "sentence"], 3) : 3;
  const translatedIndex = hasHeader ? indexOf(["translated_sentence", "translatedsentence"], 4) : 4;

  return dataLines.map((line) => {
    const cells = splitCsvLine(line);
    return {
      text: (cells[textIndex] ?? "").trim(),
      meaning: cells[meaningIndex]?.trim() || undefined,
      language: cells[languageIndex]?.trim() || "en",
      sourceSentence: cells[sourceIndex]?.trim() || undefined,
      translatedSentence: cells[translatedIndex]?.trim() || undefined
    };
  }).filter((item) => item.text);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function sentenceNotesToAnkiCsv(sentenceNotes: LibrarySentence[]) {
  const rows = sentenceNotes
    .filter((item) => item.text?.trim())
    .map((item) => csvLine([
      item.text,
      item.translatedText ?? "",
      item.videoId ?? "",
      item.startMs === undefined ? "" : formatClock(Number(item.startMs))
    ]));
  return `${csvLine(["Front", "Back", "Video", "Time"])}\n${rows.join("\n")}\n`;
}

function sortLibraryItems<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

function renderLibrarySection<T>(title: string, items: T[], render: (item: T) => { main: string; sub?: string }) {
  const body = items.length
    ? items.map((item) => {
      const rendered = render(item);
      return `
        <div class="yll-library-item">
          <div class="yll-library-item-text">
            <div class="yll-library-main">${escapeHtml(rendered.main || "未命名")}</div>
            ${rendered.sub ? `<div class="yll-library-sub">${escapeHtml(rendered.sub)}</div>` : ""}
          </div>
        </div>
      `;
    }).join("")
    : `<div class="yll-library-empty">暂无记录</div>`;
  return `
    <section class="yll-library-section">
      <h4>${escapeHtml(title)}</h4>
      ${body}
    </section>
  `;
}

function renderVocabLibrarySection(title: string, items: LibraryVocab[]) {
  const body = items.length
    ? items.map((item) => `
      <div class="yll-library-item">
        <div class="yll-library-item-text">
          <div class="yll-library-main">${escapeHtml(item.text || "未命名")}</div>
          <div class="yll-library-sub">${escapeHtml(item.meaning || item.sourceSentence || formatLibraryTime(item.createdAt))}</div>
        </div>
        <button class="yll-library-delete" type="button" data-vocab-delete="${escapeHtml(item.id)}">删除</button>
      </div>
    `).join("")
    : `<div class="yll-library-empty">暂无记录</div>`;
  return `
    <section class="yll-library-section">
      <h4>${escapeHtml(title)}</h4>
      ${body}
    </section>
  `;
}

function formatLibraryTime(value?: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function practiceModeLabel(mode?: string) {
  if (mode === "shadowing") return "跟读";
  if (mode === "dictation") return "听写";
  if (mode === "cloze") return "填空";
  if (mode === "quiz") return "理解";
  return "练习";
}

function toggleDebugPanel() {
  const existing = document.getElementById(DEBUG_PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }
  const panel = document.createElement("section");
  panel.id = DEBUG_PANEL_ID;
  (document.getElementById(PANEL_ID) ?? document.documentElement).appendChild(panel);
  renderDebugPanel();
}

function renderDebugPanel() {
  const panel = document.getElementById(DEBUG_PANEL_ID);
  if (!panel) return;
  const snapshot = debugSnapshot();
  const text = JSON.stringify(snapshot, null, 2);
  panel.innerHTML = `
    <div class="yll-debug-head">
      <strong>字幕诊断日志</strong>
      <button class="yll-debug-copy" type="button" data-copy-debug>复制日志</button>
    </div>
    <code>${escapeHtml(text)}</code>
  `;
  panel.querySelector<HTMLButtonElement>("[data-copy-debug]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "已复制";
    } catch {
      const range = document.createRange();
      const code = panel.querySelector("code");
      if (code) {
        range.selectNodeContents(code);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      button.textContent = "已选中";
    }
    window.setTimeout(() => {
      button.textContent = "复制日志";
    }, 1400);
  });
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
  popover.addEventListener("click", (event) => event.stopPropagation());
  popover.addEventListener("mousedown", (event) => event.stopPropagation());
  document.documentElement.appendChild(popover);
  document.addEventListener("click", (event) => {
    if (!popover || popover.hidden) return;
    const target = event.target as Element | null;
    if (target?.closest(`#${WORD_POPOVER_ID}`) || target?.closest(`#${PANEL_ID}`)) return;
    popover.hidden = true;
  });
  return popover;
}

function showWordPopover(word: string, message: string, options: { canSave?: boolean; startMs?: number; meaning?: string; anchor?: DOMRect } = {}) {
  const popover = mountWordPopover();
  popover.hidden = false;
  positionWordPopover(popover, options.anchor);
  popover.innerHTML = `
    <strong>${escapeHtml(word)}</strong>
    <p>${escapeHtml(message)}</p>
    ${options.canSave ? `<button type="button" data-save-vocab data-word="${escapeHtml(word)}" data-start="${options.startMs ?? 0}" data-meaning="${escapeHtml(options.meaning ?? "")}">收藏单词</button>` : ""}
  `;
  popover.querySelector<HTMLElement>("[data-save-vocab]")?.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget as HTMLElement;
    button.textContent = "保存中...";
    const result = await saveVocabulary(button.dataset.word ?? word, Number(button.dataset.start ?? "0"), button.dataset.meaning ?? options.meaning ?? "");
    button.textContent = result ? "已收藏" : "收藏失败";
  });
}

function positionWordPopover(popover: HTMLElement, anchor?: DOMRect) {
  if (!anchor) {
    popover.style.left = "";
    popover.style.top = "";
    popover.style.right = "394px";
    popover.style.width = "";
    return;
  }
  const width = Math.min(260, Math.max(220, window.innerWidth - 24));
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, anchor.left + anchor.width / 2 - width / 2));
  const top = Math.max(12, anchor.top - 12 - 88);
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.right = "auto";
}

function showSentenceInsight(cue: LabCue) {
  const popover = mountWordPopover();
  popover.hidden = false;
  popover.innerHTML = `
    <strong>句子讲解</strong>
    <p>${escapeHtml(cue.text)}</p>
    ${renderSentenceInsightHtml(cue, "popover")}
  `;
}

function renderSentenceInsightHtml(cue: LabCue, variant: "popover" | "row" = "row") {
  const insight = buildSentenceInsight(cue);
  if (variant === "popover") {
    return `
      ${cue.translatedText ? `<div class="yll-insight-block"><div class="yll-insight-title">译文</div><p>${escapeHtml(cue.translatedText)}</p></div>` : ""}
      <div class="yll-insight-block">
        <div class="yll-insight-title">结构</div>
        <p>${escapeHtml(insight.structure)}</p>
      </div>
      <div class="yll-insight-block">
        <div class="yll-insight-title">重点词</div>
        ${insight.keywords.length
          ? `<ul class="yll-insight-list">${insight.keywords.map((word) => `<li>${escapeHtml(word)}</li>`).join("")}</ul>`
          : `<p>这句以常用词为主，适合做跟读节奏练习。</p>`}
      </div>
      <div class="yll-insight-block">
        <div class="yll-insight-title">跟读提示</div>
        <p>${escapeHtml(insight.shadowingTip)}</p>
      </div>
    `;
  }
  return `
    ${cue.translatedText ? `<strong>译文</strong><div>${escapeHtml(cue.translatedText)}</div>` : ""}
    <strong>结构</strong><div>${escapeHtml(insight.structure)}</div>
    <strong>重点词</strong>
    ${insight.keywords.length
      ? `<ul>${insight.keywords.map((word) => `<li>${escapeHtml(word)}</li>`).join("")}</ul>`
      : `<div>这句以常用词为主，适合做跟读节奏练习。</div>`}
    <strong>跟读提示</strong><div>${escapeHtml(insight.shadowingTip)}</div>
  `;
}

function buildSentenceInsight(cue: LabCue) {
  const text = cleanText(cue.text);
  const words = normalizedWords(text);
  const keywords = sentenceKeywords(words);
  const structureParts: string[] = [];
  if (/\?$/.test(text)) structureParts.push("疑问句，注意句尾语调和问题核心。");
  if (/\b(because|since|as)\b/i.test(text)) structureParts.push("包含原因关系，可以先找 because/since/as 后面的原因。");
  if (/\b(but|however|although|though)\b/i.test(text)) structureParts.push("包含转折关系，转折后的内容通常是重点。");
  if (/\b(if|when|while|after|before)\b/i.test(text)) structureParts.push("包含时间或条件从句，可以按从句和主句分块理解。");
  if (/\b(to|for)\b/i.test(text) && words.length >= 8) structureParts.push("可能包含目的或补充说明，朗读时可在短语前后微停顿。");
  if (!structureParts.length) {
    structureParts.push(words.length > 12 ? "较长陈述句，建议按意群分两到三段理解。" : "短句，先抓主语、动作和关键词。");
  }
  const durationSeconds = Math.max(0.8, cue.durationMs / 1000);
  const rate = words.length / durationSeconds;
  const shadowingTip = rate > 3.2
    ? "语速偏快，先慢速跟读，再回到原速。"
    : rate < 1.8
      ? "语速较稳，适合模仿重音和停顿。"
      : "语速适中，跟读时重点保持连读和自然停顿。";
  return {
    structure: structureParts.join(" "),
    keywords,
    shadowingTip
  };
}

function sentenceKeywords(words: string[]) {
  const stopWords = new Set([
    "a", "an", "the", "to", "of", "in", "on", "at", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
    "do", "does", "did", "it", "this", "that", "these", "those", "we", "you", "i", "he", "she", "they", "my", "our", "your",
    "for", "with", "as", "by", "from", "so", "if", "when", "what", "why", "how", "about", "into", "out", "up", "down"
  ]);
  return Array.from(new Set(words
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 3 && !stopWords.has(word))))
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);
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
    <div class="yll-settings-head">
      <h3>视频字幕</h3>
      <button class="yll-settings-close" type="button" data-settings-close>关闭</button>
    </div>
    <h4>字幕功能</h4>
    <label>
      <span>隐藏 YouTube 原生字幕</span>
      <input type="checkbox" data-setting="hideNativeCaptions" ${settings.hideNativeCaptions ? "checked" : ""}>
    </label>
    <label>
      <span>显示中文译文</span>
      <input type="checkbox" data-setting="showTranslations" ${settings.showTranslations ? "checked" : ""}>
    </label>
    <label>
      <span>字幕模式</span>
      <select data-setting="subtitleMode">
        <option value="dual" ${settings.subtitleMode === "dual" ? "selected" : ""}>双语字幕</option>
        <option value="source" ${settings.subtitleMode === "source" ? "selected" : ""}>主字幕</option>
        <option value="translation" ${settings.subtitleMode === "translation" ? "selected" : ""}>翻译字幕</option>
      </select>
    </label>
    <h4>位置与背景</h4>
    <label>
      <span>字幕位置</span>
      <span><input type="range" min="50" max="94" step="1" data-setting="overlayPositionPercent" value="${settings.overlayPositionPercent}"> <span class="yll-setting-value">${settings.overlayPositionPercent}%</span></span>
    </label>
    <label>
      <span>同步校准</span>
      <span><input type="range" min="-2000" max="2000" step="50" data-setting="syncOffsetMs" value="${settings.syncOffsetMs}"> <span class="yll-setting-value">${settings.syncOffsetMs}ms</span></span>
    </label>
    <label>
      <span>逐词校准</span>
      <span><input type="range" min="-1500" max="1500" step="50" data-setting="wordHighlightOffsetMs" value="${settings.wordHighlightOffsetMs}"> <span class="yll-setting-value">${settings.wordHighlightOffsetMs}ms</span></span>
    </label>
    <label>
      <span>背景透明度</span>
      <span><input type="range" min="20" max="95" step="1" data-setting="overlayBackgroundOpacity" value="${settings.overlayBackgroundOpacity}"> <span class="yll-setting-value">${settings.overlayBackgroundOpacity}%</span></span>
    </label>
    <label>
      <span>逐词高亮</span>
      <input type="checkbox" data-setting="highlightCurrentWord" ${settings.highlightCurrentWord ? "checked" : ""}>
    </label>
    <h4>原字幕样式</h4>
    <label>
      <span>原文字号</span>
      <span><input type="range" min="16" max="42" step="1" data-setting="overlayFontSize" value="${settings.overlayFontSize}"> <span class="yll-setting-value">${settings.overlayFontSize}px</span></span>
    </label>
    <label>
      <span>原文字体</span>
      <select data-setting="sourceFontFamily">
        <option value="system-ui" ${settings.sourceFontFamily === "system-ui" ? "selected" : ""}>system</option>
        <option value="sans-serif" ${settings.sourceFontFamily === "sans-serif" ? "selected" : ""}>sans-serif</option>
        <option value="serif" ${settings.sourceFontFamily === "serif" ? "selected" : ""}>serif</option>
        <option value="monospace" ${settings.sourceFontFamily === "monospace" ? "selected" : ""}>monospace</option>
      </select>
    </label>
    <h4>译文样式</h4>
    <label>
      <span>译文字号</span>
      <span><input type="range" min="14" max="36" step="1" data-setting="translationFontSize" value="${settings.translationFontSize}"> <span class="yll-setting-value">${settings.translationFontSize}px</span></span>
    </label>
    <label>
      <span>译文字体</span>
      <select data-setting="translationFontFamily">
        <option value="system-ui" ${settings.translationFontFamily === "system-ui" ? "selected" : ""}>system</option>
        <option value="sans-serif" ${settings.translationFontFamily === "sans-serif" ? "selected" : ""}>sans-serif</option>
        <option value="serif" ${settings.translationFontFamily === "serif" ? "selected" : ""}>serif</option>
        <option value="monospace" ${settings.translationFontFamily === "monospace" ? "selected" : ""}>monospace</option>
      </select>
    </label>
  `;
}

function bindSettingsPanel(panel: HTMLElement) {
  panel.querySelector<HTMLButtonElement>("[data-settings-close]")?.addEventListener("click", () => {
    panel.remove();
  });
  panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[data-setting], select[data-setting]").forEach((input) => {
    input.addEventListener("input", () => {
      const current = loadSafeSettings();
      const key = input.dataset.setting as keyof SafeSettings;
      const next: SafeSettings = { ...current };
      if (input.type === "checkbox") {
        (next[key] as boolean | number | string) = (input as HTMLInputElement).checked;
      } else if (input instanceof HTMLSelectElement) {
        (next[key] as boolean | number | string) = input.value;
      } else {
        (next[key] as boolean | number | string) = Number(input.value);
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
  const activeCue = rows.find((cue) => cueKey(cue) === activeKey);
  if (activeCue) return activeCue;
  const video = getMainVideo();
  if (video) return selectActiveCue(rows, syncedCurrentMs(video, loadSafeSettings())) ?? rows[0];
  return rows[0];
}

async function saveSentenceNote(cue: LabCue) {
  const videoId = getVideoId();
  if (!videoId) return false;
  const response = await sendRuntimeMessage({
    type: "SAVE_SENTENCE",
    payload: {
      videoId,
      cueId: cueKey(cue),
      text: cue.text,
      translatedText: cue.translatedText,
      language: "en",
      startMs: cue.startMs,
      durationMs: cue.durationMs,
      isFavorite: true
    }
  });
  return Boolean(response?.ok);
}

async function saveVocabulary(word: string, startMs: number, meaning?: string) {
  const cue = (runtime.__yllSafeRows ?? [])
    .slice()
    .sort((a, b) => Math.abs(a.startMs - startMs) - Math.abs(b.startMs - startMs))[0];
  const response = await sendRuntimeMessage({
    type: "SAVE_VOCAB",
    payload: {
      text: cleanText(word).slice(0, 64),
      language: "en",
      wordbookId: runtime.__yllSafeSelectedWordbookId,
      meaning: meaning || undefined,
      sourceSentence: cue?.text,
      translatedSentence: cue?.translatedText,
      videoId: getVideoId() || undefined,
      cueId: cue ? cueKey(cue) : undefined
    }
  });
  return Boolean(response?.ok);
}

async function savePracticeAttempt(cue: LabCue, mode: "shadowing" | "dictation" | "cloze" | "quiz", score: number, durationMs: number, answer?: string, speechScore?: LocalSpeechScore) {
  const response = await sendRuntimeMessage({
    type: "SAVE_PRACTICE_ATTEMPT",
    payload: {
      practiceItemId: `video:${getVideoId() || "current"}:${cueKey(cue)}`,
      cueId: cueKey(cue),
      mode,
      answer,
      expected: cue.text,
      score,
      speechScore,
      durationMs
    }
  });
  return Boolean(response?.ok);
}

function sortedPracticeRows() {
  return [...(runtime.__yllSafeRows ?? [])].sort((a, b) => a.startMs - b.startMs);
}

function currentCueIndex(rows: LabCue[], cue: LabCue) {
  const key = cueKey(cue);
  return Math.max(0, rows.findIndex((row) => cueKey(row) === key));
}

function clozeText(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4) return text.replace(/\S+/, "____");
  return words.map((word, index) => (index % 5 === 2 ? "____" : word)).join(" ");
}

function clozeAnswers(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4) return words.slice(0, 1).map(cleanAnswerToken);
  return words.filter((_, index) => index % 5 === 2).map(cleanAnswerToken).filter(Boolean);
}

function cleanAnswerToken(text: string) {
  return text.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function compareDictation(expected: string, actual: string) {
  const expectedWords = normalizedWords(expected);
  const actualWords = normalizedWords(actual);
  if (!expectedWords.length || !actualWords.length) return 0;
  const expectedSet = new Set(expectedWords);
  const matched = actualWords.filter((word) => expectedSet.has(word)).length;
  return Math.round(Math.min(100, (matched / expectedWords.length) * 100));
}

function renderDictationDiff(expected: string, actual: string) {
  const actualWords = new Set(normalizedWords(actual));
  return normalizedWords(expected)
    .map((word) => `<span class="yll-practice-token ${actualWords.has(word) ? "hit" : "miss"}">${escapeHtml(word)}</span>`)
    .join("");
}

type LocalSpeechScore = {
  pronunciation: number;
  fluency: number;
  completeness: number;
  semanticMatch: number;
  overall: number;
  transcript?: string;
  feedback: string;
  improvements: string[];
  provider: "local";
};

function localShadowingScore(expected: string, recordingDurationMs: number): LocalSpeechScore {
  const expectedSeconds = Math.max(1.6, normalizedWords(expected).length * 0.48);
  const durationSeconds = Math.max(0.1, recordingDurationMs / 1000);
  const durationRatio = Math.min(durationSeconds, expectedSeconds) / Math.max(durationSeconds, expectedSeconds);
  const fluency = Math.round(Math.max(35, Math.min(100, durationRatio * 100)));
  const completeness = Math.round(Math.max(40, Math.min(95, durationRatio * 92)));
  const pronunciation = Math.round((fluency + completeness) / 2);
  const semanticMatch = Math.round(Math.max(45, Math.min(90, durationRatio * 86)));
  const overall = Math.round(pronunciation * 0.3 + fluency * 0.25 + completeness * 0.25 + semanticMatch * 0.2);
  return {
    pronunciation,
    fluency,
    completeness,
    semanticMatch,
    overall,
    provider: "local",
    feedback: "已根据录音时长和目标句长度生成本地跟读评分。后续接入 AI 后可提供发音细节。",
    improvements: [
      "先播放当前句，模仿停顿和重音后再录第二遍。",
      "如果分数偏低，优先让录音时长接近原句时长。"
    ]
  };
}

function renderSpeechScore(score: LocalSpeechScore) {
  return `
    <div class="yll-practice-score-grid">
      <div class="yll-practice-score-card">总分<strong>${score.overall}</strong></div>
      <div class="yll-practice-score-card">发音<strong>${score.pronunciation}</strong></div>
      <div class="yll-practice-score-card">流利<strong>${score.fluency}</strong></div>
      <div class="yll-practice-score-card">完整<strong>${score.completeness}</strong></div>
    </div>
  `;
}

function quizOptions(rows: LabCue[], cue: LabCue) {
  const candidates = rows
    .filter((row) => row.translatedText && cueKey(row) !== cueKey(cue))
    .sort((a, b) => Math.abs(a.startMs - cue.startMs) - Math.abs(b.startMs - cue.startMs))
    .slice(0, 2)
    .map((row) => row.translatedText?.trim() ?? "");
  const answer = cue.translatedText?.trim() || cue.text;
  return [answer, ...candidates]
    .filter((text, index, all) => text && all.indexOf(text) === index)
    .sort((a, b) => a.localeCompare(b));
}

function openPracticeOverlay(practiceRows?: LabCue[], startIndex = 0) {
  const rows = (practiceRows?.length ? practiceRows : sortedPracticeRows()).sort((a, b) => a.startMs - b.startMs);
  const initialCue = practiceRows?.[startIndex] ?? currentCue();
  if (!initialCue || !rows.length) {
    setStatus("还没有可练习的字幕句子。");
    return;
  }
  const video = getMainVideo();
  video?.pause();
  document.getElementById(PRACTICE_ID)?.remove();
  const overlay = document.createElement("section");
  overlay.id = PRACTICE_ID;
  let index = Math.min(rows.length - 1, Math.max(0, practiceRows?.length ? startIndex : currentCueIndex(rows, initialCue)));
  let mode: "shadowing" | "dictation" | "cloze" | "quiz" = "shadowing";
  let recorder: MediaRecorder | undefined;
  let recordingStartedAt = 0;
  let recordingChunks: Blob[] = [];

  const replayCue = () => {
    const cue = rows[index];
    const player = getMainVideo();
    if (!player) return;
    player.currentTime = cue.startMs / 1000;
    void player.play();
    const stopAt = (cue.startMs + Math.max(cue.durationMs, MIN_OVERLAY_DURATION_MS)) / 1000;
    const timer = window.setInterval(() => {
      if (!player || player.paused || player.currentTime < stopAt) return;
      player.pause();
      window.clearInterval(timer);
    }, 120);
  };

  const stopRecordingTracks = () => {
    recorder?.stream.getTracks().forEach((track) => track.stop());
    recorder = undefined;
    recordingChunks = [];
    recordingStartedAt = 0;
  };

  const renderPractice = () => {
    const cue = rows[index];
    const options = quizOptions(rows, cue);
    const clozeExpected = clozeAnswers(cue.text);
    overlay.innerHTML = `
      <div class="yll-practice-card">
        <header class="yll-practice-head">
          <div>
            <h2>全屏混合练习</h2>
            <span>${formatClock(cue.startMs)} · ${index + 1} / ${rows.length}</span>
          </div>
          <button type="button" data-practice-close>关闭</button>
        </header>
        <main>
          <div class="yll-practice-tabs">
            <button type="button" data-practice-mode="shadowing" class="${mode === "shadowing" ? "is-active" : ""}">跟读</button>
            <button type="button" data-practice-mode="dictation" class="${mode === "dictation" ? "is-active" : ""}">听写</button>
            <button type="button" data-practice-mode="cloze" class="${mode === "cloze" ? "is-active" : ""}">填空</button>
            <button type="button" data-practice-mode="quiz" class="${mode === "quiz" ? "is-active" : ""}">理解选择</button>
          </div>
          <div class="yll-practice-prompt">${practicePrompt(mode)}</div>
          <div class="yll-practice-sentence" data-practice-sentence>${escapeHtml(mode === "cloze" ? clozeText(cue.text) : cue.text)}</div>
          <div class="yll-practice-translation">${escapeHtml(cue.translatedText ?? "译文生成后会显示在这里")}</div>
          ${mode === "dictation" ? `<textarea data-practice-answer placeholder="输入你听到的完整句子"></textarea>` : ""}
          ${mode === "cloze" ? `<input data-practice-cloze-answer placeholder="输入空格答案，多个答案用空格分隔">` : ""}
          ${mode === "quiz" ? `<div class="yll-practice-options">${options.map((option) => `<button class="yll-practice-option" type="button" data-practice-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("")}</div>` : ""}
          <div class="yll-practice-feedback" data-practice-feedback></div>
          <div class="yll-practice-diff" data-practice-diff></div>
        </main>
        <footer class="yll-practice-actions">
          <button type="button" data-practice-prev>上一句</button>
          <button class="primary" type="button" data-practice-replay>播放当前句</button>
          ${mode === "shadowing" ? `<button type="button" data-practice-record>开始录音</button><button type="button" data-practice-stop-record disabled>停止并保存</button>` : ""}
          <button type="button" data-practice-next>下一句</button>
          <button type="button" data-practice-save>收藏当前句</button>
          ${mode === "dictation" ? `<button type="button" data-practice-check>检查听写</button>` : ""}
          ${mode === "cloze" ? `<button type="button" data-practice-check-cloze>检查填空</button><button type="button" data-practice-reveal>显示答案</button>` : ""}
        </footer>
      </div>
    `;

    overlay.querySelector<HTMLElement>("[data-practice-close]")?.addEventListener("click", () => overlay.remove());
    overlay.querySelector<HTMLElement>("[data-practice-close]")?.addEventListener("click", stopRecordingTracks);
    overlay.querySelector<HTMLElement>("[data-practice-replay]")?.addEventListener("click", replayCue);
    overlay.querySelector<HTMLButtonElement>("[data-practice-record]")?.addEventListener("click", async (event) => {
      const startButton = event.currentTarget as HTMLButtonElement;
      const stopButton = overlay.querySelector<HTMLButtonElement>("[data-practice-stop-record]");
      const feedback = overlay.querySelector<HTMLElement>("[data-practice-feedback]");
      const diff = overlay.querySelector<HTMLElement>("[data-practice-diff]");
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
          if (feedback) feedback.textContent = "当前浏览器暂不支持录音。";
          return;
        }
        stopRecordingTracks();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        recordingChunks = [];
        recordingStartedAt = Date.now();
        recorder.addEventListener("dataavailable", (recordEvent) => {
          if (recordEvent.data.size > 0) recordingChunks.push(recordEvent.data);
        });
        recorder.start();
        startButton.disabled = true;
        if (stopButton) stopButton.disabled = false;
        if (feedback) feedback.textContent = "录音中，请跟读当前句。";
        if (diff) diff.innerHTML = "";
      } catch (error) {
        stopRecordingTracks();
        if (feedback) feedback.textContent = `麦克风不可用：${toErrorMessage(error)}`;
      }
    });
    overlay.querySelector<HTMLButtonElement>("[data-practice-stop-record]")?.addEventListener("click", async (event) => {
      const stopButton = event.currentTarget as HTMLButtonElement;
      const startButton = overlay.querySelector<HTMLButtonElement>("[data-practice-record]");
      const feedback = overlay.querySelector<HTMLElement>("[data-practice-feedback]");
      const diff = overlay.querySelector<HTMLElement>("[data-practice-diff]");
      if (!recorder || recorder.state === "inactive") {
        if (feedback) feedback.textContent = "还没有正在进行的录音。";
        return;
      }
      stopButton.disabled = true;
      const activeRecorder = recorder;
      const durationMs = Math.max(0, Date.now() - recordingStartedAt);
      await new Promise<void>((resolve) => {
        activeRecorder.addEventListener("stop", () => resolve(), { once: true });
        activeRecorder.stop();
      });
      const score = localShadowingScore(cue.text, durationMs);
      const saved = await savePracticeAttempt(cue, "shadowing", score.overall, durationMs, undefined, score);
      activeRecorder.stream.getTracks().forEach((track) => track.stop());
      recorder = undefined;
      recordingChunks = [];
      if (startButton) startButton.disabled = false;
      if (feedback) feedback.textContent = saved ? `${score.feedback} 已保存练习记录。` : `${score.feedback} 练习记录保存失败。`;
      if (diff) diff.innerHTML = renderSpeechScore(score);
    });
    overlay.querySelector<HTMLElement>("[data-practice-save]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget as HTMLElement;
      button.textContent = "保存中...";
      button.textContent = await saveSentenceNote(cue) ? "已收藏" : "收藏失败";
    });
    overlay.querySelector<HTMLElement>("[data-practice-prev]")?.addEventListener("click", () => {
      stopRecordingTracks();
      index = Math.max(0, index - 1);
      renderPractice();
    });
    overlay.querySelector<HTMLElement>("[data-practice-next]")?.addEventListener("click", () => {
      stopRecordingTracks();
      index = Math.min(rows.length - 1, index + 1);
      renderPractice();
    });
    overlay.querySelectorAll<HTMLElement>("[data-practice-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        stopRecordingTracks();
        mode = (button.dataset.practiceMode as typeof mode) || "shadowing";
        renderPractice();
      });
    });
    overlay.querySelector<HTMLElement>("[data-practice-check]")?.addEventListener("click", async () => {
      const answer = overlay.querySelector<HTMLTextAreaElement>("[data-practice-answer]")?.value ?? "";
      const score = compareDictation(cue.text, answer);
      const feedback = overlay.querySelector<HTMLElement>("[data-practice-feedback]");
      const diff = overlay.querySelector<HTMLElement>("[data-practice-diff]");
      let saved = false;
      if (answer.trim()) saved = await savePracticeAttempt(cue, "dictation", score, 0, answer);
      if (feedback) feedback.textContent = answer.trim() ? `听写匹配度 ${score}%${saved ? "，已保存练习记录。" : "。"}` : "先输入你听到的句子。";
      if (diff) diff.innerHTML = answer.trim() ? renderDictationDiff(cue.text, answer) : "";
    });
    overlay.querySelector<HTMLElement>("[data-practice-check-cloze]")?.addEventListener("click", async () => {
      const answer = overlay.querySelector<HTMLInputElement>("[data-practice-cloze-answer]")?.value ?? "";
      const actual = normalizedWords(answer);
      const expected = clozeExpected;
      const correct = expected.length > 0 && expected.every((word, answerIndex) => actual[answerIndex] === word);
      const feedback = overlay.querySelector<HTMLElement>("[data-practice-feedback]");
      const diff = overlay.querySelector<HTMLElement>("[data-practice-diff]");
      const score = correct ? 100 : Math.round((expected.filter((word, answerIndex) => actual[answerIndex] === word).length / Math.max(1, expected.length)) * 100);
      let saved = false;
      if (answer.trim()) saved = await savePracticeAttempt(cue, "cloze", score, 0, answer);
      if (feedback) {
        feedback.textContent = answer.trim()
          ? correct ? `填空正确。${saved ? "已保存练习记录。" : ""}` : `还差一点，正确答案：${expected.join(" / ")}${saved ? "。已保存练习记录。" : ""}`
          : "先输入空格答案。";
      }
      if (diff) {
        diff.innerHTML = expected
          .map((word, answerIndex) => `<span class="yll-practice-token ${actual[answerIndex] === word ? "hit" : "miss"}">${escapeHtml(word)}</span>`)
          .join("");
      }
    });
    overlay.querySelector<HTMLElement>("[data-practice-reveal]")?.addEventListener("click", () => {
      const sentence = overlay.querySelector<HTMLElement>("[data-practice-sentence]");
      if (sentence) sentence.textContent = cue.text;
      const feedback = overlay.querySelector<HTMLElement>("[data-practice-feedback]");
      if (feedback) feedback.textContent = `答案：${clozeExpected.join(" / ")}`;
    });
    overlay.querySelectorAll<HTMLElement>("[data-practice-option]").forEach((button) => {
      button.addEventListener("click", async () => {
        const feedback = overlay.querySelector<HTMLElement>("[data-practice-feedback]");
        const selected = button.dataset.practiceOption ?? "";
        const answer = cue.translatedText?.trim() || cue.text;
        const correct = selected === answer;
        const saved = await savePracticeAttempt(cue, "quiz", correct ? 100 : 0, 0, selected);
        if (feedback) {
          feedback.textContent = correct
            ? `选择正确。${saved ? "已保存练习记录。" : ""}`
            : `再试一次。正确含义：${answer}${saved ? "。已保存练习记录。" : ""}`;
        }
      });
    });
  };

  renderPractice();
  document.documentElement.appendChild(overlay);
}

function practicePrompt(mode: "shadowing" | "dictation" | "cloze" | "quiz") {
  if (mode === "dictation") return "听原声，写下完整句子，然后检查匹配度。";
  if (mode === "cloze") return "先根据上下文补全空格，再显示答案核对。";
  if (mode === "quiz") return "选择与当前原句匹配的中文含义。";
  return "播放当前句，跟读并尽量模仿节奏和重音。";
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
  const showSource = settings.subtitleMode !== "translation" || !translation;
  const showTranslation = Boolean(translation && settings.showTranslations && settings.subtitleMode !== "source");
  const translationText = showTranslation && translation ? translation : "";
  overlay.style.background = `rgba(0, 0, 0, ${settings.overlayBackgroundOpacity / 100})`;
  overlay.style.setProperty("--yll-source-font", cssFontFamily(settings.sourceFontFamily));
  overlay.style.setProperty("--yll-translation-font", cssFontFamily(settings.translationFontFamily));
  overlay.style.setProperty("--yll-translation-size", `${settings.translationFontSize}px`);
  overlay.innerHTML = `
    ${showSource ? `<span class="yll-overlay-source">${renderOverlaySourceText(cue, settings)}</span>` : ""}
    ${translationText ? `<span class="yll-overlay-translation">${escapeHtml(translationText)}</span>` : ""}
  `;
  bindOverlayWordEvents(overlay);
  overlay.classList.add("is-visible");
}

function bindOverlayWordEvents(overlay: HTMLElement) {
  overlay.querySelectorAll<HTMLElement>(".yll-overlay-word[data-word]").forEach((wordElement) => {
    const lookup = () => {
      const word = wordElement.dataset.word;
      if (!word) return;
      void lookupWord(word, wordElement.dataset.start, wordElement.getBoundingClientRect());
    };
    wordElement.addEventListener("mouseenter", lookup);
    wordElement.addEventListener("focus", lookup);
    wordElement.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      lookup();
    });
  });
}

function renderRows(rows: LabCue[]) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;

  const settings = loadSafeSettings();
  list.classList.toggle("hide-translations", !settings.showTranslations || settings.subtitleMode === "source");
  const sorted = [...rows].sort((a, b) => a.startMs - b.startMs);
  runtime.__yllSafeSuppressListScrollUntil = Date.now() + 800;
  runtime.__yllSafeLastManualListScrollAt = 0;
  if (!sorted.length) {
    const title = isYouTubeAdShowing()
      ? "广告播放中"
      : runtime.__yllSafeIsLoadingOfficial
        ? "正在读取官方字幕"
        : "还没有字幕";
    const detail = isYouTubeAdShowing()
      ? "插件字幕会在广告结束后恢复，右侧列表暂时保持为空。"
      : runtime.__yllSafeIsLoadingOfficial
        ? "正在等待 YouTube 字幕轨道返回；如果长时间没有结果，可以点击“重读字幕”。"
        : "当前视频还没有加载到可用字幕。请确认视频有字幕轨，或稍后点击“重读字幕”。";
    list.innerHTML = `<div class="yll-empty-state"><strong>${title}</strong>${detail}</div>`;
    return;
  }
  list.innerHTML = sorted
    .map((cue) => {
      const key = cueKey(cue);
      const activeClass = key === runtime.__yllSafeActiveKey ? " is-active" : "";
      const expanded = key === runtime.__yllSafeExpandedInsightKey;
      return `
        <div class="yll-row${activeClass}" role="button" tabindex="0" data-start="${cue.startMs}" data-key="${escapeHtml(key)}">
          <span class="yll-time">${formatClock(cue.startMs)}</span>
          <span>
            <span class="yll-text">${renderClickableText(cue.text)}</span>
            ${cue.translatedText ? `<span class="yll-translation">${escapeHtml(cue.translatedText)}</span>` : ""}
            <span class="yll-row-actions" aria-label="句子操作">
              <button class="yll-row-action" type="button" data-row-action="practice">练习</button>
              <button class="yll-row-action" type="button" data-row-action="save">收藏</button>
              <button class="yll-row-action" type="button" data-row-action="explain">${expanded ? "收起" : "讲解"}</button>
            </span>
          </span>
          ${expanded ? `<div class="yll-row-insight">${renderSentenceInsightHtml(cue, "row")}</div>` : ""}
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
      const rowAction = target?.closest<HTMLButtonElement>("[data-row-action]");
      if (rowAction) {
        event.preventDefault();
        event.stopPropagation();
        const rowCue = sorted.find((cue) => cueKey(cue) === button.dataset.key);
        if (!rowCue) return;
        if (rowAction.dataset.rowAction === "practice") {
          openPracticeOverlay([rowCue], 0);
          return;
        }
        if (rowAction.dataset.rowAction === "save") {
          rowAction.disabled = true;
          rowAction.textContent = "保存中";
          void saveSentenceNote(rowCue).then((saved) => {
            rowAction.textContent = saved ? "已收藏" : "失败";
            rowAction.disabled = false;
          });
          return;
        }
        if (rowAction.dataset.rowAction === "explain") {
          const rowKey = cueKey(rowCue);
          runtime.__yllSafeExpandedInsightKey = runtime.__yllSafeExpandedInsightKey === rowKey ? undefined : rowKey;
          document.getElementById(WORD_POPOVER_ID)?.setAttribute("hidden", "");
          renderRows(runtime.__yllSafeRows ?? []);
          return;
        }
      }
      const wordElement = target?.closest<HTMLElement>(".yll-word");
      if (wordElement?.dataset.word) {
        event.preventDefault();
        event.stopPropagation();
        void lookupWord(wordElement.dataset.word, button.dataset.start, wordElement.getBoundingClientRect());
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
  if (isYouTubeAdShowing()) {
    setOverlayCue(undefined);
    return;
  }

  const settings = loadSafeSettings();
  const active = selectActiveCue(rows, syncedCurrentMs(video, settings));
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
  if (nextKey === runtime.__yllSafeActiveKey) {
    setOverlayCue(active);
    return;
  }
  runtime.__yllSafeActiveKey = nextKey;

  list.querySelectorAll(".yll-row.is-active").forEach((element) => element.classList.remove("is-active"));
  const activeRow = list.querySelector<HTMLElement>(`.yll-row[data-key="${CSS.escape(nextKey)}"]`);
  activeRow?.classList.add("is-active");
  if (activeRow) {
    const userIsReadingElsewhere = Date.now() - (runtime.__yllSafeLastManualListScrollAt ?? 0) < USER_SCROLL_PAUSE_MS;
    const activeTop = activeRow.offsetTop - list.scrollTop;
    const activeBottom = activeTop + activeRow.offsetHeight;
    const activeIsVisible = activeBottom > 0 && activeTop < list.clientHeight;
    if (userIsReadingElsewhere && activeIsVisible) return;
    const rowTop = activeRow.offsetTop;
    const rowCenter = rowTop + activeRow.offsetHeight / 2;
    const targetTop = Math.max(0, rowCenter - list.clientHeight * 0.78);
    if (Math.abs(list.scrollTop - targetTop) > 12) {
      runtime.__yllSafeSuppressListScrollUntil = Date.now() + 450;
      list.scrollTo({ top: targetTop, behavior: "auto" });
    }
  }
}

function syncedCurrentMs(video: HTMLVideoElement, settings: SafeSettings) {
  return (video.currentTime * 1000) + DEFAULT_DISPLAY_LEAD_MS + settings.syncOffsetMs;
}

function selectActiveCue(rows: LabCue[], currentMs: number) {
  const sortedRows = [...rows].sort((a, b) => a.startMs - b.startMs);
  return (
    sortedRows.find((cue, index) => {
      const nextStartMs = sortedRows[index + 1]?.startMs ?? Number.POSITIVE_INFINITY;
      const holdUntilMs = Math.min(
        cue.startMs + Math.max(cue.durationMs, MIN_OVERLAY_DURATION_MS),
        nextStartMs + 350
      );
      return currentMs >= cue.startMs - 250 && currentMs <= holdUntilMs;
    }) ??
    [...sortedRows].reverse().find((cue) => cue.startMs <= currentMs)
  );
}

function refreshOverlayHighlight() {
  if (runtime.__yllSafeContextInvalidated) return;
  const rows = runtime.__yllSafeRows ?? [];
  const video = getMainVideo();
  const overlay = document.getElementById(OVERLAY_ID);
  if (!rows.length || !video || !overlay?.classList.contains("is-visible")) return;
  if (isYouTubeAdShowing()) {
    setOverlayCue(undefined);
    return;
  }

  const settings = loadSafeSettings();
  if (!settings.highlightCurrentWord) return;
  const active = selectActiveCue(rows, syncedCurrentMs(video, settings));
  if (!active || (active.source === "visible" && !runtime.__yllSafeCanUseVisibleFallback)) {
    setOverlayCue(undefined);
    return;
  }
  setOverlayCue(active);
}

function hasOfficialRows(rows = runtime.__yllSafeRows ?? []) {
  return rows.some((cue) => cue.source !== "visible");
}

function clearScheduledOfficialRetry() {
  if (runtime.__yllSafeOfficialRetryTimer) window.clearTimeout(runtime.__yllSafeOfficialRetryTimer);
  runtime.__yllSafeOfficialRetryTimer = undefined;
}

function clearStartupOfficialRetries() {
  (runtime.__yllSafeStartupRetryTimers ?? []).forEach((timer) => window.clearTimeout(timer));
  runtime.__yllSafeStartupRetryTimers = [];
}

function lockOfficialRowsForCurrentVideo(videoId = getVideoId()) {
  if (!videoId) return;
  runtime.__yllSafeLoadedVideoId = videoId;
  runtime.__yllSafeOfficialLockedVideoId = videoId;
  runtime.__yllSafeCanUseVisibleFallback = false;
  clearScheduledOfficialRetry();
  clearStartupOfficialRetries();
}

function scheduleOfficialRetry(delayMs: number, reason: string) {
  const videoId = getVideoId();
  if (!videoId || hasOfficialRows()) return;
  clearScheduledOfficialRetry();
  runtime.__yllSafeOfficialRetryTimer = window.setTimeout(() => {
    runtime.__yllSafeOfficialRetryTimer = undefined;
    if (isYouTubeAdShowing()) {
      addDebugLog("load:scheduled-retry-skip-ad", { reason, videoId });
      scheduleOfficialRetry(2500, reason);
      return;
    }
    addDebugLog("load:scheduled-retry-run", { reason, videoId });
    void loadRowsForCurrentVideo({ force: true, reason }).catch((error) => {
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeLoadingVideoId = undefined;
      runtime.__yllSafeLastFailure = `scheduled retry: ${toErrorMessage(error)}`;
      addDebugLog("load:scheduled-retry-error", { reason, error: toErrorMessage(error) });
    });
  }, delayMs);
  addDebugLog("load:scheduled-retry", { delayMs, reason, videoId });
}

function scheduleStartupOfficialRetries(videoId: string) {
  clearStartupOfficialRetries();
  const delays = [250, 900, 1800, 5200, 11000];
  runtime.__yllSafeStartupRetryTimers = delays.map((delayMs) =>
    window.setTimeout(() => {
      if (getVideoId() !== videoId || hasOfficialRows()) return;
      if (isYouTubeAdShowing()) {
        addDebugLog("load:startup-retry-skip-ad", { videoId, delayMs });
        scheduleOfficialRetry(2500, `startup-after-ad-${delayMs}`);
        return;
      }
      addDebugLog("load:startup-retry-run", { videoId, delayMs });
      void loadRowsForCurrentVideo({ force: true, reason: `startup-stabilized-${delayMs}` }).catch((error) => {
        runtime.__yllSafeIsLoadingOfficial = false;
        runtime.__yllSafeLoadingVideoId = undefined;
        runtime.__yllSafeLastFailure = `startup retry: ${toErrorMessage(error)}`;
        addDebugLog("load:startup-retry-error", { delayMs, error: toErrorMessage(error) });
      });
    }, delayMs)
  );
  addDebugLog("load:startup-retry-scheduled", { videoId, delays });
}

function saveRows(rows: LabCue[], sourceLabel: string) {
  const currentVideoId = getVideoId();
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
  const cleanedRows: LabCue[] = [];
  for (const cue of sortedUnique) {
    const previous = cleanedRows[cleanedRows.length - 1];
    if (!previous) {
      cleanedRows.push(cue);
      continue;
    }

    const nearby = Math.abs(cue.startMs - previous.startMs) < 3200;
    const sameText = normalizeForCompare(previous.text) === normalizeForCompare(cue.text);
    const highlySimilar = wordContainmentScore(previous.text, cue.text) >= 0.82;
    if (nearby && (sameText || highlySimilar)) {
      const preferred =
        cue.text.length > previous.text.length ||
        (cue.text.length === previous.text.length && cue.startMs > previous.startMs)
          ? cue
          : previous;
      cleanedRows[cleanedRows.length - 1] = {
        ...preferred,
        startMs: Math.min(previous.startMs, cue.startMs),
        durationMs: Math.max(previous.startMs + previous.durationMs, cue.startMs + cue.durationMs) - Math.min(previous.startMs, cue.startMs)
      };
      continue;
    }

    cleanedRows.push(cue);
	  }
  const existingRows = runtime.__yllSafeRows ?? [];
  const incomingHasOfficialRows = cleanedRows.some((cue) => cue.source !== "visible");
  if (!incomingHasOfficialRows && hasOfficialRows(existingRows) && runtime.__yllSafeOfficialLockedVideoId === currentVideoId) {
    addDebugLog("rows:ignore-visible-after-official", {
      sourceLabel,
      inputRows: rows.length,
      existingRows: existingRows.length,
      lockedVideoId: runtime.__yllSafeOfficialLockedVideoId
    });
    return;
  }
  if (incomingHasOfficialRows) {
    runtime.__yllSafeTranslationToken = undefined;
    runtime.__yllSafeTranslatedVideoId = undefined;
    runtime.__yllSafeIsTranslating = false;
  }
  runtime.__yllSafeRowsGeneration = (runtime.__yllSafeRowsGeneration ?? 0) + 1;
  runtime.__yllSafeRows = cleanedRows;
  if (runtime.__yllSafeRows.some((cue) => cue.source !== "visible")) lockOfficialRowsForCurrentVideo();
  applySafeSettings();
  renderRows(runtime.__yllSafeRows);
  addDebugLog("rows:saved", {
    sourceLabel,
    inputRows: rows.length,
    cleanedRows: runtime.__yllSafeRows.length,
    sources: Array.from(new Set(runtime.__yllSafeRows.map((cue) => cue.source))),
    translatedRows: runtime.__yllSafeRows.filter((cue) => cue.translatedText).length,
    hideNativeCaptions: document.documentElement.classList.contains("yll-hide-native-captions")
  });
  setCaptionStatus(`已加载 ${runtime.__yllSafeRows.length} 条字幕。`, sourceLabel);
  updateActiveCue();
  void translateRowsForCurrentVideo(sourceLabel);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "未知错误";
}

function getRuntimeUrl(path: string) {
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    if (isExtensionContextInvalidated(errorMessage)) {
      handleInvalidatedExtensionContext();
    } else {
      addDebugLog("runtime-url-error", { error: errorMessage });
    }
    return undefined;
  }
}

function isExtensionContextInvalidated(message?: string) {
  return /extension context invalidated|context invalidated|extension context/i.test(message ?? "");
}

function handleInvalidatedExtensionContext() {
  runtime.__yllSafeContextInvalidated = true;
  stopTimers();
  setStatus("扩展上下文已过期。请点击 popup 的“唤醒面板”重新注入新版脚本。");
  addDebugLog("extension-context-invalidated", { version: SCRIPT_VERSION });
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(WORD_POPOVER_ID)?.remove();
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
  document.getElementById(PRACTICE_ID)?.remove();
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

function elementLooksVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function isYouTubeAdShowing() {
  const player = getMoviePlayer();
  if (player?.classList.contains("ad-showing") || player?.classList.contains("ad-interrupting")) return true;
  const adSelectors = [
    ".ytp-ad-player-overlay",
    ".ytp-ad-preview-container",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-ad-text",
    ".video-ads .ytp-ad-module"
  ];
  return adSelectors.some((selector) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).some(elementLooksVisible)
  );
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
    try {
      chrome.runtime.sendMessage(message, (response: RuntimeResponse<T> | undefined) => {
        const errorMessage = chrome.runtime.lastError?.message;
        if (errorMessage) {
          if (isExtensionContextInvalidated(errorMessage)) handleInvalidatedExtensionContext();
          resolve({ ok: false, error: errorMessage });
          return;
        }
        resolve(response);
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (isExtensionContextInvalidated(errorMessage)) handleInvalidatedExtensionContext();
      resolve({ ok: false, error: errorMessage });
    }
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

function prioritizeTranslationRows(rows: LabCue[]) {
  const video = getMainVideo();
  const currentMs = video && Number.isFinite(video.currentTime) ? video.currentTime * 1000 : rows[0]?.startMs ?? 0;
  return [...rows].sort((a, b) => {
    const aDistance = Math.abs(a.startMs - currentMs);
    const bDistance = Math.abs(b.startMs - currentMs);
    if (aDistance !== bDistance) return aDistance - bDistance;
    return a.startMs - b.startMs;
  });
}

async function translateRowsForCurrentVideo(sourceLabel: string) {
  const videoId = getVideoId();
  const rows = runtime.__yllSafeRows ?? [];
  const rowsGeneration = runtime.__yllSafeRowsGeneration ?? 0;
  if (!videoId || !rows.length) return;
  if (runtime.__yllSafeIsTranslating) return;
  if (runtime.__yllSafeTranslatedVideoId === videoId && rows.every((row) => row.translatedText)) return;

  const token = Date.now();
  runtime.__yllSafeTranslationToken = token;
  runtime.__yllSafeTranslatedVideoId = videoId;
  runtime.__yllSafeIsTranslating = true;
  const translatable = prioritizeTranslationRows(rows.filter((row) => !row.translatedText));
  if (!translatable.length) {
    runtime.__yllSafeIsTranslating = false;
    return;
  }

  try {
    setCaptionStatus(`已加载 ${rows.length} 条字幕；正在生成中文译文...`, sourceLabel);
    const translatedByKey = new Map<string, { translatedText?: string; provider?: string }>();
    let failedBatches = 0;
    let completedBatches = 0;
    for (let index = 0; index < translatable.length;) {
      if (runtime.__yllSafeTranslationToken !== token || getVideoId() !== videoId) return;
      const batchSize = index === 0 ? TRANSLATION_INITIAL_BATCH_SIZE : TRANSLATION_BATCH_SIZE;
      const batch = translatable.slice(index, index + batchSize);
      index += batch.length;
      try {
        const translated = await translateCueBatch(videoId, batch);
        if (runtime.__yllSafeTranslationToken !== token || getVideoId() !== videoId || (runtime.__yllSafeRowsGeneration ?? 0) !== rowsGeneration) {
          addDebugLog("translation:stale-abort", {
            sourceLabel,
            batchStart: index,
            rowsGeneration,
            currentRowsGeneration: runtime.__yllSafeRowsGeneration ?? 0
          });
          return;
        }
        completedBatches += 1;
        translated.forEach((item, itemIndex) => {
          const sourceCue = batch[itemIndex];
          if (!sourceCue) return;
          const provider = item.provider === "ai" || item.provider === "youtube" || item.provider === "web" ? item.provider : "none";
          if (!item.translatedText || provider === "none") return;
          translatedByKey.set(translationKey(sourceCue), {
            translatedText: item.translatedText,
            provider
          });
        });
      } catch (error) {
        failedBatches += 1;
        runtime.__yllSafeLastTranslationFailure = toErrorMessage(error);
        addDebugLog("translation:batch-error", {
          sourceLabel,
          batchStart: index,
          batchSize: batch.length,
          error: runtime.__yllSafeLastTranslationFailure
        });
        continue;
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
      await new Promise((resolve) => window.setTimeout(resolve, 10));
    }
    if (runtime.__yllSafeTranslationToken === token && getVideoId() === videoId) {
      const translatedRows = runtime.__yllSafeRows?.filter((cue) => cue.translatedText).length ?? 0;
      const totalRows = runtime.__yllSafeRows?.length ?? rows.length;
      runtime.__yllSafeLastTranslationSummary = `${translatedRows}/${totalRows}`;
      addDebugLog("translation:complete", {
        sourceLabel,
        rows: totalRows,
        translatedRows,
        completedBatches,
        failedBatches
      });
      if (translatedRows >= totalRows) {
        runtime.__yllSafeLastTranslationFailure = undefined;
        setCaptionStatus(`已加载 ${totalRows} 条字幕；中文译文已生成。`, sourceLabel);
      } else if (translatedRows > 0) {
        setCaptionStatus(`已加载 ${totalRows} 条字幕；中文译文已生成 ${translatedRows}/${totalRows}，后台会继续补译。`, sourceLabel);
      } else {
        runtime.__yllSafeTranslatedVideoId = undefined;
        setCaptionStatus(`已加载 ${totalRows} 条字幕；中文译文暂未生成，后台会退避重试。`, sourceLabel);
      }
    }
  } catch (error) {
    addDebugLog("translation:error", { sourceLabel, error: toErrorMessage(error) });
    setCaptionStatus(`已加载 ${rows.length} 条字幕；翻译流程异常：${toErrorMessage(error)}`, sourceLabel);
  } finally {
    if (runtime.__yllSafeTranslationToken === token) runtime.__yllSafeIsTranslating = false;
  }
}

function maybeRetryMissingTranslations() {
  const settings = loadSafeSettings();
  if (!settings.showTranslations || settings.subtitleMode === "source") return;
  const rows = runtime.__yllSafeRows ?? [];
  if (!rows.length || runtime.__yllSafeIsTranslating) return;
  const translatedRows = rows.filter((cue) => cue.translatedText).length;
  if (translatedRows >= rows.length) return;

  const generation = runtime.__yllSafeRowsGeneration ?? 0;
  if (runtime.__yllSafeTranslationRetryGeneration !== generation) {
    runtime.__yllSafeTranslationRetryGeneration = generation;
    runtime.__yllSafeTranslationRetryCount = 0;
    runtime.__yllSafeLastTranslationRetryAt = undefined;
  }

  const now = Date.now();
  const retryCount = runtime.__yllSafeTranslationRetryCount ?? 0;
  if (retryCount >= TRANSLATION_RETRY_LIMIT) return;
  if (runtime.__yllSafeLastTranslationRetryAt && now - runtime.__yllSafeLastTranslationRetryAt < TRANSLATION_RETRY_BACKOFF_MS) return;

  runtime.__yllSafeTranslationRetryCount = retryCount + 1;
  runtime.__yllSafeLastTranslationRetryAt = now;
  runtime.__yllSafeTranslatedVideoId = undefined;
  addDebugLog("translation:auto-retry", {
    generation,
    retry: runtime.__yllSafeTranslationRetryCount,
    rows: rows.length,
    translatedRows
  });
  void translateRowsForCurrentVideo("自动翻译补跑");
}

async function lookupWord(word: string, startMs?: string, anchor?: DOMRect) {
  const cleaned = cleanText(word).slice(0, 48);
  if (!cleaned) return;
  const cacheKey = cleaned.toLowerCase();
  const cached = runtime.__yllSafeWordLookupCache?.get(cacheKey);
  const parsedStartMs = Number(startMs ?? "0");
  if (cached) {
    showWordPopover(cleaned, cached, {
      canSave: true,
      startMs: parsedStartMs,
      meaning: cached,
      anchor
    });
    return;
  }
  showWordPopover(cleaned, "正在查询...", { anchor });
  const videoId = getVideoId() || "current";
  const cue: LabCue = {
    startMs: parsedStartMs,
    durationMs: 1200,
    text: cleaned,
    source: "official"
  };
  runtime.__yllSafeWordLookupPending ??= new Map<string, Promise<string | undefined>>();
  const pendingLookup = runtime.__yllSafeWordLookupPending.get(cacheKey);
  const lookupPromise = pendingLookup ?? translateCueBatch(videoId, [cue]).then((translated) => translated[0]?.translatedText);
  if (!pendingLookup) runtime.__yllSafeWordLookupPending.set(cacheKey, lookupPromise);
  try {
    const translatedText = await lookupPromise;
    if (translatedText) {
      runtime.__yllSafeWordLookupCache ??= new Map<string, string>();
      runtime.__yllSafeWordLookupCache.set(cacheKey, translatedText);
    }
    showWordPopover(cleaned, translatedText || "暂时没有查到译文。", {
      canSave: true,
      startMs: parsedStartMs,
      meaning: translatedText,
      anchor
    });
  } catch (error) {
    showWordPopover(cleaned, `查词失败：${toErrorMessage(error)}`, { anchor });
  } finally {
    if (runtime.__yllSafeWordLookupPending?.get(cacheKey) === lookupPromise) {
      runtime.__yllSafeWordLookupPending.delete(cacheKey);
    }
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
  const trimmed = stripJsonPrefix(body.trim());
  try {
    const data = JSON.parse(trimmed) as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> };
    const rows = parseJson3Rows(videoId, data, source);
    if (rows.length) return rows;
  } catch {
    // Fall through to XML parsing.
  }

  if (trimmed.startsWith("WEBVTT")) return parseVttRows(videoId, trimmed, source);

  const documentValue = new DOMParser().parseFromString(trimmed, "text/xml");
  const textNodes = Array.from(documentValue.querySelectorAll("text"));
  const textRows = textNodes
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
  if (textRows.length) return textRows;

  return Array.from(documentValue.querySelectorAll("p"))
    .map((node) => {
      const startMs = Number(node.getAttribute("t") ?? "0");
      const durationMs = Number(node.getAttribute("d") ?? "1800");
      const text = cleanText(node.textContent ?? "");
      if (!text || Number.isNaN(startMs)) return undefined;
      return {
        startMs: Math.max(0, Math.round(startMs)),
        durationMs: Math.max(500, Math.round(Number.isNaN(durationMs) ? 1800 : durationMs)),
        text,
        source
      };
    })
    .filter(Boolean) as LabCue[];
}

function stripJsonPrefix(value: string) {
  return value.replace(/^\)\]\}'\s*/, "");
}

function parseVttRows(videoId: string, body: string, source: LabCue["source"]) {
  const rows: LabCue[] = [];
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/);
  const timestampPattern = /((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const timestampIndex = lines.findIndex((line) => timestampPattern.test(line));
    if (timestampIndex < 0) continue;
    const match = lines[timestampIndex]?.match(timestampPattern);
    if (!match) continue;
    const startMs = parseVttTimestamp(match[1]);
    const endMs = parseVttTimestamp(match[2]);
    const text = cleanText(lines
      .slice(timestampIndex + 1)
      .filter((line) => !line.startsWith("NOTE") && !line.startsWith("STYLE"))
      .join(" ")
      .replace(/<[^>]+>/g, " "));
    if (!text) continue;
    rows.push({
      startMs,
      durationMs: Math.max(500, endMs - startMs),
      text,
      source
    });
  }

  return rows.filter((cue) => cue.text && videoId);
}

function parseVttTimestamp(value: string) {
  const parts = value.split(":");
  const seconds = Number(parts.pop()?.replace(",", ".") ?? "0");
  const minutes = Number(parts.pop() ?? "0");
  const hours = Number(parts.pop() ?? "0");
  return Math.max(0, Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000));
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

    const language = track.languageCode ?? track.language_code ?? getTrackName(track) ?? "unknown";
    const formats = ["json3", "srv3", "vtt"];
    for (const format of formats) {
      const url = new URL(baseUrl, location.href);
      url.searchParams.set("fmt", format);
      try {
        addDebugLog("tracks:fetch", { source, language, format, host: url.hostname, token: captionUrlRequiresPoToken(url) });
        const body = await fetchCaptionText(url.toString());
        const rows = parseCaptionBody(videoId, body, source).filter((cue) => cue.text && videoId && language);
        addDebugLog("tracks:parsed", { source, language, format, body: body.length, rows: rows.length });
        if (rows.length) return mergeAdjacentCues(rows);
        const tokenHint = captionUrlRequiresPoToken(url) && !body.trim() ? " token-gated exp=xpe" : "";
        failures.push(`${language}/${format}: body=${body.length} parsed=0 host=${url.hostname}${tokenHint}`);
      } catch (error) {
        const tokenHint = captionUrlRequiresPoToken(url) ? " token-gated exp=xpe;" : "";
        failures.push(`${language}/${format}:${tokenHint} ${toErrorMessage(error)}`);
      }
    }
  }

  throw new Error(`${source}: tracks=${tracks.length}; ${failures.slice(0, 3).join(" | ") || "no usable baseUrl"}`);
}

async function loadOfficialRows(videoId: string, options: { includeSlowPaths?: boolean } = {}) {
  addDebugLog("official:start", { videoId, includeSlowPaths: Boolean(options.includeSlowPaths) });
  const [snapshot, fetchedPlayerResponse] = await Promise.all([
    readPlayerSnapshotViaBackground(),
    withTimeout(fetchPlayerResponseFromPage(), 1600, "watch html player response").catch((error) => {
      addDebugLog("official:watch-html-timeout", { error: toErrorMessage(error) });
      return undefined;
    })
  ]);
  const scriptPlayerResponse = parsePlayerResponseFromScripts();
  const playerResponses = [
    snapshot?.playerResponse,
    scriptPlayerResponse,
    fetchedPlayerResponse
  ].filter(Boolean) as PlayerResponse[];
  const playerResponse = playerResponses.find((response) => tracksFromPlayerResponse(response).length) ?? playerResponses[0];
  const tracks = uniqueTracks([
    ...(snapshot?.captionTracks ?? []),
    ...playerResponses.flatMap((response) => tracksFromPlayerResponse(response))
  ]);
  addDebugLog("official:snapshot", {
    snapshotTracks: snapshot?.captionTracks?.length ?? 0,
    scriptTracks: tracksFromPlayerResponse(scriptPlayerResponse).length,
    fetchedTracks: tracksFromPlayerResponse(fetchedPlayerResponse).length,
    playerTracks: playerResponses.reduce((sum, response) => sum + tracksFromPlayerResponse(response).length, 0),
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
  const youtubeiTracks = uniqueTracks([
    ...tracks,
    ...tracksFromPlayerResponse(youtubeiPlayerResponse)
  ]);
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

function parseJson3Rows(videoId: string, data: { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string; tOffsetMs?: number }> }> }, source: LabCue["source"]) {
  return (data.events ?? [])
    .map((event) => {
      const text = cleanText((event.segs ?? []).map((seg) => seg.utf8 ?? "").join(""));
      if (!text || event.tStartMs === undefined) return undefined;
      const durationMs = Math.max(500, event.dDurationMs ?? 1800);
      return {
        startMs: event.tStartMs,
        durationMs,
        text,
        source,
        wordTimings: json3WordTimings(event.tStartMs, durationMs, event.segs ?? [])
      };
    })
    .filter(Boolean)
    .map((cue) => cue as LabCue)
    .filter((cue) => cue.text && videoId);
}

function json3WordTimings(startMs: number, durationMs: number, segs: Array<{ utf8?: string; tOffsetMs?: number }>) {
  const timedSegments = segs
    .map((seg, index) => ({
      text: seg.utf8 ?? "",
      offsetMs: Number.isFinite(seg.tOffsetMs) ? Math.max(0, Number(seg.tOffsetMs)) : undefined,
      index
    }))
    .filter((seg) => seg.text.trim());
  if (!timedSegments.some((seg) => seg.offsetMs !== undefined)) return undefined;

  const output: WordTiming[] = [];
  timedSegments.forEach((segment, segmentIndex) => {
    const words = Array.from(segment.text.matchAll(/(\p{L}[\p{L}\p{M}'-]*|\p{N}+)/gu));
    if (!words.length) return;
    const segmentStartOffset = segment.offsetMs ?? timedSegments.slice(0, segmentIndex).reverse().find((item) => item.offsetMs !== undefined)?.offsetMs ?? 0;
    const nextTimedSegment = timedSegments.slice(segmentIndex + 1).find((item) => item.offsetMs !== undefined);
    const segmentEndOffset = Math.max(segmentStartOffset + 80, nextTimedSegment?.offsetMs ?? durationMs);
    const wordDurationMs = Math.max(70, (segmentEndOffset - segmentStartOffset) / words.length);
    words.forEach((match, wordIndex) => {
      const wordStartMs = startMs + segmentStartOffset + wordDurationMs * wordIndex;
      output.push({
        text: match[0],
        startMs: Math.round(wordStartMs),
        endMs: Math.round(Math.min(startMs + durationMs, wordStartMs + wordDurationMs))
      });
    });
  });
  return output.length ? output : undefined;
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

function isLikelyCompleteTextTrackRows(rows: LabCue[]) {
  if (rows.length < 8) return false;
  const video = getMainVideo();
  const durationMs = video?.duration && Number.isFinite(video.duration) ? video.duration * 1000 : 0;
  if (!durationMs || durationMs < 90000) return rows.length >= 8;
  const lastEndMs = rows.reduce((max, cue) => Math.max(max, cue.startMs + cue.durationMs), 0);
  const coverageRatio = lastEndMs / durationMs;
  const enoughRowsForLongVideo = rows.length >= Math.min(80, Math.max(18, Math.floor(durationMs / 45000)));
  return coverageRatio >= 0.55 && enoughRowsForLongVideo;
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

async function loadRowsForCurrentVideo(options: { force?: boolean; reason?: string } = {}) {
  const videoId = getVideoId();
  if (!videoId || runtime.__yllSafeLoadingVideoId === videoId) return;
  if (isYouTubeAdShowing()) {
    runtime.__yllSafeIsLoadingOfficial = false;
    runtime.__yllSafeLoadingVideoId = undefined;
    addDebugLog("load:skip-ad", { videoId, force: Boolean(options.force), reason: options.reason ?? "poll" });
    setCaptionStatus("广告播放中，暂停字幕读取，广告结束后自动恢复。", "官方字幕轨道");
    scheduleOfficialRetry(2500, "ad-playing");
    return;
  }
  const rows = runtime.__yllSafeRows ?? [];
  const hasOfficialRowsForVideo = hasOfficialRows(rows);
  if (!options.force && runtime.__yllSafeLoadedVideoId === videoId && hasOfficialRowsForVideo) return;
  if (!options.force && runtime.__yllSafeOfficialLockedVideoId === videoId && hasOfficialRowsForVideo) return;
  const now = Date.now();
  const hasVisibleRows = rows.some((cue) => cue.source === "visible");
  const retryWindowMs = (hasVisibleRows || runtime.__yllSafeCanUseVisibleFallback) ? OFFICIAL_FALLBACK_RETRY_MS : OFFICIAL_RETRY_MS;
  if (!options.force && !hasOfficialRowsForVideo && runtime.__yllSafeLastOfficialAttemptAt && now - runtime.__yllSafeLastOfficialAttemptAt < retryWindowMs) {
    addDebugLog("load:cooldown", {
      rows: rows.length,
      waitMs: retryWindowMs - (now - runtime.__yllSafeLastOfficialAttemptAt)
    });
    return;
  }

  runtime.__yllSafeLoadingVideoId = videoId;
  runtime.__yllSafeIsLoadingOfficial = true;
  runtime.__yllSafeCanUseVisibleFallback = hasVisibleRows || runtime.__yllSafeCanUseVisibleFallback;
  runtime.__yllSafeLastFailure = undefined;
  runtime.__yllSafeLastOfficialAttemptAt = now;
  runtime.__yllSafeOfficialAttemptCount = (runtime.__yllSafeOfficialAttemptCount ?? 0) + 1;
  runtime.__yllSafeLastOfficialDebug = [];
  addDebugLog("load:start", {
    videoId,
    pass: runtime.__yllSafeOfficialAttemptCount,
    existingRows: rows.length,
    hasOfficialRows: hasOfficialRowsForVideo,
    force: Boolean(options.force),
    reason: options.reason ?? "poll"
  });
  if (!rows.length || (options.force && hasOfficialRowsForVideo)) {
    runtime.__yllSafeRows = [];
    runtime.__yllSafeActiveKey = undefined;
    renderRows([]);
  }
  if (!hasVisibleRows) {
    document.documentElement.classList.remove("yll-hide-native-captions");
  }
  setCaptionStatus(`正在读取官方字幕轨道... 第 ${runtime.__yllSafeOfficialAttemptCount} 次`, "官方字幕轨道");
  await ensureTimedTextBridge().catch((error) => {
    runtime.__yllSafeLastFailure = `bridge: ${toErrorMessage(error)}`;
    runtime.__yllSafeLastOfficialDebug?.push(runtime.__yllSafeLastFailure);
  });

  for (let attempt = 0; attempt < OFFICIAL_AUTO_ATTEMPTS; attempt += 1) {
    setCaptionStatus(`正在读取官方字幕轨道... ${attempt + 1}/${OFFICIAL_AUTO_ATTEMPTS}`, "官方字幕轨道");
    try {
      const includeSlowPaths = attempt > 0 || Boolean(options.force) || Boolean(hasVisibleRows && runtime.__yllSafeOfficialAttemptCount % 4 === 0);
      const attemptTimeoutMs = includeSlowPaths ? OFFICIAL_SLOW_ATTEMPT_TIMEOUT_MS : OFFICIAL_FAST_ATTEMPT_TIMEOUT_MS;
      addDebugLog("load:official-attempt", { attempt: attempt + 1, max: OFFICIAL_AUTO_ATTEMPTS, includeSlowPaths, attemptTimeoutMs });
      const officialRows = await withTimeout(
        loadOfficialRows(videoId, { includeSlowPaths }),
        attemptTimeoutMs,
        "official auto attempt"
      );
      addDebugLog("load:official-result", { rows: officialRows.length, sources: Array.from(new Set(officialRows.map((row) => row.source))) });
      if (officialRows.length) {
        const sourceLabel =
          officialRows.some((row) => row.source === "transcript-panel") ? "YouTube Transcript 面板" :
            officialRows.some((row) => row.source === "transcript") ? "YouTube transcript" :
              "官方字幕轨道";
        saveRows(officialRows, sourceLabel);
        runtime.__yllSafeIsLoadingOfficial = false;
        runtime.__yllSafeLoadingVideoId = undefined;
        lockOfficialRowsForCurrentVideo(videoId);
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
        if (isLikelyCompleteTextTrackRows(textTrackRows)) {
          saveRows(textTrackRows, "video.textTracks");
          runtime.__yllSafeIsLoadingOfficial = false;
          runtime.__yllSafeLoadingVideoId = undefined;
          lockOfficialRowsForCurrentVideo(videoId);
          runtime.__yllSafeLastOfficialDebug = [`success:video.textTracks:${textTrackRows.length}`];
          addDebugLog("load:text-track-success", { rows: textTrackRows.length });
          return;
        }
        runtime.__yllSafeLastOfficialDebug?.push(`textTracks partial:${textTrackRows.length}`);
        addDebugLog("load:text-track-partial", {
          rows: textTrackRows.length,
          lastStartMs: textTrackRows[textTrackRows.length - 1]?.startMs
        });
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
        lockOfficialRowsForCurrentVideo(videoId);
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
  runtime.__yllSafeLastOfficialFailureAt = Date.now();
  ensureNativeCaptionsForFallback();
  const debug = runtime.__yllSafeLastOfficialDebug?.slice(-2).join(" / ");
  addDebugLog("load:fallback-enabled", { debug });
  setCaptionStatus(`官方字幕暂未读到，${Math.round(OFFICIAL_FALLBACK_RETRY_MS / 1000)} 秒后自动重试；当前先临时采集页面字幕。${debug ? `最近错误：${debug}` : ""}`, "页面字幕采集");
  scheduleOfficialRetry(3000, "fallback-enabled");
}

function captureVisibleFallback() {
  if (isYouTubeAdShowing()) return;
  if (!runtime.__yllSafeCanUseVisibleFallback) return;
  if (runtime.__yllSafeOfficialLockedVideoId === getVideoId()) return;
  if (hasOfficialRows()) return;
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
    const nearby = Math.abs(row.startMs - cue.startMs) < 14000;
    const overlap = normalizedRow && normalizedCue && (
      normalizedRow === normalizedCue ||
      normalizedRow.includes(normalizedCue) ||
      normalizedCue.includes(normalizedRow) ||
      wordContainmentScore(row.text, cue.text) >= 0.72
    );
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
  setCaptionStatus(`已临时采集 ${runtime.__yllSafeRows.length} 条页面字幕；原生 CC 已隐藏，仍建议优先使用官方字幕轨。`, "页面字幕采集");
  void translateRowsForCurrentVideo("页面字幕采集");
}

function tick() {
  if (runtime.__yllSafeContextInvalidated) return;
  try {
    if (!isWatchPage()) {
      clearScheduledOfficialRetry();
      clearStartupOfficialRetries();
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(OVERLAY_ID)?.remove();
      document.documentElement.classList.remove("yll-hide-native-captions");
      runtime.__yllSafeLastVideoId = undefined;
      runtime.__yllSafeLoadedVideoId = undefined;
      runtime.__yllSafeLoadingVideoId = undefined;
      runtime.__yllSafeOfficialLockedVideoId = undefined;
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeCanUseVisibleFallback = false;
      runtime.__yllSafeRows = [];
      runtime.__yllSafeRowsGeneration = undefined;
      runtime.__yllSafeTranslationToken = undefined;
      runtime.__yllSafeTranslatedVideoId = undefined;
      runtime.__yllSafeIsTranslating = false;
      runtime.__yllSafeTranslationRetryGeneration = undefined;
      runtime.__yllSafeTranslationRetryCount = undefined;
      runtime.__yllSafeLastTranslationRetryAt = undefined;
      runtime.__yllSafeLastTranslationFailure = undefined;
      runtime.__yllSafeLastTranslationSummary = undefined;
      runtime.__yllSafeLastOfficialAttemptAt = undefined;
      runtime.__yllSafeLastOfficialFailureAt = undefined;
      runtime.__yllSafeOfficialAttemptCount = undefined;
      runtime.__yllSafeLastOfficialDebug = undefined;
      runtime.__yllSafeRowsGeneration = undefined;
      runtime.__yllSafeExpandedInsightKey = undefined;
      runtime.__yllSafeWasAdShowing = false;
      closeLibraryPanel();
      document.getElementById(WORD_POPOVER_ID)?.remove();
      document.getElementById(SETTINGS_PANEL_ID)?.remove();
      document.getElementById(DEBUG_PANEL_ID)?.remove();
      document.getElementById(PRACTICE_ID)?.remove();
      return;
    }

    const currentVideoId = getVideoId();
    if (runtime.__yllSafeLastVideoId !== currentVideoId) {
      clearScheduledOfficialRetry();
      clearStartupOfficialRetries();
      if (currentVideoId) scheduleStartupOfficialRetries(currentVideoId);
      runtime.__yllSafeLastHref = location.href;
      runtime.__yllSafeLastVideoId = currentVideoId;
      runtime.__yllSafeLoadedVideoId = undefined;
      runtime.__yllSafeLoadingVideoId = undefined;
      runtime.__yllSafeOfficialLockedVideoId = undefined;
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeCanUseVisibleFallback = false;
      runtime.__yllTimedTextBridgeInstalled = false;
      runtime.__yllSafeTranslationToken = undefined;
      runtime.__yllSafeTranslatedVideoId = undefined;
      runtime.__yllSafeIsTranslating = false;
      runtime.__yllSafeTranslationRetryGeneration = undefined;
      runtime.__yllSafeTranslationRetryCount = undefined;
      runtime.__yllSafeLastTranslationRetryAt = undefined;
      runtime.__yllSafeLastTranslationFailure = undefined;
      runtime.__yllSafeLastTranslationSummary = undefined;
      runtime.__yllSafeLastOfficialAttemptAt = undefined;
      runtime.__yllSafeLastOfficialFailureAt = undefined;
      runtime.__yllSafeOfficialAttemptCount = undefined;
      runtime.__yllSafeLastOfficialDebug = undefined;
      runtime.__yllSafeExpandedInsightKey = undefined;
      runtime.__yllSafeWasAdShowing = false;
      runtime.__yllSafePanelDismissedVideoId = undefined;
      document.getElementById(WORD_POPOVER_ID)?.remove();
      document.getElementById(SETTINGS_PANEL_ID)?.remove();
      document.getElementById(PRACTICE_ID)?.remove();
    }
    const panelDismissed = Boolean(currentVideoId && runtime.__yllSafePanelDismissedVideoId === currentVideoId);
    if (!panelDismissed) {
      mountPanel();
      mountOverlay();
      positionOverlay();
    }
    if (isYouTubeAdShowing()) {
      if (!runtime.__yllSafeWasAdShowing) {
        runtime.__yllSafeWasAdShowing = true;
        addDebugLog("ad:pause-subtitles", { videoId: currentVideoId, rows: runtime.__yllSafeRows?.length ?? 0 });
        setStatus("广告播放中，插件字幕已暂停，广告结束后自动恢复。");
      }
      setOverlayCue(undefined);
      return;
    }
    if (runtime.__yllSafeWasAdShowing) {
      runtime.__yllSafeWasAdShowing = false;
      addDebugLog("ad:resume-subtitles", { videoId: currentVideoId, rows: runtime.__yllSafeRows?.length ?? 0 });
      setStatus("广告已结束，字幕同步继续。");
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
    maybeRetryMissingTranslations();
  } catch (error) {
    mountPanel();
    document.documentElement.classList.remove("yll-hide-native-captions");
    setStatus(`面板运行异常：${toErrorMessage(error)}`);
  }
}

function start() {
  if (runtime.__yllSafeContextInvalidated) return;
  announceScriptVersion();
  runtime.__yllSafeDebugSnapshot = debugSnapshot;
  if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
  if (runtime.__yllSafeOverlayTimer) window.clearInterval(runtime.__yllSafeOverlayTimer);
  tick();
  runtime.__yllSafeTimer = window.setInterval(tick, POLL_MS);
  runtime.__yllSafeOverlayTimer = window.setInterval(refreshOverlayHighlight, WORD_HIGHLIGHT_POLL_MS);
}

window.addEventListener("yt-navigate-finish", () => window.setTimeout(start, 350));
window.addEventListener("popstate", () => window.setTimeout(start, 350));
window.addEventListener("yll-open-practice", () => {
  if (!(runtime.__yllSafeRows ?? []).length) {
    setStatus("正在读取字幕，稍后再打开练习模式。");
    void loadRowsForCurrentVideo().then(() => openPracticeOverlay()).catch((error) => setStatus(`练习模式打开失败：${toErrorMessage(error)}`));
    return;
  }
  openPracticeOverlay();
});
window.addEventListener("yll-open-library", () => {
  mountPanel();
  void toggleLibraryPanel({ forceOpen: true });
});
window.addEventListener("yll-open-popup-dock", () => {
  openPopupDock();
});
window.addEventListener("yll-toggle-popup-dock", () => {
  togglePopupDock();
});
window.addEventListener("yll-safe-reload", () => {
  if (runtime.__yllSafeOverlayTimer) window.clearInterval(runtime.__yllSafeOverlayTimer);
  runtime.__yllSafeOverlayTimer = undefined;
  clearScheduledOfficialRetry();
  clearStartupOfficialRetries();
  runtime.__yllSafeLoadedVideoId = undefined;
  runtime.__yllSafeLoadingVideoId = undefined;
  runtime.__yllSafeOfficialLockedVideoId = undefined;
  runtime.__yllSafeIsLoadingOfficial = false;
  runtime.__yllSafeCanUseVisibleFallback = false;
  runtime.__yllSafeRows = [];
  runtime.__yllSafeRowsGeneration = undefined;
  runtime.__yllSafeActiveKey = undefined;
  runtime.__yllSafeTranslationToken = undefined;
  runtime.__yllSafeTranslatedVideoId = undefined;
  runtime.__yllSafeIsTranslating = false;
  runtime.__yllSafeTranslationRetryGeneration = undefined;
  runtime.__yllSafeTranslationRetryCount = undefined;
  runtime.__yllSafeLastTranslationRetryAt = undefined;
  runtime.__yllSafeLastTranslationFailure = undefined;
  runtime.__yllSafeLastTranslationSummary = undefined;
  runtime.__yllSafeLastOfficialAttemptAt = undefined;
  runtime.__yllSafeOfficialAttemptCount = undefined;
  runtime.__yllSafeLastOfficialDebug = undefined;
  runtime.__yllSafeWasAdShowing = false;
  runtime.__yllSafePanelDismissedVideoId = undefined;
  document.getElementById(WORD_POPOVER_ID)?.remove();
  document.getElementById(SETTINGS_PANEL_ID)?.remove();
  document.getElementById(PRACTICE_ID)?.remove();
  renderRows([]);
  setOverlayCue(undefined);
  start();
  ensureLibraryPanelVisible();
});
window.setTimeout(start, 0);
window.setTimeout(start, 900);
