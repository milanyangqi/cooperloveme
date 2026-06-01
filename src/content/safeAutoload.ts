type LabCue = {
  startMs: number;
  durationMs: number;
  text: string;
  source: "official" | "text-track" | "visible";
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
const POLL_MS = 500;
const MAX_VISIBLE_ROWS = 260;

const runtime = window as typeof window & {
  __yllSafeTimer?: number;
  __yllSafeLastHref?: string;
  __yllSafeRows?: LabCue[];
  __yllSafeActiveKey?: string;
  __yllSafeLoadedVideoId?: string;
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

  const currentMs = video.currentTime * 1000;
  const active =
    rows.find((cue) => currentMs >= cue.startMs - 250 && currentMs <= cue.startMs + cue.durationMs + 250) ??
    [...rows].reverse().find((cue) => cue.startMs <= currentMs);
  if (!active) return;

  const nextKey = cueKey(active);
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
  renderRows(runtime.__yllSafeRows);
  setStatus(`已加载 ${runtime.__yllSafeRows.length} 条字幕，来源：${sourceLabel}。`);
  updateActiveCue();
}

function parsePlayerResponseFromScripts() {
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent ?? "";
    if (!text.includes("ytInitialPlayerResponse")) continue;
    const match = text.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s+meta|var\s+head|<\/script>|$)/s);
    if (!match?.[1]) continue;
    try {
      return JSON.parse(match[1]) as PlayerResponse;
    } catch {
      continue;
    }
  }
  return undefined;
}

async function fetchPlayerResponseFromPage() {
  try {
    const response = await fetch(location.href, { credentials: "include", cache: "no-store" });
    if (!response.ok) return undefined;
    const html = await response.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var\s+meta|var\s+head|<\/script>|$)/s);
    if (!match?.[1]) return undefined;
    return JSON.parse(match[1]) as PlayerResponse;
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

  const url = new URL(baseUrl);
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
  const selectors = [
    ".ytp-caption-window-container .ytp-caption-segment",
    ".ytp-caption-window-container .captions-text",
    ".caption-window .ytp-caption-segment",
    ".caption-window .captions-text",
    ".ytp-caption-segment"
  ];
  const text = cleanText(selectors
    .flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    })
    .map((element) => element.innerText || element.textContent || "")
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
  runtime.__yllSafeRows = [];
  runtime.__yllSafeActiveKey = undefined;
  renderRows([]);
  setStatus("正在读取官方字幕轨道...");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const officialRows = await loadOfficialRows(videoId);
    if (officialRows.length) {
      saveRows(officialRows, "官方字幕轨道");
      return;
    }

    const textTrackRows = readTextTrackRows();
    if (textTrackRows.length) {
      saveRows(textTrackRows, "video.textTracks");
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 600));
  }

  setStatus("官方字幕暂未读到，正在从画面字幕采集...");
}

function captureVisibleFallback() {
  if ((runtime.__yllSafeRows ?? []).some((cue) => cue.source !== "visible")) return;
  const cue = readVisibleCaptionCue();
  if (!cue) return;
  const rows = runtime.__yllSafeRows ?? [];
  if (rows.some((row) => row.text === cue.text && Math.abs(row.startMs - cue.startMs) < 1200)) return;
  runtime.__yllSafeRows = [...rows, cue].slice(-MAX_VISIBLE_ROWS);
  renderRows(runtime.__yllSafeRows);
  setStatus(`已采集 ${runtime.__yllSafeRows.length} 条画面字幕，官方字幕仍在重试。`);
}

function tick() {
  if (!isWatchPage()) {
    document.getElementById(PANEL_ID)?.remove();
    runtime.__yllSafeLoadedVideoId = undefined;
    runtime.__yllSafeRows = [];
    return;
  }

  mountPanel();
  if (runtime.__yllSafeLastHref !== location.href) {
    runtime.__yllSafeLastHref = location.href;
    runtime.__yllSafeLoadedVideoId = undefined;
  }
  void loadRowsForCurrentVideo();
  captureVisibleFallback();
  updateActiveCue();
}

function start() {
  if (runtime.__yllSafeTimer) window.clearInterval(runtime.__yllSafeTimer);
  tick();
  runtime.__yllSafeTimer = window.setInterval(tick, POLL_MS);
}

window.addEventListener("yt-navigate-finish", () => window.setTimeout(start, 350));
window.addEventListener("popstate", () => window.setTimeout(start, 350));
window.setTimeout(start, 900);
