import {
  BookOpen,
  Bookmark,
  Captions,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ear,
  FileQuestion,
  Heart,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  CaptionCue,
  EntitlementSnapshot,
  ExtensionSettings,
  SentenceNote,
  SpeechScore,
  TranslatedCue,
  UserProfile,
  VideoContext
} from "../../shared/types";
import { msToClock, normalizeText } from "../../shared/ids";
import { sendRuntimeMessage } from "../../shared/messages";
import { wordSimilarity } from "../../shared/scoring";
import { useMediaRecorder, useVideoClock } from "../hooks";
import {
  activateNativeCaptionTrack,
  collectVisibleCaptionCues,
  getVideoElement,
  listCaptionTracks,
  loadCaptionCues,
  loadDirectCaptionCues,
  loadTranslatedCues,
  readPagePlayerSnapshot,
  readRenderedCaptionCue,
  readVisibleCaptionCue,
  readVideoContext,
  seekToCue
} from "../youtube";

interface Bootstrap {
  user: UserProfile;
  settings: ExtensionSettings;
  entitlement: EntitlementSnapshot;
  library: {
    sentenceNotes: SentenceNote[];
  };
}

type LoadState = "idle" | "loading" | "ready" | "error";
type SubtitleMode = "dual" | "source" | "translation";
type CaptionSource = "none" | "official" | "visible";

interface SubtitleDisplaySettings {
  mode: SubtitleMode;
  bottomPercent: number;
  opacity: number;
  sourceFontSize: number;
  translationFontSize: number;
  highlightWords: boolean;
  syncOffsetMs: number;
}

const DEFAULT_SUBTITLE_DISPLAY: SubtitleDisplaySettings = {
  mode: "dual",
  bottomPercent: 8,
  opacity: 82,
  sourceFontSize: 28,
  translationFontSize: 20,
  highlightWords: true,
  syncOffsetMs: 0
};

const DEFAULT_SYNC_LEAD_MS = 0;
const CAPTION_TRACK_RETRY_COUNT = 8;
const CAPTION_TRACK_RETRY_DELAY_MS = 750;
const CUE_LIST_MANUAL_SCROLL_HOLD_MS = 4500;
const NATIVE_CAPTION_HIDE_STYLE_ID = "yll-hide-native-captions-style";

