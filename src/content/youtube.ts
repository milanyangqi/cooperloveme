import type { CaptionCue, CaptionTrack, TranslatedCue, VideoContext } from "../shared/types";
import { cueId } from "../shared/ids";
import { sendRuntimeMessage } from "../shared/messages";

interface PlayerResponse {
  videoDetails?: {
    videoId?: string;
    title?: string;
    author?: string;
    lengthSeconds?: string;
    thumbnail?: {
      thumbnails?: Array<{ url: string; width?: number; height?: number }>;
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{
        baseUrl?: string;
        base_url?: string;
        url?: string;
        name?: { simpleText?: string; runs?: Array<{ text: string }> };
        languageCode?: string;
        language_code?: string;
        vssId?: string;
        kind?: string;
        isTranslatable?: boolean;
        is_translatable?: boolean;
      }>;
    };
  };
}

interface Json3Caption {
  events?: Array<{
    tStartMs?: number;
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
  }>;
}

interface PagePlayerSnapshot {
  playerResponse?: PlayerResponse;
  videoData?: {
    video_id?: string;
    videoId?: string;
    title?: string;
    author?: string;
    lengthSeconds?: string | number;
  };
  captionTracks?: Array<{
    baseUrl?: string;
    base_url?: string;
    url?: string;
    name?: { simpleText?: string; runs?: Array<{ text: string }> } | string;
    languageCode?: string;
    language_code?: string;
    vssId?: string;
    kind?: string;
    isTranslatable?: boolean;
    is_translatable?: boolean;
  }>;
  href?: string;
}

export function getVideoIdFromUrl(): string | undefined {
  const url = new URL(window.location.href);
  return url.searchParams.get("v") ?? undefined;
}

export async function readPagePlayerSnapshot(): Promise<PagePlayerSnapshot | undefined> {
  const response = await sendRuntimeMessage<PagePlayerSnapshot>({ type: "READ_PAGE_PLAYER_RESPONSE" });
  const liveSnapshot = response.ok ? response.data : undefined;
  if (hasCaptionTracks(liveSnapshot)) return liveSnapshot;

  const fetchedSnapshot = await readFetchedPlayerSnapshot();
  if (!fetchedSnapshot) return liveSnapshot;

  return {
    ...liveSnapshot,
    ...fetchedSnapshot,
    captionTracks: [
      ...(liveSnapshot?.captionTracks ?? []),
      ...(fetchedSnapshot.captionTracks ?? [])
    ],
    playerResponse: fetchedSnapshot.playerResponse ?? liveSnapshot?.playerResponse
  };
}

export function readVideoContext(snapshot?: PagePlayerSnapshot): VideoContext | undefined {
  const response = snapshot?.playerResponse ?? readPlayerResponse(getVideoIdFromUrl());
  const videoData = snapshot?.videoData;
  const videoId = response?.videoDetails?.videoId ?? videoData?.video_id ?? videoData?.videoId ?? getVideoIdFromUrl();
  if (!videoId) return undefined;

  const thumbnails = response?.videoDetails?.thumbnail?.thumbnails ?? [];
  const largestThumb = thumbnails.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  return {
    videoId,
    url: window.location.href,
    title: response?.videoDetails?.title ?? videoData?.title ?? document.title.replace(" - YouTube", ""),
    channelName: response?.videoDetails?.author ?? videoData?.author,
    durationSeconds: response?.videoDetails?.lengthSeconds
      ? Number(response.videoDetails.lengthSeconds)
      : videoData?.lengthSeconds
        ? Number(videoData.lengthSeconds)
        : undefined,
    thumbnailUrl: largestThumb?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  };
}

export function listCaptionTracks(snapshot?: PagePlayerSnapshot): CaptionTrack[] {
  const response = snapshot?.playerResponse ?? readPlayerResponse(getVideoIdFromUrl());
  const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const liveTracks = snapshot?.captionTracks ?? [];

  return [...mapCaptionTracks(liveTracks), ...mapCaptionTracks(tracks)].filter(
    (track, index, allTracks) => track.baseUrl && allTracks.findIndex((item) => item.baseUrl === track.baseUrl) === index
  );
}

function hasCaptionTracks(snapshot?: PagePlayerSnapshot): boolean {
  if (!snapshot) return false;
  return listCaptionTracks(snapshot).length > 0;
}

