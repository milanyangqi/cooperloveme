type LabCue = {
  startMs: number;
  durationMs: number;
  text: string;
  source: "official" | "text-track" | "timedtext" | "visible";
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
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: RawCaptionTrack[];
    };
  };
};

const PANEL_ID = "yll-safe-panel";
const STATUS_ID = "yll-safe-status";
const LIST_ID = "yll-safe-list";
const STYLE_ID = "yll-safe-style";
const OVERLAY_ID = "yll-safe-overlay";
const POLL_MS = 500;
const MAX_VISIBLE_ROWS = 260;
const DEFAULT_DISPLAY_LEAD_MS = 350;

const runtime = window as typeof window & {
  __yllSafeTimer?: number;
  __yllSafeLastHref?: string;
  __yllSafeRows?: LabCue[];
  __yllSafeActiveKey?: string;
  __yllSafeLoadedVideoId?: string;
  __yllSafeIsLoadingOfficial?: boolean;
  __yllSafeCanUseVisibleFallback?: boolean;
  __yllSafeLastFailure?: string;
};

function isWatchPage() {
  return location.hostname.includes("youtube.com") && location.pathname === "/watch" && Boolean(getVideoId());
}

function getVideoId() {
  return new URL(location.href).searchParams.get("v") ?? "";
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

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function cueKey(cue: LabCue) {
  return `${Math.round(cue.startMs / 100)}:${cue.text.toLowerCase()}`;
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

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      top: 76px;
      z-index: 2147483647;
      width: 370px;
      max-height: 82vh;
      overflow: hidden;
      background: #202224;
      color: #f7f8f8;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 16px 42px rgba(0,0,0,.3);
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} .yll-head {
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,.12);
      background: #202224;
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
    #${STATUS_ID} { margin-top: 7px; color: #a3aab5; font-size: 12px; }
    #${LIST_ID} {
      max-height: calc(82vh - 64px);
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
    #${OVERLAY_ID} {
      position: fixed;
      z-index: 2147483646;
      left: 50%;
      bottom: 72px;
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
      transition: opacity .12s ease;
    }
    #${OVERLAY_ID}.is-visible { opacity: 1; }
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
  installStyle();
  const existing = document.getElementById(PANEL_ID);
  if (existing) return existing;

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="yll-head">
      <div class="yll-title-row">
        <div class="yll-title">YouTube Language Lab</div>
        <button class="yll-close" type="button">关闭</button>
      </div>
      <div id="${STATUS_ID}">正在连接当前 YouTube 视频页...</div>
    </div>
    <div id="${LIST_ID}"></div>
  `;
  panel.querySelector<HTMLButtonElement>(".yll-close")?.addEventListener("click", () => {
    panel.remove();
    if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
    runtime.__yllSafeTimer = undefined;
  });
  document.documentElement.appendChild(panel);
  return panel;
}

function setStatus(text: string) {
  const status = document.getElementById(STATUS_ID);
  if (status) status.textContent = text;
}

function mountOverlay() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  document.documentElement.appendChild(overlay);
  return overlay;
}

function positionOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  const video = document.querySelector("video");
  if (!overlay || !video) return;
  const rect = video.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    overlay.classList.remove("is-visible");
    return;
  }
  overlay.style.left = `${rect.left + rect.width / 2}px`;
  overlay.style.bottom = `${Math.max(18, window.innerHeight - rect.bottom + Math.min(80, rect.height * 0.11))}px`;
  overlay.style.maxWidth = `${Math.max(280, Math.min(rect.width * 0.86, 980))}px`;
}

function setOverlayCue(cue?: LabCue) {
  const overlay = mountOverlay();
  positionOverlay();
  if (!cue?.text) {
    overlay.textContent = "";
    overlay.classList.remove("is-visible");
    return;
  }
  overlay.textContent = cue.text;
  overlay.classList.add("is-visible");
}

function renderRows(rows: LabCue[]) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;

  const sorted = [...rows].sort((a, b) => b.startMs - a.startMs);
  list.innerHTML = sorted
    .map((cue) => {
      const key = cueKey(cue);
      const activeClass = key === runtime.__yllSafeActiveKey ? " is-active" : "";
      return `
        <button class="yll-row${activeClass}" type="button" data-start="${cue.startMs}" data-key="${escapeHtml(key)}">
          <span class="yll-time">${formatClock(cue.startMs)}</span>
          <span class="yll-text">${escapeHtml(cue.text)}</span>
        </button>
      `;
    })
    .join("");

  list.querySelectorAll<HTMLButtonElement>(".yll-row[data-start]").forEach((button) => {
    button.addEventListener("click", () => {
      const video = document.querySelector("video");
      if (!video) return;
      video.currentTime = Number(button.dataset.start ?? "0") / 1000;
      void video.play();
    });
  });
}

function updateActiveCue() {
  const rows = runtime.__yllSafeRows ?? [];
  const video = document.querySelector("video");
  const list = document.getElementById(LIST_ID);
  if (!rows.length || !video || !list) return;

  const currentMs = (video.currentTime * 1000) + DEFAULT_DISPLAY_LEAD_MS;
  const active =
    rows.find((cue) => currentMs >= cue.startMs - 250 && currentMs <= cue.startMs + cue.durationMs + 250) ??
    [...rows].reverse().find((cue) => cue.startMs <= currentMs);
  if (!active) {
    setOverlayCue(undefined);
    return;
  }

  const nextKey = cueKey(active);
  if (active.source === "visible") {
    setOverlayCue(undefined);
  } else {
    setOverlayCue(active);
  }
  if (nextKey === runtime.__yllSafeActiveKey) return;
  runtime.__yllSafeActiveKey = nextKey;

  list.querySelectorAll(".yll-row.is-active").forEach((element) => element.classList.remove("is-active"));
  const activeRow = list.querySelector<HTMLElement>(`.yll-row[data-key="${CSS.escape(nextKey)}"]`);
  activeRow?.classList.add("is-active");
  activeRow?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function saveRows(rows: LabCue[], sourceLabel: string) {
  const unique = new Map<string, LabCue>();
  for (const cue of rows) {
    if (!cue.text) continue;
    unique.set(cueKey(cue), cue);
  }
  runtime.__yllSafeRows = Array.from(unique.values());
  const shouldHideNativeCaptions = runtime.__yllSafeRows.some((cue) => cue.source !== "visible");
  document.documentElement.classList.toggle("yll-hide-native-captions", shouldHideNativeCaptions);
  renderRows(runtime.__yllSafeRows);
  setStatus(`已加载 ${runtime.__yllSafeRows.length} 条字幕，来源：${sourceLabel}。`);
  updateActiveCue();
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

function pickTrack(tracks: RawCaptionTrack[]) {
  return tracks.find((track) => (track.languageCode ?? track.language_code)?.startsWith("en") && track.kind !== "asr")
    ?? tracks.find((track) => (track.languageCode ?? track.language_code)?.startsWith("en"))
    ?? tracks.find((track) => track.kind !== "asr")
    ?? tracks[0];
}

async function loadOfficialRows(videoId: string) {
  const playerResponse = parsePlayerResponseFromScripts() ?? await fetchPlayerResponseFromPage();
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = pickTrack(tracks);
  const baseUrl = track?.baseUrl ?? track?.base_url ?? track?.url;
  if (!track || !baseUrl) return [];

  const url = new URL(baseUrl, location.href);
  if (!url.searchParams.get("fmt")) url.searchParams.set("fmt", "json3");
  const response = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
  if (!response.ok) return [];
  const data = await response.json() as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> };
  const language = track.languageCode ?? track.language_code ?? getTrackName(track) ?? "unknown";

  return (data.events ?? [])
    .map((event) => {
      const text = cleanText((event.segs ?? []).map((seg) => seg.utf8 ?? "").join(""));
      if (!text || event.tStartMs === undefined) return undefined;
      return {
        startMs: event.tStartMs,
        durationMs: Math.max(500, event.dDurationMs ?? 1800),
        text,
        source: "official" as const
      };
    })
    .filter(Boolean)
    .map((cue) => cue as LabCue & { language?: string })
    .filter((cue) => cue.text && videoId && language);
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
        const response = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
        if (!response.ok) continue;
        const text = await response.text();
        if (!text.trim()) continue;
        const rows = parseJson3Rows(videoId, JSON.parse(text), "timedtext");
        if (rows.length) return rows;
      } catch {
        continue;
      }
    }
  }
  return [];
}

function readTextTrackRows() {
  const video = document.querySelector("video");
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

function readVisibleCaptionCue() {
  const isVisible = (element: HTMLElement) => {
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
  const text = compactRepeatedPhrases(texts
    .map(cleanText)
    .filter((item) => {
      const key = normalizeForCompare(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" "));

  const video = document.querySelector("video");
  if (!text || !video) return undefined;
  return {
    startMs: Math.max(0, Math.round(video.currentTime * 1000)),
    durationMs: 1600,
    text,
    source: "visible" as const
  };
}

async function loadRowsForCurrentVideo() {
  const videoId = getVideoId();
  if (!videoId || runtime.__yllSafeLoadedVideoId === videoId) return;
  runtime.__yllSafeLoadedVideoId = videoId;
  runtime.__yllSafeIsLoadingOfficial = true;
  runtime.__yllSafeCanUseVisibleFallback = false;
  runtime.__yllSafeLastFailure = undefined;
  runtime.__yllSafeRows = [];
  runtime.__yllSafeActiveKey = undefined;
  document.documentElement.classList.remove("yll-hide-native-captions");
  renderRows([]);
  setStatus("正在读取官方字幕轨道...");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    setStatus(`正在读取官方字幕轨道... ${attempt + 1}/8`);
    try {
      const officialRows = await loadOfficialRows(videoId);
      if (officialRows.length) {
        saveRows(officialRows, "官方字幕轨道");
        runtime.__yllSafeIsLoadingOfficial = false;
        return;
      }
    } catch (error) {
      runtime.__yllSafeLastFailure = `official: ${toErrorMessage(error)}`;
    }

    try {
      const textTrackRows = readTextTrackRows();
      if (textTrackRows.length) {
        saveRows(textTrackRows, "video.textTracks");
        runtime.__yllSafeIsLoadingOfficial = false;
        return;
      }
    } catch (error) {
      runtime.__yllSafeLastFailure = `textTracks: ${toErrorMessage(error)}`;
    }

    try {
      const directRows = await loadDirectTimedTextRows(videoId);
      if (directRows.length) {
        saveRows(directRows, "YouTube timedtext");
        runtime.__yllSafeIsLoadingOfficial = false;
        return;
      }
    } catch (error) {
      runtime.__yllSafeLastFailure = `timedtext: ${toErrorMessage(error)}`;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 600));
  }

  runtime.__yllSafeIsLoadingOfficial = false;
  runtime.__yllSafeCanUseVisibleFallback = true;
  document.documentElement.classList.remove("yll-hide-native-captions");
  setStatus(`官方字幕暂未读到，若页面已有 CC 文本将临时采集。${runtime.__yllSafeLastFailure ? `最近错误：${runtime.__yllSafeLastFailure}` : ""}`);
}

function captureVisibleFallback() {
  if (runtime.__yllSafeIsLoadingOfficial || !runtime.__yllSafeCanUseVisibleFallback) return;
  if ((runtime.__yllSafeRows ?? []).some((cue) => cue.source !== "visible")) return;
  const cue = readVisibleCaptionCue();
  if (!cue) return;
  setOverlayCue(undefined);
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
    rows[recentSimilarIndex] = cue.text.length > rows[recentSimilarIndex].text.length ? cue : rows[recentSimilarIndex];
    runtime.__yllSafeRows = rows.slice(-MAX_VISIBLE_ROWS);
    renderRows(runtime.__yllSafeRows);
    return;
  }
  runtime.__yllSafeRows = [...rows, cue].slice(-MAX_VISIBLE_ROWS);
  renderRows(runtime.__yllSafeRows);
  setStatus(`已临时采集 ${runtime.__yllSafeRows.length} 条页面字幕；仍建议优先使用官方字幕轨。`);
}

function tick() {
  try {
    if (!isWatchPage()) {
      document.getElementById(PANEL_ID)?.remove();
      document.getElementById(OVERLAY_ID)?.remove();
      document.documentElement.classList.remove("yll-hide-native-captions");
      runtime.__yllSafeLoadedVideoId = undefined;
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeCanUseVisibleFallback = false;
      runtime.__yllSafeRows = [];
      return;
    }

    mountPanel();
    mountOverlay();
    positionOverlay();
    if (runtime.__yllSafeLastHref !== location.href) {
      runtime.__yllSafeLastHref = location.href;
      runtime.__yllSafeLoadedVideoId = undefined;
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeCanUseVisibleFallback = false;
    }
    void loadRowsForCurrentVideo().catch((error) => {
      runtime.__yllSafeIsLoadingOfficial = false;
      runtime.__yllSafeCanUseVisibleFallback = true;
      document.documentElement.classList.remove("yll-hide-native-captions");
      setStatus(`字幕读取任务异常：${toErrorMessage(error)}`);
    });
    captureVisibleFallback();
    if ((runtime.__yllSafeRows ?? []).some((cue) => cue.source === "visible") && !(runtime.__yllSafeRows ?? []).some((cue) => cue.source !== "visible")) {
      setOverlayCue(undefined);
    }
    updateActiveCue();
  } catch (error) {
    mountPanel();
    document.documentElement.classList.remove("yll-hide-native-captions");
    setStatus(`面板运行异常：${toErrorMessage(error)}`);
  }
}

function start() {
  if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
  tick();
  runtime.__yllSafeTimer = window.setInterval(tick, POLL_MS);
}

window.addEventListener("yt-navigate-finish", () => window.setTimeout(start, 350));
window.addEventListener("popstate", () => window.setTimeout(start, 350));
window.addEventListener("yll-safe-reload", start);
window.setTimeout(start, 0);
window.setTimeout(start, 900);