export function ContentApp() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [videoContext, setVideoContext] = useState<VideoContext | undefined>();
  const [cues, setCues] = useState<TranslatedCue[]>([]);
  const [activeCueId, setActiveCueId] = useState<string | undefined>();
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");
  const [bootstrapError, setBootstrapError] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [practiceSource, setPracticeSource] = useState<"current-video" | "saved-library" | null>(null);
  const [practiceStartIndex, setPracticeStartIndex] = useState(0);
  const [visibleCaptureLanguage, setVisibleCaptureLanguage] = useState<string | null>(null);
  const [liveVisibleCue, setLiveVisibleCue] = useState<TranslatedCue | null>(null);
  const [captionSource, setCaptionSource] = useState<CaptionSource>("none");
  const [subtitleDisplay, setSubtitleDisplay] = useState<SubtitleDisplaySettings>(DEFAULT_SUBTITLE_DISPLAY);
  const [autoSyncOffsetMs, setAutoSyncOffsetMs] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeCueRowRef = useRef<HTMLDivElement | null>(null);
  const cueListManualScrollUntilRef = useRef(0);
  const cueListAutoScrollingRef = useRef(false);
  const cuesRef = useRef<TranslatedCue[]>([]);
  const liveVisibleCueRef = useRef<TranslatedCue | null>(null);
  const translatedCueIdsRef = useRef(new Set<string>());
  const translatingCueIdsRef = useRef(new Set<string>());
  const translationRetryAtRef = useRef(new Map<string, number>());
  const currentVideoIdRef = useRef<string | null>(null);
  const autoLoadedVideoIdRef = useRef<string | null>(null);
  const lastAutoLoadAttemptRef = useRef(0);
  const visibleDraftRef = useRef<{ cue: TranslatedCue; lastTextKey: string; stableSince: number } | null>(null);
  const visibleMissCountRef = useRef(0);
  const videoClock = useVideoClock();
  const effectiveSyncOffsetMs = subtitleDisplay.syncOffsetMs + autoSyncOffsetMs + DEFAULT_SYNC_LEAD_MS;
  const syncedVideoClock = videoClock + effectiveSyncOffsetMs / 1000;

  useEffect(() => {
    let cancelled = false;
    sendRuntimeMessage<Bootstrap>({ type: "GET_BOOTSTRAP" }).then((response) => {
      if (!cancelled && response.ok) setBootstrap(response.data);
      if (!cancelled && !response.ok) setBootstrapError(response.error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setVideoContext(readVideoContext());
  }, []);

  useEffect(() => {
    const active = findActiveCue(cues, syncedVideoClock);
    if (active) setActiveCueId(active.id);
  }, [cues, syncedVideoClock]);

  useEffect(() => {
    if (Date.now() < cueListManualScrollUntilRef.current) return;
    const row = activeCueRowRef.current;
    if (!row) return;

    cueListAutoScrollingRef.current = true;
    row.scrollIntoView({ block: "center" });
    window.setTimeout(() => {
      cueListAutoScrollingRef.current = false;
    }, 250);
  }, [activeCueId]);

  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);

  useEffect(() => {
    liveVisibleCueRef.current = liveVisibleCue;
  }, [liveVisibleCue]);

  useEffect(() => {
    if (!bootstrap || !videoContext || visibleCaptureLanguage || loadState !== "ready" || !cues.length) return undefined;

    const calibrateFromRenderedSubtitle = () => {
      const renderedCue = readRenderedCaptionCue(videoContext.videoId, bootstrap.settings.sourceLanguage);
      const video = getVideoElement();
      if (!renderedCue || !video) return;

      const renderedKey = normalizeText(renderedCue.text);
      const matchedCue = findCueByText(cuesRef.current, renderedKey, video.currentTime * 1000);
      if (!matchedCue) return;

      const targetOffsetMs = matchedCue.startMs - video.currentTime * 1000 + 120;
      const currentOffsetMs = subtitleDisplay.syncOffsetMs + autoSyncOffsetMs + DEFAULT_SYNC_LEAD_MS;
      const delta = targetOffsetMs - currentOffsetMs;

      if (Math.abs(delta) < 90) return;
      setAutoSyncOffsetMs((current) => clamp(current + clamp(delta, -500, 500), -8000, 8000));
    };

    calibrateFromRenderedSubtitle();
    const timer = window.setInterval(calibrateFromRenderedSubtitle, 400);
    return () => window.clearInterval(timer);
  }, [bootstrap, cues.length, effectiveSyncOffsetMs, loadState, videoContext, visibleCaptureLanguage]);

  const timelineActiveCue = useMemo(
    () => findActiveCue(cues, syncedVideoClock),
    [cues, syncedVideoClock]
  );

  const displayCue = useMemo(
    () => liveVisibleCue ?? timelineActiveCue,
    [liveVisibleCue, timelineActiveCue]
  );
  const displayUsesLiveCue = Boolean(liveVisibleCue && displayCue?.id === liveVisibleCue.id);
  const activeCue = useMemo(
    () => displayCue ?? cues.find((cue) => cue.id === activeCueId) ?? cues[0],
    [activeCueId, cues, displayCue]
  );
  const listActiveCueId = displayCue?.id ?? activeCueId;

  useEffect(() => {
    const shouldHide = Boolean(
      bootstrap?.settings.enabled &&
        bootstrap.settings.hideNativeCaptions &&
        loadState !== "error" &&
        (cues.length || displayCue)
    );
    let style = document.getElementById(NATIVE_CAPTION_HIDE_STYLE_ID);

    if (shouldHide) {
      if (!style) {
        style = document.createElement("style");
        style.id = NATIVE_CAPTION_HIDE_STYLE_ID;
        style.textContent = `
          .ytp-caption-window-container,
          .caption-window {
            pointer-events: none !important;
            background: transparent !important;
            border-color: transparent !important;
          }

          .ytp-caption-window-container .ytp-caption-segment,
          .ytp-caption-window-container .captions-text,
          .caption-window .ytp-caption-segment,
          .caption-window .captions-text,
          .ytp-caption-segment {
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
            background: transparent !important;
            text-shadow: none !important;
            border-color: transparent !important;
          }
        `;
        document.documentElement.appendChild(style);
      }
      return;
    }

    style?.remove();
  }, [bootstrap?.settings.enabled, bootstrap?.settings.hideNativeCaptions, cues.length, displayCue, loadState]);

  useEffect(() => {
    return () => {
      document.getElementById(NATIVE_CAPTION_HIDE_STYLE_ID)?.remove();
    };
  }, []);

  const savedPracticeCues = useMemo<TranslatedCue[]>(() => {
    if (!bootstrap) return [];
    return bootstrap.library.sentenceNotes.map((note) => ({
      id: note.cueId,
      videoId: note.videoId,
      startMs: note.startMs,
      durationMs: note.durationMs,
      text: note.text,
      translatedText: note.translatedText,
      sourceLanguage: note.language,
      targetLanguage: bootstrap.settings.targetLanguage,
      provider: "none"
    }));
  }, [bootstrap]);

  const translateCue = useCallback(
    async (context: VideoContext, cue: TranslatedCue) => {
      if (!bootstrap || cue.translatedText || translatedCueIdsRef.current.has(cue.id) || translatingCueIdsRef.current.has(cue.id)) return;

      const retryAt = translationRetryAtRef.current.get(cue.id) ?? 0;
      if (Date.now() < retryAt) return;

      translatingCueIdsRef.current.add(cue.id);

      const translatedResponse = await sendRuntimeMessage<TranslatedCue[]>({
        type: "TRANSLATE_CUES",
        payload: {
          videoContext: context,
          cues: [cue],
          targetLanguage: bootstrap.settings.targetLanguage
        }
      });

      translatingCueIdsRef.current.delete(cue.id);
      if (!translatedResponse.ok) {
        translationRetryAtRef.current.set(cue.id, Date.now() + 5000);
        return;
      }

      const translated = translatedResponse.data[0];
      if (!translated?.translatedText) {
        translationRetryAtRef.current.set(cue.id, Date.now() + 5000);
        return;
      }

      translatedCueIdsRef.current.add(cue.id);
      translationRetryAtRef.current.delete(cue.id);
      setCues((current) => current.map((item) => (item.id === cue.id ? { ...item, ...translated } : item)));
      setLiveVisibleCue((current) => (current?.id === cue.id ? { ...current, ...translated } : current));
    },
    [bootstrap]
  );

  useEffect(() => {
    if (!videoContext || !displayCue || displayCue.translatedText) return;
    void translateCue(videoContext, displayCue);
  }, [displayCue, translateCue, videoContext]);

  const translateWord = useCallback(
    async (word: string, cue: TranslatedCue) => {
      if (!bootstrap || !videoContext) return;
      const cleanWord = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      if (!cleanWord) return;

      setError(`正在查询：${cleanWord}`);
      const translatedResponse = await sendRuntimeMessage<TranslatedCue[]>({
        type: "TRANSLATE_CUES",
        payload: {
          videoContext,
          cues: [{ ...cue, id: `${cue.id}:word:${normalizeText(cleanWord)}`, text: cleanWord, durationMs: 1000 }],
          targetLanguage: bootstrap.settings.targetLanguage
        }
      });

      if (translatedResponse.ok && translatedResponse.data[0]?.translatedText) {
        setError(`${cleanWord}: ${translatedResponse.data[0].translatedText}`);
      } else {
        setError(translatedResponse.ok ? `没有查到 ${cleanWord} 的译文。` : translatedResponse.error);
      }
    },
    [bootstrap, videoContext]
  );

  const updateHideNativeCaptions = useCallback(
    async (hideNativeCaptions: boolean) => {
      if (!bootstrap) return;
      const response = await sendRuntimeMessage<ExtensionSettings>({
        type: "UPDATE_SETTINGS",
        payload: { hideNativeCaptions }
      });

      if (response.ok) {
        setBootstrap({ ...bootstrap, settings: response.data });
      } else {
        setError(response.error);
      }
    },
    [bootstrap]
  );

  const activateVisibleFallback = useCallback(
    async (context: VideoContext, visibleCues: CaptionCue[], languageCode: string) => {
      translatedCueIdsRef.current = new Set();
      const fallbackCues = mergeTranslations(visibleCues, [], bootstrap?.settings.targetLanguage ?? "zh-Hans");
      const firstLiveCue = fallbackCues[fallbackCues.length - 1] ?? null;
      visibleDraftRef.current = firstLiveCue
        ? { cue: firstLiveCue, lastTextKey: normalizeText(firstLiveCue.text), stableSince: Date.now() }
        : null;
      cuesRef.current = fallbackCues;
      setCues(fallbackCues);
      setActiveCueId(firstLiveCue?.id ?? fallbackCues[0]?.id);
      setLiveVisibleCue(firstLiveCue);
      setCaptionSource("visible");
      setLoadState("ready");
      setVisibleCaptureLanguage(languageCode);
      setIsOpen(true);
      return fallbackCues;
    },
    [bootstrap?.settings.targetLanguage]
  );

  useEffect(() => {
    if (!bootstrap || !videoContext || loadState !== "ready") return undefined;

    const liveLanguage = visibleCaptureLanguage ?? bootstrap.settings.sourceLanguage;
    const shouldCommitToRightList = Boolean(visibleCaptureLanguage);

    const commitVisibleCue = (cue: TranslatedCue) => {
      const key = normalizeText(cue.text);
      if (!key) return;

      const current = cuesRef.current;
      let cueToActivate = cue;
      let cueToTranslate: TranslatedCue | undefined;
      let next: TranslatedCue[];

      const matchedCue = findCueByText(current, key, cue.startMs);
      const nearIndex = matchedCue && Math.abs(matchedCue.startMs - cue.startMs) < 9000
        ? current.findIndex((item) => item.id === matchedCue.id)
        : -1;

      if (nearIndex >= 0) {
        next = [...current];
        const existing = next[nearIndex];
        const updatedCue = {
          ...existing,
          text: key.length >= normalizeText(existing.text).length ? cue.text : existing.text,
          durationMs: Math.max(existing.durationMs, cue.durationMs),
          translatedText: key.length >= normalizeText(existing.text).length ? cue.translatedText : existing.translatedText
        };
        next[nearIndex] = updatedCue;
        cueToActivate = updatedCue;
        if (!updatedCue.translatedText) cueToTranslate = updatedCue;
      } else {
        next = [...current];
        const previousIndex = next.reduce<number>((candidate, item, index) => {
          if (item.startMs >= cue.startMs) return candidate;
          if (candidate === -1 || item.startMs > next[candidate].startMs) return index;
          return candidate;
        }, -1);

        if (previousIndex >= 0) {
          const previous = next[previousIndex];
          next[previousIndex] = {
            ...previous,
            durationMs: Math.max(800, Math.min(9000, cue.startMs - previous.startMs))
          };
        }

        next.push(cue);
        cueToTranslate = cue;
      }

      next = next.sort((a, b) => a.startMs - b.startMs);
      cuesRef.current = next;
      setCues(next);
      setActiveCueId(cueToActivate.id);
      if (cueToTranslate) void translateCue(videoContext, cueToTranslate);
    };

    const appendCurrentVisibleCue = () => {
      const cue = readVisibleCaptionCue(videoContext.videoId, liveLanguage);
      if (!cue) {
        visibleMissCountRef.current += 1;
        if (visibleMissCountRef.current >= 3) {
          liveVisibleCueRef.current = null;
          setLiveVisibleCue(null);
        }
        return;
      }

      visibleMissCountRef.current = 0;

      const translatedCue = mergeTranslations([cue], [], bootstrap.settings.targetLanguage)[0];
      const key = normalizeText(translatedCue.text);
      if (!key) return;

      const matchedListCue = findCueByText(cuesRef.current, key, translatedCue.startMs);
      const previousLiveCue = liveVisibleCueRef.current;
      const previousLiveKey = previousLiveCue ? normalizeText(previousLiveCue.text) : "";
      const isSameLiveText = Boolean(previousLiveKey && (previousLiveKey === key || key.startsWith(previousLiveKey) || previousLiveKey.startsWith(key)));
      const stableLiveTiming =
        isSameLiveText && previousLiveCue !== null
          ? {
              id: matchedListCue?.id ?? previousLiveCue.id,
              startMs: previousLiveCue.startMs,
              durationMs: Math.max(previousLiveCue.durationMs, translatedCue.startMs - previousLiveCue.startMs + 480)
            }
          : {
              id: matchedListCue?.id ?? translatedCue.id,
              startMs: translatedCue.startMs,
              durationMs: matchedListCue?.durationMs ?? translatedCue.durationMs
            };
      const liveCue = matchedListCue
        ? {
            ...matchedListCue,
            ...stableLiveTiming,
            text: translatedCue.text,
            translatedText: matchedListCue.translatedText
          }
        : { ...translatedCue, ...stableLiveTiming };
      liveVisibleCueRef.current = liveCue;
      setLiveVisibleCue(liveCue);
      if (!liveCue.translatedText) void translateCue(videoContext, liveCue);

      if (!shouldCommitToRightList) return;

      const draft = visibleDraftRef.current;
      const now = Date.now();
      if (!draft) {
        visibleDraftRef.current = { cue: translatedCue, lastTextKey: key, stableSince: now };
        return;
      }

      const draftKey = normalizeText(draft.cue.text);
      const sameCaption = key === draftKey || key.startsWith(draftKey) || draftKey.startsWith(key);
      if (sameCaption) {
        const nextCue = {
          ...draft.cue,
          text: key.length >= draftKey.length ? translatedCue.text : draft.cue.text,
          durationMs: Math.max(draft.cue.durationMs, translatedCue.startMs - draft.cue.startMs + translatedCue.durationMs)
        };
        visibleDraftRef.current = {
          cue: nextCue,
          lastTextKey: key,
          stableSince: key === draft.lastTextKey ? draft.stableSince : now
        };
        return;
      }

      commitVisibleCue(draft.cue);
      visibleDraftRef.current = { cue: translatedCue, lastTextKey: key, stableSince: now };
    };

    let frameId = 0;
    const scheduleRead = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(appendCurrentVisibleCue);
    };

    appendCurrentVisibleCue();
    const observer = new MutationObserver(scheduleRead);
    const observeCaptionContainers = () => {
      const containers = document.querySelectorAll(".ytp-caption-window-container, .caption-window, .html5-video-player");
      containers.forEach((container) => {
        observer.observe(container, { childList: true, characterData: true, subtree: true });
      });
    };
    observeCaptionContainers();
    const observerAttachTimer = window.setInterval(observeCaptionContainers, 1200);
    const timer = window.setInterval(appendCurrentVisibleCue, 120);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (visibleDraftRef.current) {
        commitVisibleCue(visibleDraftRef.current.cue);
        visibleDraftRef.current = null;
      }
      observer.disconnect();
      window.clearInterval(observerAttachTimer);
      window.clearInterval(timer);
    };
  }, [bootstrap, loadState, translateCue, videoContext, visibleCaptureLanguage]);

  const loadSubtitles = useCallback(async (): Promise<TranslatedCue[]> => {
    if (!bootstrap) {
      setError("插件正在初始化，请稍后再试。");
      return [];
    }

    let snapshot = await readPagePlayerSnapshot();
    let context = readVideoContext(snapshot);
    setVideoContext(context);
    if (!context) {
      setLoadState("error");
      setError("当前页面没有识别到 YouTube 视频。");
      return [];
    }

    setLoadState("loading");
    setError("");
    setAutoSyncOffsetMs(0);
    if (!cuesRef.current.length) setCaptionSource("none");

    try {
      let tracks = listCaptionTracks(snapshot);
      for (let attempt = 0; !tracks.length && attempt < CAPTION_TRACK_RETRY_COUNT; attempt += 1) {
        await delay(CAPTION_TRACK_RETRY_DELAY_MS);
        snapshot = await readPagePlayerSnapshot();
        context = readVideoContext(snapshot) ?? context;
        setVideoContext(context);
        tracks = listCaptionTracks(snapshot);
      }

      const sourceTrack =
        tracks.find((track) => track.languageCode === bootstrap.settings.sourceLanguage) ??
        tracks.find((track) => track.languageCode.startsWith(bootstrap.settings.sourceLanguage.split("-")[0])) ??
        tracks[0];

      if (!sourceTrack) {
        try {
          const directCues = await loadDirectCaptionCues(context.videoId, bootstrap.settings.sourceLanguage);
          const merged = mergeTranslations(directCues, [], bootstrap.settings.targetLanguage);
          setCues(merged);
          setActiveCueId(merged[0]?.id);
          setLiveVisibleCue(null);
          setCaptionSource("official");
          autoLoadedVideoIdRef.current = context.videoId;
          setLoadState("ready");
          setVisibleCaptureLanguage(null);
          setIsOpen(true);
          return merged;
        } catch {
          // Fall through to native/visible caption fallback.
        }

        activateNativeCaptionTrack(bootstrap.settings.sourceLanguage);
        await delay(500);
        const visibleCues = await collectVisibleCaptionCues(context.videoId, bootstrap.settings.sourceLanguage);
        if (visibleCues.length) {
          return activateVisibleFallback(context, visibleCues, bootstrap.settings.sourceLanguage);
        }

        throw new Error("这个视频没有可读取字幕轨，也没有可采集的画面字幕。请换一个有字幕的视频再试。");
      }

      let sourceCues: CaptionCue[];
      try {
        sourceCues = await loadCaptionCues(context.videoId, sourceTrack);
      } catch (captionError) {
        activateNativeCaptionTrack(sourceTrack.languageCode);
        await delay(500);
        const visibleCues = await collectVisibleCaptionCues(context.videoId, sourceTrack.languageCode);
        if (visibleCues.length) {
          return activateVisibleFallback(context, visibleCues, sourceTrack.languageCode);
        }

        throw captionError;
      }

      const youtubeTranslations = await loadTranslatedCues(context.videoId, sourceTrack, bootstrap.settings.targetLanguage);
      let merged = mergeTranslations(sourceCues, youtubeTranslations, bootstrap.settings.targetLanguage);

      if (!youtubeTranslations.length) {
        const sample = sourceCues.slice(0, Math.min(40, sourceCues.length));
        const translatedResponse = await sendRuntimeMessage<TranslatedCue[]>({
          type: "TRANSLATE_CUES",
          payload: {
            videoContext: context,
            cues: sample,
            targetLanguage: bootstrap.settings.targetLanguage
          }
        });

        if (translatedResponse.ok) {
          const aiMap = new Map(translatedResponse.data.map((cue) => [cue.id, cue]));
          merged = merged.map((cue) => aiMap.get(cue.id) ?? cue);
        }
      }

      setCues(merged);
      setActiveCueId(merged[0]?.id);
      setLiveVisibleCue(null);
      setCaptionSource("official");
      autoLoadedVideoIdRef.current = context.videoId;
      setLoadState("ready");
      setVisibleCaptureLanguage(null);
      setIsOpen(true);
      return merged;
    } catch (loadError) {
      setLoadState("error");
      setCaptionSource("none");
      setError(loadError instanceof Error ? loadError.message : "字幕加载失败。");
      return [];
    }
  }, [activateVisibleFallback, bootstrap]);

  useEffect(() => {
    if (!bootstrap || loadState === "loading") return undefined;

    const tryAutoLoad = () => {
      const context = readVideoContext();
      if (!context) return;

      const videoChanged = currentVideoIdRef.current !== context.videoId;
      if (videoChanged) {
        currentVideoIdRef.current = context.videoId;
        autoLoadedVideoIdRef.current = null;
        lastAutoLoadAttemptRef.current = 0;
        setCues([]);
        cuesRef.current = [];
        setActiveCueId(undefined);
        setLiveVisibleCue(null);
        liveVisibleCueRef.current = null;
        setVisibleCaptureLanguage(null);
        setCaptionSource("none");
        setLoadState("idle");
      }

      if (autoLoadedVideoIdRef.current === context.videoId && captionSource === "official" && cues.length > 0) return;

      const now = Date.now();
      const retryDelay = captionSource === "visible" ? 5000 : 1200;
      if (now - lastAutoLoadAttemptRef.current < retryDelay) return;
      lastAutoLoadAttemptRef.current = now;

      void loadSubtitles();
    };

    tryAutoLoad();
    const timer = window.setInterval(tryAutoLoad, 1200);
    return () => window.clearInterval(timer);
  }, [bootstrap, captionSource, cues.length, loadState, loadSubtitles]);

  const saveSentence = useCallback(
    async (cue: TranslatedCue) => {
      if (!videoContext) return;
      await sendRuntimeMessage({
        type: "SAVE_SENTENCE",
        payload: {
          videoId: videoContext.videoId,
          cueId: cue.id,
          text: cue.text,
          translatedText: cue.translatedText,
          language: cue.sourceLanguage,
          startMs: cue.startMs,
          durationMs: cue.durationMs,
          isFavorite: true
        }
      });

      const updated = await sendRuntimeMessage<Bootstrap["library"]>({ type: "GET_LIBRARY" });
      if (updated.ok && bootstrap) setBootstrap({ ...bootstrap, library: updated.data });
    },
    [bootstrap, videoContext]
  );

  const explainCue = useCallback(
    async (cue: TranslatedCue) => {
      if (!bootstrap) return;
      const selection = window.getSelection()?.toString().trim();
      const text = selection || cue.text;
      const response = await sendRuntimeMessage<{ title: string; explanation: string; examples: string[] }>({
        type: "EXPLAIN_SELECTION",
        payload: {
          text,
          sentence: cue.text,
          targetLanguage: bootstrap.settings.targetLanguage
        }
      });

      if (response.ok) {
        setError(`${response.data.title}: ${response.data.explanation}`);
      } else {
        setError(response.error);
      }
    },
    [bootstrap]
  );

  const openPractice = useCallback((source: "current-video" | "saved-library", startIndex = 0) => {
    setPracticeStartIndex(startIndex);
    setPracticeSource(source);
    getVideoElement()?.pause();
  }, []);

  useEffect(() => {
    const listener = (message: { type?: string }, _sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
      if (message.type === "YLL_PING") {
        sendResponse({
          ok: true,
          status: "YouTube Language Lab 页面脚本已连接。",
          bootstrapReady: Boolean(bootstrap),
          cuesLoaded: cues.length,
          error: bootstrap ? undefined : bootstrapError || "页面脚本已连接，正在等待后台初始化。"
        });
        return false;
      }

      if (message.type === "LOAD_CAPTIONS") {
        void loadSubtitles().then((loadedCues) => {
          sendResponse({
            ok: loadedCues.length > 0,
            status: loadedCues.length ? `已加载 ${loadedCues.length} 句字幕。` : undefined,
            error: loadedCues.length ? undefined : error || "没有读取到字幕。请确认这是 YouTube 视频页且视频有字幕。"
          });
        });
        return true;
      }

      if (message.type === "OPEN_PRACTICE") {
        void (async () => {
          const availableCues = cues.length ? cues : await loadSubtitles();
          if (!availableCues.length) {
            sendResponse({
              ok: false,
              error: error || "没有可练习的字幕。请先打开有字幕的 YouTube 视频。"
            });
            return;
          }

          const startIndex = Math.max(0, availableCues.findIndex((cue) => cue.id === activeCueId));
          openPractice("current-video", startIndex);
          sendResponse({ ok: true, status: "已打开全屏练习模式。" });
        })();
        return true;
      }

      return false;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [activeCueId, bootstrap, bootstrapError, cues, error, loadSubtitles, openPractice]);

  if (!bootstrap?.settings.enabled || !videoContext) return null;

  const practiceCues = practiceSource === "saved-library" ? savedPracticeCues : cues;

  return (
    <>
      <div className="yll-shell">
        <div className="yll-card">
          <div className="yll-toolbar">
            <div className="yll-brand">
              <span className="yll-dot" />
              YouTube Language Lab
            </div>
              <div className="yll-toolbar-actions">
              <button className="yll-icon-button" type="button" title={isOpen ? "收起字幕列表" : "展开字幕列表"} onClick={() => setIsOpen((value) => !value)}>
                <ChevronDown size={15} className={isOpen ? "" : "yll-rotate"} />
              </button>
              <button className="yll-button primary" type="button" onClick={loadSubtitles}>
                {loadState === "loading" ? <Loader2 size={14} /> : <BookOpen size={14} />}
                字幕
              </button>
              <button className="yll-icon-button" type="button" title="字幕显示设置" onClick={() => setSettingsOpen((value) => !value)}>
                <Settings size={15} />
              </button>
            </div>
          </div>

          {settingsOpen ? (
            <SubtitleSettingsPanel
              value={subtitleDisplay}
              hideNativeCaptions={bootstrap.settings.hideNativeCaptions}
              onChange={(patch) => setSubtitleDisplay((current) => ({ ...current, ...patch }))}
              onHideNativeCaptionsChange={updateHideNativeCaptions}
            />
          ) : null}

          {isOpen ? (
            <>
              <PanelStatus
                loadState={loadState}
                error={error}
                cues={cues}
                isVisibleCapture={Boolean(visibleCaptureLanguage)}
                entitlement={bootstrap.entitlement}
                savedCount={bootstrap.library.sentenceNotes.length}
                onPracticeSaved={() => openPractice("saved-library")}
              />
              {cues.length ? (
                <div
                  className="yll-cue-list"
                  onScroll={() => {
                    if (cueListAutoScrollingRef.current) return;
                    cueListManualScrollUntilRef.current = Date.now() + CUE_LIST_MANUAL_SCROLL_HOLD_MS;
                  }}
                >
                  {cues.map((cue, index) => (
                    <CueRow
                      key={cue.id}
                      cue={cue}
                      isActive={cue.id === listActiveCueId}
                      rowRef={
                        cue.id === listActiveCueId
                          ? (node) => {
                              activeCueRowRef.current = node;
                            }
                          : undefined
                      }
                      onSeek={() => {
                        cueListManualScrollUntilRef.current = 0;
                        setActiveCueId(cue.id);
                        seekToCue(cue);
                      }}
                      onPractice={() => openPractice("current-video", index)}
                      onSave={() => saveSentence(cue)}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {displayCue ? (
        <div
          className={`yll-video-subtitle mode-${subtitleDisplay.mode}`}
          style={
            {
              "--yll-subtitle-bottom": `${subtitleDisplay.bottomPercent}%`,
              "--yll-subtitle-opacity": `${subtitleDisplay.opacity / 100}`,
              "--yll-source-font-size": `${subtitleDisplay.sourceFontSize}px`,
              "--yll-translation-font-size": `${subtitleDisplay.translationFontSize}px`
            } as CSSProperties
          }
        >
          <div className="yll-video-subtitle-text">
            <WordText
              cue={displayCue}
              currentTimeSeconds={displayUsesLiveCue ? videoClock : syncedVideoClock}
              highlightWords={subtitleDisplay.highlightWords}
              onWordClick={translateWord}
            />
          </div>
          {!visibleCaptureLanguage && Math.abs(autoSyncOffsetMs) >= 120 ? (
            <div className="yll-sync-badge">已自动校准 {formatOffset(autoSyncOffsetMs)}</div>
          ) : null}
          {subtitleDisplay.mode !== "source" && bootstrap.settings.showDualSubtitles ? (
            <div className="yll-video-subtitle-translation">{displayCue.translatedText ?? "译文待生成"}</div>
          ) : null}
          <div className="yll-video-subtitle-actions">
            <button className="yll-button primary" type="button" onClick={() => openPractice("current-video", Math.max(0, cues.findIndex((cue) => cue.id === displayCue.id)))}>
              <Mic size={14} />
              练当前句
            </button>
            <button className="yll-button" type="button" onClick={() => saveSentence(displayCue)}>
              <Bookmark size={14} />
              收藏
            </button>
            <button className="yll-button" type="button" onClick={() => explainCue(displayCue)}>
              <Sparkles size={14} />
              讲解
            </button>
          </div>
        </div>
      ) : null}

      {practiceSource && practiceCues.length ? (
        <PracticeOverlay
          cues={practiceCues}
          videoContext={practiceSource === "current-video" ? videoContext : undefined}
          settings={bootstrap.settings}
          startIndex={practiceStartIndex}
          source={practiceSource}
          onClose={() => setPracticeSource(null)}
          onSaveSentence={saveSentence}
        />
      ) : null}
    </>
  );
}

function PanelStatus({
  loadState,
  error,
  cues,
  isVisibleCapture,
  entitlement,
  savedCount,
  onPracticeSaved
}: {
  loadState: LoadState;
  error: string;
  cues: TranslatedCue[];
  isVisibleCapture: boolean;
  entitlement: EntitlementSnapshot;
  savedCount: number;
  onPracticeSaved: () => void;
}) {
  if (loadState === "loading") {
    if (cues.length) {
      return (
        <div className="yll-status">
          {isVisibleCapture ? `正在后台重试官方字幕轨，已采集 ${cues.length} 句。` : `已加载 ${cues.length} 句，正在刷新字幕轨。`}
        </div>
      );
    }

    return <div className="yll-status">正在读取 YouTube 字幕轨道...</div>;
  }

  if (loadState === "error" || error) {
    return <div className="yll-status">{error}</div>;
  }

  if (!cues.length) {
    return (
      <div className="yll-status">
        {isVisibleCapture ? "正在从画面字幕采集，建议等待几秒。" : "正在自动读取当前视频字幕。"}免费额度：翻译 {entitlement.quota.translate - entitlement.usageToday.translate}，讲解{" "}
        {entitlement.quota.explain - entitlement.usageToday.explain}，跟读评分 {entitlement.quota.speechScore - entitlement.usageToday.speechScore}。
        {savedCount ? (
          <div className="yll-practice-action-row">
            <button className="yll-button" type="button" onClick={onPracticeSaved}>
              <Heart size={14} />
              练收藏句 {savedCount}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="yll-status">
      {isVisibleCapture ? `正在从画面字幕采集，已积累 ${cues.length} 句。` : `已加载 ${cues.length} 句字幕。`}点击某句可跳转，或进入全屏混合练习。
      {savedCount ? (
        <div className="yll-practice-action-row">
          <button className="yll-button" type="button" onClick={onPracticeSaved}>
            <Heart size={14} />
            练收藏句 {savedCount}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SubtitleSettingsPanel({
  value,
  hideNativeCaptions,
  onChange,
  onHideNativeCaptionsChange
}: {
  value: SubtitleDisplaySettings;
  hideNativeCaptions: boolean;
  onChange: (patch: Partial<SubtitleDisplaySettings>) => void;
  onHideNativeCaptionsChange: (hideNativeCaptions: boolean) => void;
}) {
  return (
    <div className="yll-settings-panel">
      <div className="yll-settings-section">
        <div className="yll-settings-title">字幕显示</div>
        <label className="yll-setting-row">
          <span>字幕模式</span>
          <select value={value.mode} onChange={(event) => onChange({ mode: event.target.value as SubtitleMode })}>
            <option value="dual">双语字幕</option>
            <option value="source">主字幕</option>
            <option value="translation">翻译字幕</option>
          </select>
        </label>
        <label className="yll-setting-row">
          <span>字幕位置</span>
          <select value={value.bottomPercent} onChange={(event) => onChange({ bottomPercent: Number(event.target.value) })}>
            <option value={4}>底部 4%</option>
            <option value={8}>底部 8%</option>
            <option value={14}>底部 14%</option>
            <option value={22}>底部 22%</option>
          </select>
        </label>
        <label className="yll-setting-row">
          <span>背景透明度</span>
          <select value={value.opacity} onChange={(event) => onChange({ opacity: Number(event.target.value) })}>
            <option value={60}>60%</option>
            <option value={72}>72%</option>
            <option value={82}>82%</option>
            <option value={92}>92%</option>
          </select>
        </label>
        <label className="yll-setting-row">
          <span>同步校准</span>
          <select value={value.syncOffsetMs} onChange={(event) => onChange({ syncOffsetMs: Number(event.target.value) })}>
            <option value={-1000}>字幕延后 1.0s</option>
            <option value={-500}>字幕延后 0.5s</option>
            <option value={0}>0s</option>
            <option value={500}>字幕提前 0.5s</option>
            <option value={1000}>字幕提前 1.0s</option>
            <option value={1500}>字幕提前 1.5s</option>
          </select>
        </label>
        <label className="yll-setting-row">
          <span>悬停查词</span>
          <input type="checkbox" checked={value.highlightWords} onChange={(event) => onChange({ highlightWords: event.target.checked })} />
        </label>
        <label className="yll-setting-row">
          <span>隐藏 YouTube 原生字幕</span>
          <input type="checkbox" checked={hideNativeCaptions} onChange={(event) => onHideNativeCaptionsChange(event.target.checked)} />
        </label>
      </div>

      <div className="yll-settings-section">
        <div className="yll-settings-title">字幕样式</div>
        <label className="yll-setting-row">
          <span>原字幕字号</span>
          <select value={value.sourceFontSize} onChange={(event) => onChange({ sourceFontSize: Number(event.target.value) })}>
            <option value={22}>22px</option>
            <option value={28}>28px</option>
            <option value={34}>34px</option>
            <option value={40}>40px</option>
          </select>
        </label>
        <label className="yll-setting-row">
          <span>译文字号</span>
          <select value={value.translationFontSize} onChange={(event) => onChange({ translationFontSize: Number(event.target.value) })}>
            <option value={16}>16px</option>
            <option value={20}>20px</option>
            <option value={24}>24px</option>
            <option value={28}>28px</option>
          </select>
        </label>
      </div>

      <div className="yll-subtitle-preview">
        <div>You can read the <span>demo</span> content</div>
        <p>您可以查看示例内容</p>
      </div>
    </div>
  );
}

function WordText({
  cue,
  currentTimeSeconds,
  highlightWords,
  onWordClick
}: {
  cue: TranslatedCue;
  currentTimeSeconds: number;
  highlightWords: boolean;
  onWordClick: (word: string, cue: TranslatedCue) => void;
}) {
  const parts = cue.text.split(/(\s+)/);
  const wordIndexes = parts.reduce<number[]>((indexes, part, index) => {
    if (part.trim()) indexes.push(index);
    return indexes;
  }, []);
  const elapsedMs = currentTimeSeconds * 1000 - cue.startMs;
  const isCurrentCue = elapsedMs >= 0 && elapsedMs < cue.durationMs;
  const progress = Math.max(0, Math.min(0.999, elapsedMs / Math.max(800, cue.durationMs)));
  const activeWordPartIndex = highlightWords && isCurrentCue
    ? wordIndexes[Math.floor(progress * Math.max(1, wordIndexes.length))] ?? wordIndexes[0]
    : undefined;

  return (
    <>
      {parts.map((part, index) => {
        if (!part.trim()) return <span key={`${cue.id}:space:${index}`}>{part}</span>;
        return (
          <span
            className={`yll-word ${index === activeWordPartIndex ? "active" : ""}`}
            key={`${cue.id}:word:${index}:${part}`}
            role="button"
            tabIndex={0}
            title="点击查看单词翻译"
            onClick={(event) => {
              event.stopPropagation();
              onWordClick(part, cue);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onWordClick(part, cue);
              }
            }}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}

function CueRow({
  cue,
  isActive,
  rowRef,
  onSeek,
  onPractice,
  onSave
}: {
  cue: TranslatedCue;
  isActive: boolean;
  rowRef?: (node: HTMLDivElement | null) => void;
  onSeek: () => void;
  onPractice: () => void;
  onSave: () => void;
}) {
  return (
    <div ref={rowRef} className={`yll-cue-row ${isActive ? "active" : ""}`} role="button" tabIndex={0} onClick={onSeek} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSeek();
      }
    }}>
      <span className="yll-time">{msToClock(cue.startMs)}</span>
      <span className="yll-cue-main">
        <strong>{cue.text}</strong>
        <span>{cue.translatedText ?? "未翻译"}</span>
      </span>
      <span className="yll-inline-actions" onClick={(event) => event.stopPropagation()}>
        <button className="yll-icon-button" type="button" title="练习这一句" onClick={onPractice}>
          <Mic size={14} />
        </button>
        <button className="yll-icon-button" type="button" title="收藏句子" onClick={onSave}>
          <Bookmark size={14} />
        </button>
      </span>
    </div>
  );
}

function PracticeOverlay({
  cues,
  videoContext,
  settings,
  startIndex,
  source,
  onClose,
  onSaveSentence
}: {
  cues: TranslatedCue[];
  videoContext?: VideoContext;
  settings: ExtensionSettings;
  startIndex: number;
  source: "current-video" | "saved-library";
  onClose: () => void;
  onSaveSentence: (cue: TranslatedCue) => Promise<void>;
}) {
  const [index, setIndex] = useState(startIndex);
  const [mode, setMode] = useState<"shadowing" | "dictation" | "cloze" | "quiz">("shadowing");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState<SpeechScore | null>(null);
  const [textScore, setTextScore] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const activeCue = cues[Math.min(index, cues.length - 1)];
  const recorder = useMediaRecorder(activeCue?.sourceLanguage ?? settings.sourceLanguage);
  const video = getVideoElement();

  const go = useCallback(
    (nextIndex: number) => {
      const bounded = Math.max(0, Math.min(cues.length - 1, nextIndex));
      setIndex(bounded);
      setAnswer("");
      setScore(null);
      setTextScore(null);
      const cue = cues[bounded];
      if (cue && source === "current-video") {
        seekToCue(cue);
        if (settings.autoPauseInPractice) {
          window.setTimeout(() => getVideoElement()?.pause(), Math.max(700, cue.durationMs));
        }
      }
    },
    [cues, settings.autoPauseInPractice, source]
  );

  useEffect(() => {
    go(startIndex);
  }, [go, startIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key.toLowerCase() === "l" && activeCue) seekToCue(activeCue);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCue, go, index, onClose]);

  const startRecording = async () => {
    setScore(null);
    await recorder.start();
  };

  const stopRecording = async () => {
    setIsBusy(true);
    const result = await recorder.stop();
    const response = await sendRuntimeMessage<SpeechScore>({
      type: "SCORE_SPEECH",
      payload: {
        expected: activeCue.text,
        transcript: result.transcript,
        recordingDurationMs: result.durationMs,
        language: activeCue.sourceLanguage
      }
    });
    setIsBusy(false);
    if (response.ok) {
      setScore(response.data);
      await sendRuntimeMessage({
        type: "SAVE_PRACTICE_ATTEMPT",
        payload: {
          practiceItemId: activeCue.id,
          cueId: activeCue.id,
          mode: "shadowing",
          expected: activeCue.text,
          answer: result.transcript,
          score: response.data.overall,
          speechScore: response.data,
          durationMs: result.durationMs
        }
      });
    }
  };

  const checkTextAnswer = async () => {
    const expected = mode === "dictation" ? activeCue.text : clozeAnswer(activeCue.text).join(" ");
    const nextScore = wordSimilarity(expected, answer);
    setTextScore(nextScore);
    await sendRuntimeMessage({
      type: "SAVE_PRACTICE_ATTEMPT",
      payload: {
        practiceItemId: activeCue.id,
        cueId: activeCue.id,
        mode,
        expected,
        answer,
        score: nextScore,
        durationMs: 0
      }
    });
  };

  return (
    <div className="yll-practice">
      <div className="yll-practice-top">
        <button className="yll-button ghost" type="button" onClick={onClose}>
          <X size={14} />
          退出
        </button>
        <div>
          {index + 1} / {cues.length}
        </div>
        <div className="yll-practice-timer">
          <span>{source === "current-video" ? "当前视频" : "收藏句库"}</span>
        </div>
      </div>

      <main className="yll-practice-main">
        <section className="yll-media-card" aria-label="练习素材">
          {videoContext?.thumbnailUrl ? <img src={videoContext.thumbnailUrl} alt="" /> : null}
          <div className="yll-wave" aria-hidden="true">
            {Array.from({ length: 44 }).map((_, waveIndex) => (
              <span key={waveIndex} style={{ "--bar": `${8 + ((waveIndex * 13) % 32)}px` } as CSSProperties} />
            ))}
          </div>
          <div className="yll-media-title">{videoContext?.title ?? "Saved sentence practice"}</div>
        </section>

        <section className="yll-practice-stage">
          <div className="yll-mode-tabs" aria-label="练习模式">
            <button className={mode === "shadowing" ? "active" : ""} type="button" onClick={() => setMode("shadowing")}>
              跟读
            </button>
            <button className={mode === "dictation" ? "active" : ""} type="button" onClick={() => setMode("dictation")}>
              听写
            </button>
            <button className={mode === "cloze" ? "active" : ""} type="button" onClick={() => setMode("cloze")}>
              填空
            </button>
            <button className={mode === "quiz" ? "active" : ""} type="button" onClick={() => setMode("quiz")}>
              理解
            </button>
          </div>

          {mode === "cloze" ? (
            <p className="yll-practice-sentence">{clozePrompt(activeCue.text)}</p>
          ) : mode === "dictation" ? (
            <p className="yll-practice-sentence">听原声，写下完整句子</p>
          ) : (
            <p className="yll-practice-sentence">{activeCue.text}</p>
          )}
          <p className="yll-practice-translation">{mode === "dictation" ? "提示：可先播放一次，再输入你听到的内容。" : activeCue.translatedText ?? "译文待生成"}</p>

          {mode === "shadowing" ? (
            <>
              <div className="yll-practice-action-row">
                <button className="yll-round secondary" type="button" title="播放原句" onClick={() => seekToCue(activeCue)}>
                  <Ear size={19} />
                </button>
                <button
                  className="yll-round"
                  type="button"
                  title={recorder.isRecording ? "停止录音并评分" : "开始跟读录音"}
                  disabled={isBusy}
                  onClick={recorder.isRecording ? stopRecording : startRecording}
                >
                  {recorder.isRecording ? <Pause size={21} /> : <Mic size={21} />}
                </button>
                <button className="yll-round secondary" type="button" title="收藏句子" onClick={() => onSaveSentence(activeCue)}>
                  <Heart size={18} />
                </button>
              </div>
              {recorder.isRecording ? <div className="yll-status">录音中 {Math.round(recorder.durationMs / 1000)}s {recorder.transcript}</div> : null}
              {score ? <SpeechScoreCard score={score} /> : null}
            </>
          ) : mode === "quiz" ? (
            <Quiz cue={activeCue} cues={cues} onAnswered={setTextScore} />
          ) : (
            <>
              <textarea
                className="yll-answer-box"
                value={answer}
                placeholder={mode === "dictation" ? "输入你听到的完整句子..." : "输入被隐藏的关键词..."}
                onChange={(event) => setAnswer(event.target.value)}
              />
              <div className="yll-practice-action-row">
                <button className="yll-button" type="button" onClick={() => seekToCue(activeCue)}>
                  <Play size={14} />
                  播放原句
                </button>
                <button className="yll-button primary" type="button" onClick={checkTextAnswer}>
                  <FileQuestion size={14} />
                  判分
                </button>
              </div>
              {textScore !== null ? <div className="yll-status">本次匹配度：{textScore} / 100</div> : null}
            </>
          )}
        </section>
      </main>

      <footer className="yll-practice-bottom">
        <span />
        <div className="yll-bottom-center">
          <button className="yll-icon-button" type="button" title="上一句" onClick={() => go(index - 1)}>
            <ChevronLeft size={17} />
          </button>
          <button className="yll-icon-button" type="button" title="重播" onClick={() => seekToCue(activeCue)}>
            <RotateCcw size={16} />
          </button>
          <button className="yll-icon-button" type="button" title={video?.paused ? "播放" : "暂停"} onClick={() => (video?.paused ? void video.play() : video?.pause())}>
            {video?.paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button className="yll-icon-button" type="button" title="下一句" onClick={() => go(index + 1)}>
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="yll-shortcuts">
          上一句 <span className="yll-key">←</span> 下一句 <span className="yll-key">→</span> 重听 <span className="yll-key">L</span> 退出 <span className="yll-key">Esc</span>
        </div>
      </footer>
    </div>
  );
}

function SpeechScoreCard({ score }: { score: SpeechScore }) {
  return (
    <div className="yll-score">
      <strong>AI 跟读评分：{score.overall} / 100</strong>
      <div className="yll-score-grid">
        <div>发音 {score.pronunciation}</div>
        <div>流利 {score.fluency}</div>
        <div>完整 {score.completeness}</div>
        <div>语义 {score.semanticMatch}</div>
      </div>
      <span>{score.feedback}</span>
      {score.transcript ? <span>转写：{score.transcript}</span> : null}
    </div>
  );
}

function Quiz({ cue, cues, onAnswered }: { cue: TranslatedCue; cues: TranslatedCue[]; onAnswered: (score: number) => void }) {
  const options = useMemo(() => {
    const distractors = cues
      .filter((item) => item.id !== cue.id && item.translatedText)
      .slice(0, 3)
      .map((item) => item.translatedText as string);
    return shuffle([cue.translatedText ?? cue.text, ...distractors]).slice(0, 4);
  }, [cue, cues]);

  return (
    <div className="yll-score">
      {options.map((option) => (
        <button
          className="yll-button"
          type="button"
          key={option}
          onClick={() => onAnswered(normalizeText(option) === normalizeText(cue.translatedText ?? cue.text) ? 100 : 0)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function mergeTranslations(sourceCues: CaptionCue[], translatedCues: TranslatedCue[], targetLanguage: string): TranslatedCue[] {
  const byStart = new Map(translatedCues.map((cue) => [Math.round(cue.startMs / 100), cue]));
  return sourceCues.map((cue) => {
    const translated = byStart.get(Math.round(cue.startMs / 100));
    return {
      ...cue,
      targetLanguage,
      translatedText: translated?.translatedText,
      provider: translated ? "youtube" : "none",
      cachedAt: translated?.cachedAt
    };
  });
}

function findActiveCue(cues: TranslatedCue[], currentTimeSeconds: number): TranslatedCue | undefined {
  const currentMs = currentTimeSeconds * 1000;
  return cues.find((cue) => currentMs >= cue.startMs && currentMs < cue.startMs + cue.durationMs);
}

function findCueByText(cues: TranslatedCue[], textKey: string, currentMs?: number): TranslatedCue | undefined {
  if (!textKey) return undefined;

  return cues
    .map((cue) => {
      const cueKey = normalizeText(cue.text);
      if (!cueKey) return { cue, score: 0, textScore: 0 };
      const proximityScore = typeof currentMs === "number" ? scoreCueTimeProximity(cue, currentMs) : 0;
      if (cueKey === textKey) return { cue, score: 1000 + proximityScore, textScore: 1000 };
      if (cueKey.includes(textKey) || textKey.includes(cueKey)) {
        const textScore = Math.min(cueKey.length, textKey.length);
        return { cue, score: textScore + proximityScore, textScore };
      }
      const renderedWords = new Set(textKey.split(/\s+/).filter(Boolean));
      const cueWords = cueKey.split(/\s+/).filter(Boolean);
      const overlap = cueWords.filter((word) => renderedWords.has(word)).length;
      return { cue, score: overlap + proximityScore, textScore: overlap };
    })
    .filter((item) => item.textScore >= (typeof currentMs === "number" ? 1 : 2))
    .sort((a, b) => b.score - a.score)[0]?.cue;
}

function scoreCueTimeProximity(cue: TranslatedCue, currentMs: number): number {
  const cueEndMs = cue.startMs + cue.durationMs;
  if (currentMs >= cue.startMs - 600 && currentMs <= cueEndMs + 600) return 500;

  const distanceMs = currentMs < cue.startMs ? cue.startMs - currentMs : currentMs - cueEndMs;
  if (distanceMs <= 3000) return Math.max(0, 240 - distanceMs / 15);
  if (distanceMs <= 9000) return Math.max(0, 80 - distanceMs / 150);
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatOffset(offsetMs: number): string {
  const seconds = Math.abs(offsetMs / 1000).toFixed(1);
  return offsetMs > 0 ? `提前 ${seconds}s` : `延后 ${seconds}s`;
}

function clozeAnswer(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  return words.filter((word, index) => word.length > 4 && index % 3 === 1).slice(0, 4);
}

function clozePrompt(text: string): string {
  const hidden = new Set(clozeAnswer(text).map(normalizeText));
  return text
    .split(/\s+/)
    .map((word) => (hidden.has(normalizeText(word)) ? "____" : word))
    .join(" ");
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}