async function readFetchedPlayerSnapshot(): Promise<PagePlayerSnapshot | undefined> {
  try {
    const response = await fetch(window.location.href, {
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) return undefined;

    const html = await response.text();
    const playerResponse = parsePlayerResponseFromText(html, getVideoIdFromUrl());
    if (!playerResponse) return undefined;

    const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    return {
      playerResponse,
      captionTracks,
      href: window.location.href
    };
  } catch {
    return undefined;
  }
}

export async function loadCaptionCues(videoId: string, track: CaptionTrack): Promise<CaptionCue[]> {
  return fetchCaptionCues(videoId, track, track.languageCode);
}

export async function loadDirectCaptionCues(videoId: string, preferredLanguage: string): Promise<CaptionCue[]> {
  const languageCandidates = Array.from(new Set([
    preferredLanguage,
    preferredLanguage.split("-")[0],
    "en"
  ].filter(Boolean)));
  const failures: string[] = [];

  for (const languageCode of languageCandidates) {
    for (const kind of [undefined, "asr"] as const) {
      const url = new URL("https://www.youtube.com/api/timedtext");
      url.searchParams.set("v", videoId);
      url.searchParams.set("lang", languageCode);
      url.searchParams.set("fmt", "json3");
      if (kind) url.searchParams.set("kind", kind);

      try {
        const body = await fetchCaptionText(url);
        if (!body.trim()) {
          failures.push(`${languageCode}${kind ? `/${kind}` : ""}: empty`);
          continue;
        }

        const cues = parseCaptionBody(videoId, languageCode, body, "json3");
        if (cues.length) return cues;
        failures.push(`${languageCode}${kind ? `/${kind}` : ""}: no cues`);
      } catch (error) {
        failures.push(`${languageCode}${kind ? `/${kind}` : ""}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
  }

  throw new Error(`直接字幕接口没有返回可用字幕：${failures.join("; ")}`);
}

export async function loadTranslatedCues(
  videoId: string,
  track: CaptionTrack,
  targetLanguage: string
): Promise<TranslatedCue[]> {
  if (!track.isTranslatable) return [];

  try {
    const cues = await fetchCaptionCues(videoId, track, targetLanguage, targetLanguage);
    return cues.map((cue) => ({
      ...cue,
      targetLanguage,
      translatedText: cue.text,
      provider: "youtube",
      cachedAt: new Date().toISOString()
    }));
  } catch {
    return [];
  }
}

export function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector("video");
}

export function activateNativeCaptionTrack(preferredLanguage: string): boolean {
  const video = getVideoElement();
  if (!video?.textTracks?.length) return false;

  const tracks = Array.from(video.textTracks);
  const languagePrefix = preferredLanguage.split("-")[0];
  const targetTrack =
    tracks.find((track) => track.language === preferredLanguage) ??
    tracks.find((track) => track.language?.startsWith(languagePrefix)) ??
    tracks.find((track) => track.kind === "subtitles" || track.kind === "captions") ??
    tracks[0];

  if (!targetTrack) return false;

  tracks.forEach((track) => {
    track.mode = track === targetTrack ? "hidden" : "disabled";
  });
  return true;
}

export function seekToCue(cue: CaptionCue): void {
  const video = getVideoElement();
  if (!video) return;
  video.currentTime = cue.startMs / 1000;
  void video.play();
}

export function currentCue(cues: TranslatedCue[], currentTimeSeconds: number): TranslatedCue | undefined {
  const currentMs = currentTimeSeconds * 1000;
  return cues.find((cue) => currentMs >= cue.startMs && currentMs <= cue.startMs + cue.durationMs + 200);
}

export async function collectVisibleCaptionCues(
  videoId: string,
  languageCode: string,
  sampleMs = 2200
): Promise<CaptionCue[]> {
  const seen = new Map<string, CaptionCue>();
  const startedAt = Date.now();

  const capture = () => {
    const cue = readVisibleCaptionCue(videoId, languageCode);
    if (!cue) return;
    const key = cue.text.toLowerCase();
    if (!seen.has(key)) seen.set(key, cue);
  };

  capture();

  while (Date.now() - startedAt < sampleMs && seen.size < 4) {
    await wait(250);
    capture();
  }

  return Array.from(seen.values()).sort((a, b) => a.startMs - b.startMs);
}

function parseJson3Cues(videoId: string, languageCode: string, data: Json3Caption): CaptionCue[] {
  const cues: CaptionCue[] = [];

  for (const event of data.events ?? []) {
    const text = (event.segs ?? [])
      .map((seg) => seg.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();

    if (!text || text === "\n") continue;

    const startMs = event.tStartMs ?? 0;
    cues.push({
      id: cueId(videoId, startMs, text),
      videoId,
      startMs,
      durationMs: event.dDurationMs ?? 1800,
      text,
      sourceLanguage: languageCode
    });
  }

  return mergeTinyCues(cues);
}

async function fetchCaptionCues(
  videoId: string,
  track: CaptionTrack,
  languageCode: string,
  targetLanguage?: string
): Promise<CaptionCue[]> {
  const formats = ["json3", "vtt", "srv3", "srv1"];
  const failures: string[] = [];

  for (const format of formats) {
    const url = buildCaptionUrl(track.baseUrl, format, targetLanguage);

    try {
      const body = await fetchCaptionText(url);
      if (!body.trim()) {
        failures.push(`${format}: empty response`);
        continue;
      }

      const cues = parseCaptionBody(videoId, languageCode, body, format);
      if (cues.length) return cues;

      failures.push(`${format}: no cues`);
    } catch (error) {
      failures.push(`${format}: ${error instanceof Error ? error.message : "parse failed"}`);
    }
  }

  throw new Error(
    `没有读取到可解析字幕。请确认视频有 CC 字幕，或换一个有字幕的视频再试。调试信息：${failures.join("; ")}`
  );
}

async function fetchCaptionText(url: URL): Promise<string> {
  try {
    const response = await fetch(url.toString(), {
      credentials: "include",
      referrer: window.location.href,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  } catch (contentError) {
    const response = await sendRuntimeMessage<{ body: string }>({
      type: "FETCH_CAPTION_TEXT",
      payload: { url: url.toString() }
    });

    if (!response.ok) {
      throw new Error(`${contentError instanceof Error ? contentError.message : "content fetch failed"}; background: ${response.error}`);
    }

    return response.data.body;
  }
}

function buildCaptionUrl(baseUrl: string, format: string, targetLanguage?: string): URL {
  const url = new URL(baseUrl);
  url.searchParams.set("fmt", format);

  if (targetLanguage) {
    url.searchParams.set("tlang", targetLanguage);
  } else {
    url.searchParams.delete("tlang");
  }

  return url;
}

function parseCaptionBody(videoId: string, languageCode: string, body: string, format: string): CaptionCue[] {
  const trimmed = stripJsonPrefix(body.trim());

  if (format === "json3" || trimmed.startsWith("{")) {
    const data = JSON.parse(trimmed) as Json3Caption;
    return parseJson3Cues(videoId, languageCode, data);
  }

  if (format === "vtt" || trimmed.startsWith("WEBVTT")) {
    return parseVttCues(videoId, languageCode, trimmed);
  }

  return parseXmlCues(videoId, languageCode, trimmed);
}

function stripJsonPrefix(value: string): string {
  return value.replace(/^\)\]\}'\s*/, "");
}

function parseVttCues(videoId: string, languageCode: string, body: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/);
  const timestampPattern = /((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const timestampIndex = lines.findIndex((line) => timestampPattern.test(line));
    if (timestampIndex === -1) continue;

    const match = lines[timestampIndex].match(timestampPattern);
    if (!match) continue;

    const startMs = parseVttTimestamp(match[1]);
    const endMs = parseVttTimestamp(match[2]);
    const text = lines
      .slice(timestampIndex + 1)
      .filter((line) => !line.startsWith("NOTE") && !line.startsWith("STYLE"))
      .map(cleanCaptionText)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) continue;

    cues.push({
      id: cueId(videoId, startMs, text),
      videoId,
      startMs,
      durationMs: Math.max(500, endMs - startMs),
      text,
      sourceLanguage: languageCode
    });
  }

  return mergeTinyCues(cues);
}

function parseXmlCues(videoId: string, languageCode: string, body: string): CaptionCue[] {
  const document = new DOMParser().parseFromString(body, "text/xml");
  if (document.querySelector("parsererror")) return [];

  const textNodes = Array.from(document.querySelectorAll("text"));
  const transcriptCues = textNodes
    .map((node) => {
      const startSeconds = Number(node.getAttribute("start"));
      const durationSeconds = Number(node.getAttribute("dur") ?? "1.8");
      const text = cleanCaptionText(node.textContent ?? "");
      if (!Number.isFinite(startSeconds) || !text) return undefined;

      return {
        id: cueId(videoId, startSeconds * 1000, text),
        videoId,
        startMs: Math.round(startSeconds * 1000),
        durationMs: Math.max(500, Math.round(durationSeconds * 1000)),
        text,
        sourceLanguage: languageCode
      } satisfies CaptionCue;
    })
    .filter((cue): cue is CaptionCue => Boolean(cue));

  if (transcriptCues.length) return mergeTinyCues(transcriptCues);

  const paragraphNodes = Array.from(document.querySelectorAll("p"));
  const paragraphCues = paragraphNodes
    .map((node) => {
      const startMs = Number(node.getAttribute("t") ?? "0");
      const durationMs = Number(node.getAttribute("d") ?? "1800");
      const text = cleanCaptionText(node.textContent ?? "");
      if (!Number.isFinite(startMs) || !text) return undefined;

      return {
        id: cueId(videoId, startMs, text),
        videoId,
        startMs,
        durationMs: Math.max(500, Number.isFinite(durationMs) ? durationMs : 1800),
        text,
        sourceLanguage: languageCode
      } satisfies CaptionCue;
    })
    .filter((cue): cue is CaptionCue => Boolean(cue));

  return mergeTinyCues(paragraphCues);
}

function parseVttTimestamp(value: string): number {
  const parts = value.split(":");
  const secondsPart = parts.pop() ?? "0";
  const minutes = Number(parts.pop() ?? "0");
  const hours = Number(parts.pop() ?? "0");
  const seconds = Number(secondsPart);
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

function cleanCaptionText(value: string): string {
  const withoutTags = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\{\\.*?\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const textarea = document.createElement("textarea");
  textarea.innerHTML = withoutTags;
  return textarea.value.trim();
}

export function readVisibleCaptionCue(videoId: string, languageCode: string): CaptionCue | undefined {
  const nativeCue = readNativeActiveCaptionCue(videoId, languageCode);
  if (nativeCue) return nativeCue;

  return readRenderedCaptionCue(videoId, languageCode);
}

export function readRenderedCaptionCue(videoId: string, languageCode: string): CaptionCue | undefined {
  const selectors = [
    ".ytp-caption-window-container .ytp-caption-segment",
    ".ytp-caption-window-container .captions-text",
    ".caption-window .ytp-caption-segment",
    ".caption-window .captions-text",
    ".ytp-caption-segment"
  ];

  const text = selectors.reduce<string>((current, selector) => {
    if (current) return current;
    const nextText = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter(isVisibleCaptionElement)
      .map((segment) => segment.innerText || segment.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return cleanCaptionText(nextText);
  }, "");

  if (!text) return undefined;

  const video = getVideoElement();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedDurationMs = Math.max(1600, Math.min(7200, wordCount * 420));
  const startMs = Math.max(0, Math.round((video?.currentTime ?? 0) * 1000));

  return {
    id: cueId(videoId, startMs, text),
    videoId,
    startMs,
    durationMs: estimatedDurationMs,
    text,
    sourceLanguage: languageCode
  };
}

function isVisibleCaptionElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;

  return Boolean(element.offsetParent || style.position === "fixed");
}

function readNativeActiveCaptionCue(videoId: string, languageCode: string): CaptionCue | undefined {
  const video = getVideoElement();
  if (!video?.textTracks?.length) return undefined;

  for (const track of Array.from(video.textTracks)) {
    const activeCues = track.activeCues ? Array.from(track.activeCues) : [];
    if (!activeCues.length) continue;

    const text = activeCues
      .map((cue) => ("text" in cue ? String(cue.text) : ""))
      .map(cleanCaptionText)
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) continue;

    const startMs = Math.max(0, Math.round(Math.min(...activeCues.map((cue) => cue.startTime)) * 1000));
    const endMs = Math.max(startMs + 500, Math.round(Math.max(...activeCues.map((cue) => cue.endTime)) * 1000));

    return {
      id: cueId(videoId, startMs, text),
      videoId,
      startMs,
      durationMs: endMs - startMs,
      text,
      sourceLanguage: track.language || languageCode
    };
  }

  return undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function mergeTinyCues(cues: CaptionCue[]): CaptionCue[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);
  const merged: CaptionCue[] = [];
  let current: CaptionCue | undefined;

  const commit = () => {
    if (!current) return;
    current.text = current.text.replace(/\s+/g, " ").trim();
    current.id = cueId(current.videoId, current.startMs, current.text);
    merged.push(current);
    current = undefined;
  };

  for (const cue of sorted) {
    const nextCue = { ...cue, text: cue.text.replace(/\s+/g, " ").trim() };
    if (!nextCue.text) continue;

    if (!current) {
      current = nextCue;
      continue;
    }

    const gapMs = nextCue.startMs - (current.startMs + current.durationMs);
    const combinedText = `${current.text} ${nextCue.text}`.replace(/\s+/g, " ").trim();
    const combinedDurationMs = nextCue.startMs + nextCue.durationMs - current.startMs;
    const shouldCommitBeforeNext =
      gapMs > 700 ||
      endsWithSentencePunctuation(current.text) ||
      wordCount(combinedText) > 18 ||
      combinedDurationMs > 6800;

    if (shouldCommitBeforeNext) {
      commit();
      current = nextCue;
      continue;
    }

    current.text = combinedText;
    current.durationMs = Math.max(current.durationMs, combinedDurationMs);
  }

  commit();
  return merged;
}

function endsWithSentencePunctuation(text: string): boolean {
  return /[.!?。！？]$/.test(text.trim());
}

function wordCount(text: string): number {
  const latinWords = text.match(/[\p{L}\p{N}]+/gu);
  return latinWords?.length ?? text.length;
}

function mapCaptionTracks(
  tracks: Array<{
    baseUrl?: string;
    base_url?: string;
    url?: string;
    name?: { simpleText?: string; runs?: Array<{ text: string }> } | string;
    languageCode?: string;
    language_code?: string;
    vssId?: string;
    kind?: string;
    isTranslatable?: boolean;
    is_translatable?: boolean;
  }>
): CaptionTrack[] {
  return tracks
    .map<CaptionTrack | undefined>((track) => {
      const baseUrl = track.baseUrl ?? track.base_url ?? track.url;
      const languageCode = track.languageCode ?? track.language_code ?? normalizeTrackLanguage(track.vssId) ?? "";
      if (!baseUrl || !languageCode) return undefined;

      const mapped: CaptionTrack = {
        baseUrl,
        languageCode,
        name: typeof track.name === "string"
          ? track.name
          : track.name?.simpleText ?? track.name?.runs?.map((run) => run.text).join("") ?? languageCode,
        isTranslatable: Boolean(track.isTranslatable ?? track.is_translatable)
      };

      if (track.kind) mapped.kind = track.kind;
      return mapped;
    })
    .filter((track): track is CaptionTrack => Boolean(track));
}

function normalizeTrackLanguage(vssId?: string): string | undefined {
  if (!vssId) return undefined;
  const cleaned = vssId.replace(/^a\./, "").replace(/^\./, "");
  const match = cleaned.match(/[a-z]{2,3}(?:-[A-Z]{2})?/);
  return match?.[0];
}

function readPlayerResponse(expectedVideoId?: string): PlayerResponse | undefined {
  const windowResponse = (window as unknown as { ytInitialPlayerResponse?: PlayerResponse }).ytInitialPlayerResponse;
  if (windowResponse && matchesVideo(windowResponse, expectedVideoId)) return windowResponse;

  for (const script of Array.from(document.scripts)) {
    const response = parsePlayerResponseFromText(script.textContent ?? "", expectedVideoId);
    if (response) return response;
  }

  return undefined;
}

function parsePlayerResponseFromText(source: string, expectedVideoId?: string): PlayerResponse | undefined {
  const marker = "ytInitialPlayerResponse";
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex === -1) return undefined;

    const equalsIndex = source.indexOf("=", markerIndex);
    const firstBrace = source.indexOf("{", equalsIndex);
    if (firstBrace === -1) return undefined;

    const jsonText = extractJsonObject(source, firstBrace);
    if (!jsonText) {
      searchFrom = markerIndex + marker.length;
      continue;
    }

    try {
      const response = JSON.parse(jsonText) as PlayerResponse;
      if (matchesVideo(response, expectedVideoId)) return response;
    } catch {
      searchFrom = firstBrace + 1;
      continue;
    }

    searchFrom = firstBrace + jsonText.length;
  }

  return undefined;
}

function matchesVideo(response: PlayerResponse, expectedVideoId?: string): boolean {
  if (!expectedVideoId) return true;
  return response.videoDetails?.videoId === expectedVideoId;
}

function extractJsonObject(source: string, startIndex: number): string | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

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
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return source.slice(startIndex, index + 1);
    }
  }

  return undefined;
}
