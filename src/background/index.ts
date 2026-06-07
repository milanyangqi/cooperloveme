import { translateCuesWithAi, explainSelection, scoreSpeechWithAi } from "./ai";
import { buildExportBundle, clearAllStores, deleteRecord, getRecord, listByUser, putRecord } from "./db";
import { ensureLocalUser, loadEntitlement, loadSecrets, loadSettings, saveSecrets, saveSettings } from "./settings";
import {
  clearAdminEntitlementOverride,
  clearSupabaseSession,
  createBillingCheckout,
  getAdminAccess,
  getAdminUserDetail,
  getSupabaseDataSession,
  listAdminUsers,
  loadRemoteAccount,
  loadRemoteAccountWithFallback,
  saveAdminEntitlementOverride,
  signInWithEmail,
  signUpWithEmail
} from "./supabaseAuth";
import { createId, normalizeText } from "../shared/ids";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../shared/supabaseConfig";
import type {
  ExtensionSettings,
  PracticeAttempt,
  RuntimeRequest,
  RuntimeResponse,
  SentenceNote,
  UsageEvent,
  UsageFeature,
  VocabItem,
  Wordbook
} from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  void ensureLocalUser();
  void wakeExistingYouTubeWatchTabs("installed");
});

chrome.runtime.onStartup.addListener(() => {
  void wakeExistingYouTubeWatchTabs("startup");
});

chrome.action.onClicked.addListener((tab) => {
  void handleActionClick(tab);
});

chrome.runtime.onMessage.addListener((message: RuntimeRequest, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data } satisfies RuntimeResponse))
    .catch((error: unknown) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown extension error"
      } satisfies RuntimeResponse)
    );

  return true;
});

async function handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) {
    await openBundledOptionsPage();
    return;
  }

  const parsed = new URL(tab.url);
  if (!parsed.hostname.includes("youtube.com")) {
    await openBundledOptionsPage();
    return;
  }

  await ensureCurrentContentScript(tab.id);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.dispatchEvent(new Event("yll-toggle-popup-dock"))
  });
}

async function openBundledOptionsPage(): Promise<void> {
  await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
}

async function ensureCurrentContentScript(tabId: number): Promise<void> {
  const expectedVersion = chrome.runtime.getManifest().version;
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (version: string) => {
      const page = window as Window & {
        __yllSafeScriptVersion?: string;
        __yllSafeStopCurrentScript?: () => void;
      };
      return page.__yllSafeScriptVersion === version;
    },
    args: [expectedVersion]
  });

  if (probe?.result) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const page = window as Window & {
        __yllSafeStopCurrentScript?: () => void;
        __yllSafeTimer?: number;
        __yllSafeOverlayTimer?: number;
        __yllSafeOfficialRetryTimer?: number;
      };
      page.__yllSafeStopCurrentScript?.();
      if (page.__yllSafeTimer) window.clearInterval(page.__yllSafeTimer);
      if (page.__yllSafeOverlayTimer) window.clearInterval(page.__yllSafeOverlayTimer);
      if (page.__yllSafeOfficialRetryTimer) window.clearTimeout(page.__yllSafeOfficialRetryTimer);
      [
        "yll-lab-panel-v2",
        "yll-lab-overlay-v2",
        "yll-lab-word-popover-v2",
        "yll-lab-settings-v2",
        "yll-lab-practice-v2",
        "yll-lab-library-v2",
        "yll-lab-debug-v2",
        "yll-lab-popup-dock-v2",
        "yll-lab-style-v2"
      ].forEach((id) => document.getElementById(id)?.remove());
      document.documentElement.classList.remove("yll-hide-native-captions");
    }
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["assets/content.js"]
  });
}

async function wakeExistingYouTubeWatchTabs(reason: string): Promise<void> {
  const tabs = await chrome.tabs
    .query({
      url: ["https://www.youtube.com/watch*", "https://youtube.com/watch*"]
    })
    .catch(() => []);
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab.id) return;
      try {
        await ensureCurrentContentScript(tab.id);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (reloadReason: string) => {
            window.dispatchEvent(new CustomEvent("yll-safe-reload", { detail: { reason: reloadReason } }));
          },
          args: [`auto-${reason}`]
        });
      } catch {
        // Some YouTube tabs can be prerendered or unavailable during extension startup.
      }
    })
  );
}

async function handleMessage(message: RuntimeRequest, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case "READ_ACTIVE_PAGE_WORDS":
      return readActivePageWords(sender);

    case "READ_PAGE_PLAYER_RESPONSE":
      if (!sender.tab?.id) {
        throw new Error("只能从 YouTube 视频页面读取播放器字幕信息。");
      }
      return readLivePlayerSnapshot(sender.tab.id);

    case "FETCH_CAPTION_TEXT":
      return fetchCaptionText(message.payload.url);

    case "FETCH_CAPTION_TEXT_MAIN":
      if (!sender.tab?.id) {
        throw new Error("只能从当前 YouTube 视频页面读取主世界字幕。");
      }
      return fetchCaptionTextInMainWorld(sender.tab.id, message.payload.url);

    case "INSTALL_TIMEDTEXT_BRIDGE":
      if (!sender.tab?.id) {
        throw new Error("只能在当前 YouTube 视频页面安装字幕桥接。");
      }
      return installTimedTextBridge(sender.tab.id);

    case "FETCH_YOUTUBEI_PLAYER":
      return fetchYoutubeiPlayer(message.payload);

    case "FETCH_YOUTUBEI_TRANSCRIPT":
      return fetchYoutubeiTranscript(message.payload);

    default:
      break;
  }

  const localUser = await ensureLocalUser();

  switch (message.type) {
    case "GET_BOOTSTRAP": {
      const [settings, secrets, localEntitlement, library, remote] = await Promise.all([
        loadSettings(),
        loadSecrets(),
        loadEntitlement(localUser.id),
        loadLibrary(localUser.id),
        loadRemoteAccountWithFallback()
      ]);

      return {
        user: remote.user ?? localUser,
        localUser,
        auth: remote.auth,
        settings,
        secrets: { aiApiKey: secrets.aiApiKey ? "configured" : "" },
        entitlement: remote.entitlement ?? localEntitlement,
        library
      };
    }

    case "SIGN_UP_EMAIL":
      return signUpWithEmail(message.payload);

    case "SIGN_IN_EMAIL":
      return signInWithEmail(message.payload);

    case "SIGN_OUT":
      return clearSupabaseSession();

    case "START_BILLING_CHECKOUT":
      return createBillingCheckout();

    case "ADMIN_ME":
      return getAdminAccess();

    case "ADMIN_LIST_USERS":
      return listAdminUsers(message.payload);

    case "ADMIN_GET_USER":
      return getAdminUserDetail(message.payload.userId);

    case "ADMIN_SAVE_OVERRIDE":
      return saveAdminEntitlementOverride(message.payload);

    case "ADMIN_CLEAR_OVERRIDE":
      return clearAdminEntitlementOverride(message.payload.userId, message.payload.reason);

    case "UPDATE_SETTINGS":
      return saveSettingsAndMaybeSync(localUser.id, message.payload);

    case "UPDATE_SECRETS":
      return saveSecrets(message.payload);

    case "GET_LIBRARY":
      return loadLibrary(localUser.id);

    case "SYNC_LIBRARY": {
      const result = await syncLearningData(localUser.id);
      notifyLibraryChanged();
      return result;
    }

    case "PULL_LIBRARY": {
      const result = await pullLearningData(localUser.id);
      notifyLibraryChanged();
      return result;
    }

    case "CREATE_WORDBOOK":
      return createWordbook(localUser.id, message.payload.name, message.payload.description);

    case "DELETE_WORDBOOK":
      return deleteWordbook(localUser.id, message.payload.id);

    case "DELETE_VOCAB":
      return deleteVocabItem(localUser.id, message.payload.id);

    case "UPDATE_VOCAB_MASTERY":
      return updateVocabMastery(localUser.id, message.payload.id, message.payload.mastery);

    case "UPSERT_VOCAB_MASTERY":
      return upsertVocabMastery(localUser.id, message.payload);

    case "SAVE_SENTENCE": {
      const now = new Date().toISOString();
      const note: SentenceNote = {
        ...message.payload,
        id: createId("sentence"),
        userId: localUser.id,
        createdAt: now,
        updatedAt: now,
        syncStatus: "local-only"
      };
      const saved = await putRecord("sentenceNotes", note);
      await syncRecordIfEnabled("sentenceNotes", saved);
      notifyLibraryChanged();
      return saved;
    }

    case "DELETE_SENTENCE":
      return deleteSentenceNote(localUser.id, message.payload.id);

    case "SAVE_VOCAB": {
      const now = new Date().toISOString();
      const wordbook = message.payload.wordbookId
        ? undefined
        : await ensureDefaultWordbook(localUser.id);
      const item: VocabItem = {
        ...message.payload,
        id: createId("vocab"),
        userId: localUser.id,
        wordbookId: message.payload.wordbookId ?? wordbook?.id,
        normalizedText: normalizeText(message.payload.text),
        mastery: 0,
        createdAt: now,
        updatedAt: now,
        syncStatus: "local-only"
      };
      const saved = await putRecord("vocabItems", item);
      await syncRecordIfEnabled("vocabItems", saved);
      notifyLibraryChanged();
      return saved;
    }

    case "IMPORT_VOCAB": {
      const now = new Date().toISOString();
      const defaultWordbook = await ensureDefaultWordbook(localUser.id);
      const wordbookId = message.payload.wordbookId ?? defaultWordbook.id;
      const existing = await listByUser<VocabItem>("vocabItems", localUser.id);
      const existingKeys = new Set(existing.map((item) => `${item.wordbookId ?? defaultWordbook.id}:${normalizeText(item.text)}`));
      const imported: VocabItem[] = [];

      for (const draft of message.payload.items) {
        const text = draft.text.trim();
        if (!text) continue;
        const key = `${wordbookId ?? ""}:${normalizeText(text)}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const item: VocabItem = {
          text,
          language: draft.language || "en",
          meaning: draft.meaning,
          sourceSentence: draft.sourceSentence,
          translatedSentence: draft.translatedSentence,
          id: createId("vocab"),
          userId: localUser.id,
          wordbookId,
          normalizedText: normalizeText(text),
          mastery: 0,
          createdAt: now,
          updatedAt: now,
          syncStatus: "local-only"
        };
        const saved = await putRecord("vocabItems", item);
        imported.push(saved);
        await syncRecordIfEnabled("vocabItems", saved);
      }

      if (imported.length) notifyLibraryChanged();
      return { imported: imported.length, items: imported };
    }

    case "SAVE_PRACTICE_ATTEMPT": {
      const attempt: PracticeAttempt = {
        ...message.payload,
        id: createId("attempt"),
        userId: localUser.id,
        createdAt: new Date().toISOString(),
        syncStatus: "local-only"
      };
      const saved = await putRecord("practiceAttempts", attempt);
      await syncRecordIfEnabled("practiceAttempts", saved);
      notifyLibraryChanged();
      return saved;
    }

    case "TRANSLATE_CUES": {
      const [settings, secrets] = await Promise.all([loadSettings(), loadSecrets()]);
      const usesPaidAi = settings.ai.enabled && Boolean(secrets.aiApiKey.trim());
      if (usesPaidAi) {
        await guardQuota(localUser.id, "translate", message.payload.cues.length);
      }

      const translated = await translateCuesWithAi(
        settings,
        secrets,
        message.payload.videoContext,
        message.payload.cues,
        message.payload.targetLanguage
      );

      if (usesPaidAi) {
        await recordUsage(localUser.id, "translate", message.payload.cues.length, "success", {
          videoId: message.payload.videoContext.videoId
        });
      }

      return translated;
    }

    case "EXPLAIN_SELECTION": {
      await guardQuota(localUser.id, "explain", 1);
      const [settings, secrets] = await Promise.all([loadSettings(), loadSecrets()]);
      const explanation = await explainSelection(
        settings,
        secrets,
        message.payload.text,
        message.payload.sentence,
        message.payload.targetLanguage
      );
      await recordUsage(localUser.id, "explain", 1, "success");
      return explanation;
    }

    case "SCORE_SPEECH": {
      await guardQuota(localUser.id, "speechScore", 1);
      const [settings, secrets] = await Promise.all([loadSettings(), loadSecrets()]);
      const score = await scoreSpeechWithAi(
        settings,
        secrets,
        message.payload.expected,
        message.payload.transcript,
        message.payload.recordingDurationMs,
        message.payload.language
      );
      await recordUsage(localUser.id, "speechScore", 1, "success", { provider: score.provider });
      return score;
    }

    case "EXPORT_DATA": {
      const [settings, entitlement] = await Promise.all([loadSettings(), loadEffectiveEntitlement(localUser.id)]);
      return buildExportBundle({
        exportedAt: new Date().toISOString(),
        user: localUser,
        entitlement,
        settings
      });
    }

    case "CLEAR_LOCAL_DATA":
      await clearAllStores();
      return { cleared: true };

    default:
      return assertNever(message);
  }
}

async function fetchYoutubeiPlayer(payload: {
  videoId: string;
  innertubeApiKey?: string;
  innertubeClientVersion?: string;
  visitorData?: string;
}): Promise<unknown> {
  const endpoint = new URL("https://www.youtube.com/youtubei/v1/player");
  endpoint.searchParams.set("prettyPrint", "false");
  if (payload.innertubeApiKey) endpoint.searchParams.set("key", payload.innertubeApiKey);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "origin": "https://www.youtube.com"
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: payload.innertubeClientVersion || "2.20240501.00.00",
          visitorData: payload.visitorData || undefined
        }
      },
      videoId: payload.videoId,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: "HTML5_PREF_WANTS"
        }
      },
      contentCheckOk: true,
      racyCheckOk: true
    })
  });

  if (!response.ok) {
    throw new Error(`youtubei player 请求失败：HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchYoutubeiTranscript(payload: {
  params: string;
  innertubeApiKey?: string;
  innertubeClientVersion?: string;
  visitorData?: string;
}): Promise<unknown> {
  const endpoint = new URL("https://www.youtube.com/youtubei/v1/get_transcript");
  endpoint.searchParams.set("prettyPrint", "false");
  if (payload.innertubeApiKey) endpoint.searchParams.set("key", payload.innertubeApiKey);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "origin": "https://www.youtube.com"
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: payload.innertubeClientVersion || "2.20240501.00.00",
          visitorData: payload.visitorData || undefined
        }
      },
      params: payload.params
    })
  });

  if (!response.ok) {
    throw new Error(`youtubei transcript 请求失败：HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchCaptionText(url: string): Promise<{ body: string; finalUrl: string; status: number; contentType: string }> {
  const parsed = new URL(url);
  const allowed =
    parsed.protocol === "https:" &&
    (parsed.hostname === "youtube.com" ||
      parsed.hostname.endsWith(".youtube.com") ||
      parsed.hostname.endsWith(".googlevideo.com"));

  if (!allowed) {
    throw new Error("字幕地址不在允许读取的 YouTube 域名范围内。");
  }

  const response = await fetch(parsed.toString(), {
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`字幕请求失败：HTTP ${response.status}`);
  }

  return {
    body: await response.text(),
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get("content-type") ?? ""
  };
}

async function fetchCaptionTextInMainWorld(tabId: number, url: string): Promise<{ body: string; finalUrl: string; status: number; contentType: string }> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [url],
    func: async (captionUrl: string) => {
      const parsed = new URL(captionUrl, location.href);
      const allowed =
        parsed.protocol === "https:" &&
        (parsed.hostname === "youtube.com" ||
          parsed.hostname.endsWith(".youtube.com") ||
          parsed.hostname.endsWith(".googlevideo.com"));

      if (!allowed) {
        throw new Error("字幕地址不在允许读取的 YouTube 域名范围内。");
      }

      const response = await fetch(parsed.toString(), {
        credentials: "include",
        cache: "no-store",
        redirect: "follow",
        referrer: location.href,
        referrerPolicy: "strict-origin-when-cross-origin"
      });

      return {
        body: await response.text(),
        finalUrl: response.url,
        status: response.status,
        contentType: response.headers.get("content-type") ?? ""
      };
    }
  });

  return injection?.result ?? { body: "", finalUrl: url, status: 0, contentType: "" };
}

async function installTimedTextBridge(tabId: number): Promise<{ installed: boolean }> {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const win = window as unknown as {
        __yllTimedTextBridgeInstalled?: boolean;
        fetch: typeof window.fetch;
        XMLHttpRequest: typeof window.XMLHttpRequest;
      };
      if (win.__yllTimedTextBridgeInstalled) return;
      win.__yllTimedTextBridgeInstalled = true;

      const emit = (url: string, body: string, status: number, contentType = "") => {
        try {
          const parsed = new URL(url, location.href);
          if (!parsed.pathname.includes("/api/timedtext")) return;
          window.postMessage({
            source: "yll-timedtext-bridge",
            type: "timedtext-body",
            url: parsed.toString(),
            body,
            status,
            contentType,
            capturedAt: Date.now()
          }, "*");
        } catch {
          // Ignore malformed URLs.
        }
      };

      const originalFetch = win.fetch.bind(window);
      win.fetch = async (...args: Parameters<typeof fetch>) => {
        const response = await originalFetch(...args);
        try {
          const request = args[0];
          const url = typeof request === "string" ? request : request instanceof URL ? request.toString() : request.url;
          if (url.includes("/api/timedtext")) {
            const clone = response.clone();
            void clone.text().then((body) => emit(url, body, clone.status, clone.headers.get("content-type") ?? "")).catch(() => undefined);
          }
        } catch {
          // Preserve page fetch behavior.
        }
        return response;
      };

      const OriginalXHR = win.XMLHttpRequest;
      const xhrPrototype = OriginalXHR.prototype as XMLHttpRequest & {
        open: (...args: unknown[]) => void;
        send: (...args: unknown[]) => void;
      };
      const originalOpen = xhrPrototype.open;
      const originalSend = xhrPrototype.send;
      xhrPrototype.open = function open(...args: unknown[]) {
        const [, url] = args;
        (this as XMLHttpRequest & { __yllTimedTextUrl?: string }).__yllTimedTextUrl = String(url);
        return originalOpen.apply(this, args);
      };
      xhrPrototype.send = function send(...args: unknown[]) {
        const xhr = this as XMLHttpRequest & { __yllTimedTextUrl?: string };
        if (xhr.__yllTimedTextUrl?.includes("/api/timedtext")) {
          this.addEventListener("load", () => {
            try {
              const body = typeof xhr.responseText === "string" ? xhr.responseText : "";
              emit(xhr.__yllTimedTextUrl ?? "", body, xhr.status, xhr.getResponseHeader("content-type") ?? "");
            } catch {
              // Ignore response access errors.
            }
          });
        }
        return originalSend.apply(this, args);
      };
    }
  });

  return { installed: true };
}

async function readLivePlayerSnapshot(tabId: number): Promise<unknown> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const safe = <T>(read: () => T): T | undefined => {
        try {
          return read();
        } catch {
          return undefined;
        }
      };
      const parseMaybeJson = (value: unknown): unknown => {
        if (typeof value !== "string") return value;
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      };
      const looksLikeCaptionTrack = (value: unknown): boolean => {
        if (!value || typeof value !== "object") return false;
        const item = value as Record<string, unknown>;
        const hasUrl = typeof item.baseUrl === "string" || typeof item.base_url === "string" || typeof item.url === "string";
        const hasLanguage =
          typeof item.languageCode === "string" ||
          typeof item.language_code === "string" ||
          typeof item.vssId === "string";
        return hasUrl && hasLanguage;
      };
      const extractCaptionTracks = (value: unknown, maxDepth = 6): unknown[] => {
        const seen = new WeakSet<object>();
        const found: unknown[] = [];

        const visit = (current: unknown, depth: number, keyHint = "") => {
          if (depth > maxDepth || !current || typeof current !== "object") return;
          const objectValue = current as Record<string, unknown>;
          if (seen.has(objectValue)) return;
          seen.add(objectValue);

          if (Array.isArray(current)) {
            if (
              keyHint === "captionTracks" ||
              current.some(looksLikeCaptionTrack)
            ) {
              found.push(...current.filter(looksLikeCaptionTrack));
              return;
            }

            current.slice(0, 60).forEach((item) => visit(item, depth + 1, keyHint));
            return;
          }

          Object.entries(objectValue).forEach(([key, child]) => {
            if (key === "captionTracks" && Array.isArray(child)) {
              found.push(...child.filter(looksLikeCaptionTrack));
              return;
            }
            if (key.toLowerCase().includes("caption") || depth < 3) {
              visit(child, depth + 1, key);
            }
          });
        };

        visit(value, 0);
        return found;
      };
      const extractTranscriptParams = (value: unknown, maxDepth = 8): string[] => {
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
            current.slice(0, 120).forEach((item) => visit(item, depth + 1));
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
      };

      const win = window as unknown as {
        ytInitialPlayerResponse?: unknown;
        ytInitialData?: unknown;
        ytcfg?: { get?: (key: string) => unknown };
        ytplayer?: { config?: { args?: { raw_player_response?: unknown; player_response?: unknown } } };
      };
      type YouTubePlayerElement = HTMLElement & {
        getPlayerResponse?: () => unknown;
        getVideoData?: () => unknown;
        getOption?: (section: string, key: string) => unknown;
        player_?: YouTubePlayerElement;
      };
      const playerCandidates = [
        document.getElementById("movie_player"),
        document.querySelector(".html5-video-player"),
        (document.querySelector("ytd-player") as YouTubePlayerElement | null)?.player_
      ].filter(Boolean) as YouTubePlayerElement[];
      const player = playerCandidates.find((candidate) => typeof candidate.getPlayerResponse === "function" || typeof candidate.getOption === "function") ?? playerCandidates[0] ?? null;

      const playerResponse =
        safe(() => player?.getPlayerResponse?.()) ??
        win.ytInitialPlayerResponse ??
        parseMaybeJson(win.ytplayer?.config?.args?.raw_player_response) ??
        parseMaybeJson(win.ytplayer?.config?.args?.player_response);
      const videoData = safe(() => player?.getVideoData?.());
      const tracklist =
        safe(() => player?.getOption?.("captions", "tracklist")) ??
        safe(() => player?.getOption?.("captions", "captionTracks")) ??
        safe(() => player?.getOption?.("captions", "playerCaptionsTracklistRenderer"));

      const captionTracks = [
        ...extractCaptionTracks(tracklist),
        ...extractCaptionTracks(playerResponse)
      ].filter((track, index, tracks) => {
        const current = track as { baseUrl?: string; base_url?: string; url?: string };
        const currentUrl = current.baseUrl ?? current.base_url ?? current.url;
        return Boolean(currentUrl) && tracks.findIndex((item) => {
          const candidate = item as { baseUrl?: string; base_url?: string; url?: string };
          return (candidate.baseUrl ?? candidate.base_url ?? candidate.url) === currentUrl;
        }) === index;
      });
      const playerCaptionTracks = Array.isArray(tracklist) ? tracklist.filter(looksLikeCaptionTrack) : extractCaptionTracks(tracklist);

      return JSON.parse(
        JSON.stringify({
          playerResponse,
          videoData,
          captionTracks,
          playerCaptionTracks,
          transcriptParams: [
            ...extractTranscriptParams(win.ytInitialData),
            ...extractTranscriptParams(playerResponse)
          ].filter((params, index, all) => all.indexOf(params) === index),
          innertubeApiKey: safe(() => win.ytcfg?.get?.("INNERTUBE_API_KEY")),
          innertubeClientVersion: safe(() => win.ytcfg?.get?.("INNERTUBE_CLIENT_VERSION")),
          visitorData: safe(() => win.ytcfg?.get?.("VISITOR_DATA")),
          href: location.href
        })
      );
    }
  });

  return injection?.result ?? {};
}

async function readActivePageWords(sender?: chrome.runtime.MessageSender): Promise<{
  version?: string;
  videoId?: string;
  words: Array<{ text: string; sourceSentence?: string; translatedSentence?: string }>;
}> {
  const tab = sender?.tab?.id && sender.tab.url ? sender.tab : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab?.id || !tab.url) return { words: [] };

  const parsed = new URL(tab.url);
  if (!parsed.hostname.includes("youtube.com") || parsed.pathname !== "/watch") return { words: [] };

  const [injection] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      type SafeRow = {
        text?: string;
        translatedText?: string;
        start?: number;
      };
      const page = window as Window & {
        __yllSafeScriptVersion?: string;
        __yllSafeRows?: SafeRow[];
        __yllSafeLoadedVideoId?: string;
      };
      const cleanToken = (token: string) =>
        token
          .toLowerCase()
          .replace(/^[^a-z]+|[^a-z]+$/g, "")
          .replace(/'{2,}/g, "'");
      const stopWords = new Set([
        "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "can", "could", "did", "do", "does",
        "for", "from", "had", "has", "have", "he", "her", "here", "him", "his", "i", "if", "in", "is", "it", "its",
        "me", "my", "of", "on", "or", "our", "she", "so", "than", "that", "the", "their", "them", "then", "there",
        "these", "they", "this", "those", "to", "us", "was", "we", "were", "what", "when", "where", "which", "who",
        "will", "with", "would", "you", "your", "ve", "re", "ll"
      ]);
      const rows: SafeRow[] = [];
      const seenRows = new Set<string>();
      const pushRow = (row: SafeRow) => {
        const text = typeof row.text === "string" ? row.text.trim() : "";
        if (!text) return;
        const start = Number.isFinite(row.start) ? Number(row.start) : 0;
        const key = `${start}:${text}`;
        if (seenRows.has(key)) return;
        seenRows.add(key);
        rows.push({
          text,
          translatedText: typeof row.translatedText === "string" ? row.translatedText.trim() : undefined,
          start
        });
      };
      if (Array.isArray(page.__yllSafeRows)) {
        page.__yllSafeRows.forEach(pushRow);
      }
      Array.from(document.querySelectorAll<HTMLElement>("#yll-lab-list-v2 .yll-row")).forEach((row) => {
        const rowText = row.textContent?.trim() ?? "";
        const translatedText = row.querySelector<HTMLElement>(".yll-translation")?.textContent?.trim();
        const sourceText = row.querySelector<HTMLElement>(".yll-text")?.textContent?.trim();
        const fallbackText = translatedText ? rowText.replace(translatedText, "").replace(/^\s*\d+:\d+\s*/, "").trim() : rowText.replace(/^\s*\d+:\d+\s*/, "").trim();
        pushRow({
          text: sourceText || fallbackText,
          translatedText,
          start: Number(row.dataset.start ?? "0")
        });
      });
      const overlay = document.querySelector<HTMLElement>("#yll-lab-overlay-v2");
      if (overlay) {
        pushRow({
          text: overlay.querySelector<HTMLElement>(".yll-overlay-source")?.textContent?.trim(),
          translatedText: overlay.querySelector<HTMLElement>(".yll-overlay-translation")?.textContent?.trim(),
          start: Number(overlay.querySelector<HTMLElement>(".yll-overlay-word[data-start]")?.dataset.start ?? "0")
        });
      }
      const words = new Map<string, { text: string; sourceSentence?: string; translatedSentence?: string; firstStart: number }>();

      rows.forEach((row) => {
        const sourceSentence = typeof row.text === "string" ? row.text.trim() : "";
        if (!sourceSentence) return;
        sourceSentence.match(/[A-Za-z][A-Za-z'-]*/g)?.forEach((rawToken) => {
          const text = cleanToken(rawToken);
          if (text.length < 2 || /^\d+$/.test(text) || stopWords.has(text)) return;
          if (!words.has(text)) {
            words.set(text, {
              text,
              sourceSentence,
              translatedSentence: typeof row.translatedText === "string" ? row.translatedText.trim() : undefined,
              firstStart: Number.isFinite(row.start) ? Number(row.start) : Number.MAX_SAFE_INTEGER
            });
          }
        });
      });

      return {
        version: page.__yllSafeScriptVersion,
        videoId: page.__yllSafeLoadedVideoId || new URLSearchParams(location.search).get("v") || undefined,
        words: Array.from(words.values())
          .sort((a, b) => a.firstStart - b.firstStart || a.text.localeCompare(b.text))
          .map(({ firstStart: _firstStart, ...word }) => word)
      };
    }
  });

  return injection?.result ?? { words: [] };
}

async function loadLibrary(userId: string) {
  const defaultWordbook = await ensureDefaultWordbook(userId);
  const [wordbooks, vocabItems, sentenceNotes, practiceAttempts, usageEvents] = await Promise.all([
    listByUser<Wordbook>("wordbooks", userId),
    listByUser<VocabItem>("vocabItems", userId),
    listByUser<SentenceNote>("sentenceNotes", userId),
    listByUser<PracticeAttempt>("practiceAttempts", userId),
    listByUser<UsageEvent>("usageEvents", userId)
  ]);

  const mergedWordbooks = uniqueWordbooks(wordbooks.some((item) => item.id === defaultWordbook.id)
    ? wordbooks
    : [defaultWordbook, ...wordbooks]);

  return { wordbooks: mergedWordbooks, vocabItems, sentenceNotes, practiceAttempts, usageEvents };
}

async function ensureDefaultWordbook(userId: string): Promise<Wordbook> {
  const existing = await listByUser<Wordbook>("wordbooks", userId);
  const defaults = existing
    .filter((item) => normalizeWordbookName(item.name) === normalizeWordbookName("默认词本"))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const found = defaults[0];
  if (found) {
    if (defaults.length > 1) {
      await mergeDuplicateDefaultWordbooks(userId, found, defaults.slice(1));
    }
    return found;
  }

  return createWordbook(userId, "默认词本", "自动创建，用于保存未指定词本的单词。");
}

async function createWordbook(userId: string, name: string, description?: string): Promise<Wordbook> {
  const cleanName = name.trim().slice(0, 40);
  if (!cleanName) throw new Error("请输入词本名称。");
  const now = new Date().toISOString();
  const existing = await listByUser<Wordbook>("wordbooks", userId);
  const duplicate = existing.find((item) => normalizeWordbookName(item.name) === normalizeWordbookName(cleanName));
  if (duplicate) return duplicate;

  const wordbook: Wordbook = {
    id: createId("wordbook"),
    userId,
    name: cleanName,
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    syncStatus: "local-only"
  };
  const saved = await putRecord("wordbooks", wordbook);
  await syncRecordIfEnabled("wordbooks", saved);
  notifyLibraryChanged();
  return saved;
}

async function mergeDuplicateDefaultWordbooks(userId: string, canonical: Wordbook, duplicates: Wordbook[]): Promise<void> {
  const duplicateIds = new Set(duplicates.map((item) => item.id));
  const vocabItems = await listByUser<VocabItem>("vocabItems", userId);
  await Promise.all(vocabItems
    .filter((item) => item.wordbookId && duplicateIds.has(item.wordbookId))
    .map((item) => putRecord("vocabItems", {
      ...item,
      wordbookId: canonical.id,
      updatedAt: new Date().toISOString(),
      syncStatus: "local-only"
    })));
  await Promise.all(duplicates.map((item) => deleteRecord("wordbooks", item.id)));
  notifyLibraryChanged();
}

function uniqueWordbooks(wordbooks: Wordbook[]): Wordbook[] {
  const byKey = new Map<string, Wordbook>();
  for (const wordbook of wordbooks) {
    const key = normalizeWordbookName(wordbook.name);
    const existing = byKey.get(key);
    if (!existing || wordbook.createdAt.localeCompare(existing.createdAt) < 0) {
      byKey.set(key, wordbook);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function normalizeWordbookName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function deleteWordbook(userId: string, id: string): Promise<{ deleted: boolean; deletedVocab: number }> {
  const wordbook = await getRecord<Wordbook>("wordbooks", id);
  if (!wordbook || wordbook.userId !== userId) return { deleted: false, deletedVocab: 0 };
  if (normalizeWordbookName(wordbook.name) === normalizeWordbookName("默认词本")) {
    throw new Error("默认词本不能删除。");
  }
  const vocabItems = await listByUser<VocabItem>("vocabItems", userId);
  const toDelete = vocabItems.filter((item) => item.wordbookId === id);
  await Promise.all(toDelete.map((item) => deleteRecord("vocabItems", item.id)));
  await deleteRecord("wordbooks", id);
  await Promise.all([
    deleteRemoteRecordIfEnabled("yll_wordbooks", id),
    ...toDelete.map((item) => deleteRemoteRecordIfEnabled("yll_vocab_items", item.id))
  ]);
  notifyLibraryChanged();
  return { deleted: true, deletedVocab: toDelete.length };
}

async function deleteVocabItem(userId: string, id: string): Promise<{ deleted: boolean }> {
  const item = await getRecord<VocabItem>("vocabItems", id);
  if (!item || item.userId !== userId) return { deleted: false };
  await deleteRecord("vocabItems", id);
  await deleteRemoteRecordIfEnabled("yll_vocab_items", id);
  notifyLibraryChanged();
  return { deleted: true };
}

async function deleteSentenceNote(userId: string, id: string): Promise<{ deleted: boolean }> {
  const item = await getRecord<SentenceNote>("sentenceNotes", id);
  if (!item || item.userId !== userId) return { deleted: false };
  await deleteRecord("sentenceNotes", id);
  await deleteRemoteRecordIfEnabled("yll_sentence_notes", id);
  notifyLibraryChanged();
  return { deleted: true };
}

async function updateVocabMastery(userId: string, id: string, mastery: VocabItem["mastery"]): Promise<VocabItem | undefined> {
  const item = await getRecord<VocabItem>("vocabItems", id);
  if (!item || item.userId !== userId) return undefined;
  const updated: VocabItem = {
    ...item,
    mastery,
    updatedAt: new Date().toISOString(),
    syncStatus: "local-only"
  };
  const saved = await putRecord("vocabItems", updated);
  await syncRecordIfEnabled("vocabItems", saved);
  notifyLibraryChanged();
  return saved;
}

async function upsertVocabMastery(
  userId: string,
  draft: {
    text: string;
    language?: string;
    wordbookId?: string;
    meaning?: string;
    sourceSentence?: string;
    translatedSentence?: string;
    mastery: VocabItem["mastery"];
  }
): Promise<VocabItem> {
  const text = draft.text.trim();
  if (!text) throw new Error("单词不能为空。");
  const defaultWordbook = draft.wordbookId ? undefined : await ensureDefaultWordbook(userId);
  const wordbookId = draft.wordbookId ?? defaultWordbook?.id;
  const normalizedText = normalizeText(text);
  const existing = (await listByUser<VocabItem>("vocabItems", userId))
    .find((item) => (item.wordbookId ?? defaultWordbook?.id) === wordbookId && item.normalizedText === normalizedText);
  const now = new Date().toISOString();
  const item: VocabItem = {
    ...(existing ?? {
      id: createId("vocab"),
      userId,
      text,
      normalizedText,
      language: draft.language || "en",
      createdAt: now
    }),
    text,
    wordbookId,
    meaning: draft.meaning ?? existing?.meaning,
    sourceSentence: draft.sourceSentence ?? existing?.sourceSentence,
    translatedSentence: draft.translatedSentence ?? existing?.translatedSentence,
    mastery: draft.mastery,
    updatedAt: now,
    syncStatus: "local-only"
  };
  const saved = await putRecord("vocabItems", item);
  await syncRecordIfEnabled("vocabItems", saved);
  notifyLibraryChanged();
  return saved;
}

function notifyLibraryChanged(): void {
  chrome.runtime.sendMessage({ type: "LIBRARY_UPDATED" }).catch(() => undefined);
}

type SyncableStoreName = "wordbooks" | "vocabItems" | "sentenceNotes" | "practiceAttempts";
type SyncableRecord = Wordbook | VocabItem | SentenceNote | PracticeAttempt;

async function saveSettingsAndMaybeSync(userId: string, patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const settings = await saveSettings(patch);
  if (patch.syncEnabled === true) {
    await syncLearningData(userId);
  } else {
    await syncSettingsIfEnabled(settings);
  }
  return settings;
}

async function syncLearningData(userId: string): Promise<{ synced: number; failed: number }> {
  const settings = await loadSettings();
  if (!settings.syncEnabled) throw new Error("请先在设置中开启云同步。");
  const session = await getSupabaseDataSession();
  if (!session) throw new Error("请先登录云端账号。");

  const library = await loadLibrary(userId);
  let synced = 0;
  let failed = 0;

  const syncBatch = async (storeName: SyncableStoreName, records: SyncableRecord[]) => {
    if (!records.length) return;
    try {
      await upsertRemoteRows(remoteTableForStore(storeName), records.map((record) => remotePayloadForRecord(record)));
      await Promise.all(records.map((record) => markRecordSynced(storeName, record)));
      synced += records.length;
    } catch {
      failed += records.length;
    }
  };

  await syncBatch("wordbooks", library.wordbooks);
  await syncBatch("vocabItems", library.vocabItems);
  await syncBatch("sentenceNotes", library.sentenceNotes);
  await syncBatch("practiceAttempts", library.practiceAttempts);

  try {
    await upsertRemoteRows("yll_settings", [remoteSettingsPayload(settings)]);
    synced += 1;
  } catch {
    failed += 1;
  }

  if (failed) {
    throw new Error(`云端同步失败：${synced} 条成功，${failed} 条失败。请确认云端学习数据表已部署。`);
  }
  return { synced, failed };
}

async function pullLearningData(userId: string): Promise<{ pulled: number; failed: number }> {
  const settings = await loadSettings();
  if (!settings.syncEnabled) throw new Error("请先在设置中开启云同步。");
  const session = await getSupabaseDataSession();
  if (!session) throw new Error("请先登录云端账号。");

  let pulled = 0;
  let failed = 0;
  const remoteUserId = userIdFromAccessToken(session.accessToken);

  const pullBatch = async <T extends SyncableRecord>(storeName: SyncableStoreName) => {
    try {
      const rows = await fetchRemoteRows(remoteTableForStore(storeName), session.accessToken, remoteUserId);
      const records = rows
        .map((row) => restoreRemotePayload<T>(row, userId))
        .filter((record): record is T => Boolean(record));
      await Promise.all(records.map((record) => putRecord(storeName, record)));
      pulled += records.length;
    } catch {
      failed += 1;
    }
  };

  await pullBatch<Wordbook>("wordbooks");
  await pullBatch<VocabItem>("vocabItems");
  await pullBatch<SentenceNote>("sentenceNotes");
  await pullBatch<PracticeAttempt>("practiceAttempts");

  try {
    const rows = await fetchRemoteRows("yll_settings", session.accessToken, remoteUserId, "local_id=eq.settings");
    const remoteSettings = rows
      .map((row) => {
        const payload = row.payload as { settings?: ExtensionSettings } | undefined;
        return payload?.settings ?? row.settings;
      })
      .find((value): value is ExtensionSettings => Boolean(value && typeof value === "object"));
    if (remoteSettings) {
      await saveSettings({ ...remoteSettings, syncEnabled: true });
      pulled += 1;
    }
  } catch {
    failed += 1;
  }

  if (failed) throw new Error(`云端同步失败：已恢复 ${pulled} 条，${failed} 个数据表失败。`);
  return { pulled, failed };
}

async function syncSettingsIfEnabled(settings: ExtensionSettings): Promise<void> {
  if (!settings.syncEnabled) return;
  try {
    await upsertRemoteRows("yll_settings", [remoteSettingsPayload(settings)]);
  } catch {
    // Local settings remain authoritative when the network or cloud table is unavailable.
  }
}

async function syncRecordIfEnabled(storeName: SyncableStoreName, record: SyncableRecord): Promise<void> {
  const settings = await loadSettings();
  if (!settings.syncEnabled) return;
  try {
    await upsertRemoteRows(remoteTableForStore(storeName), [remotePayloadForRecord(record)]);
    await markRecordSynced(storeName, record);
  } catch {
    // Keep local-first writes usable. Manual "立即同步" reports aggregate failures.
  }
}

async function fetchRemoteRows(table: string, accessToken: string, userId: string, extraQuery = ""): Promise<Array<Record<string, unknown>>> {
  const query = [`user_id=eq.${encodeURIComponent(userId)}`, "select=*"];
  if (extraQuery) query.push(extraQuery);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query.join("&")}`, {
    headers: supabaseRestHeaders(accessToken)
  });
  if (!response.ok) throw new Error(await readRestError(response));
  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

function restoreRemotePayload<T extends SyncableRecord>(row: Record<string, unknown>, userId: string): T | undefined {
  const payload = row.payload;
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Partial<T> & { id?: string; local_id?: string; userId?: string; syncStatus?: string; updatedAt?: string };
  const id = record.id ?? (typeof row.local_id === "string" ? row.local_id : undefined);
  if (!id) return undefined;
  return {
    ...record,
    id,
    userId,
    syncStatus: "synced",
    updatedAt: record.updatedAt ?? new Date().toISOString()
  } as T;
}

async function deleteRemoteRecordIfEnabled(table: string, localId: string): Promise<void> {
  const settings = await loadSettings();
  if (!settings.syncEnabled) return;
  const session = await getSupabaseDataSession();
  if (!session) return;
  const userId = userIdFromAccessToken(session.accessToken);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&local_id=eq.${encodeURIComponent(localId)}`, {
    method: "DELETE",
    headers: supabaseRestHeaders(session.accessToken)
  });
  if (!response.ok) throw new Error(await readRestError(response));
}

async function upsertRemoteRows(table: string, rows: Array<Record<string, unknown>>): Promise<void> {
  if (!rows.length) return;
  const session = await getSupabaseDataSession();
  if (!session) throw new Error("请先登录云端账号。");
  const userId = userIdFromAccessToken(session.accessToken);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=user_id,local_id`, {
    method: "POST",
    headers: supabaseRestHeaders(session.accessToken, {
      Prefer: "resolution=merge-duplicates"
    }),
    body: JSON.stringify(rows.map((row) => ({ ...row, user_id: userId })))
  });
  if (!response.ok) throw new Error(await readRestError(response));
}

function userIdFromAccessToken(accessToken: string): string {
  const [, payload] = accessToken.split(".");
  if (!payload) throw new Error("云端访问令牌无效。");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = JSON.parse(atob(normalized)) as { sub?: string };
  if (!decoded.sub) throw new Error("云端访问令牌缺少用户 ID。");
  return decoded.sub;
}

function supabaseRestHeaders(accessToken: string, extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  return headers;
}

async function readRestError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => undefined)) as { message?: string; error?: string; details?: string } | undefined;
  return data?.message ?? data?.error ?? data?.details ?? `云端请求失败：${response.status}`;
}

function remoteTableForStore(storeName: SyncableStoreName): string {
  return {
    wordbooks: "yll_wordbooks",
    vocabItems: "yll_vocab_items",
    sentenceNotes: "yll_sentence_notes",
    practiceAttempts: "yll_practice_attempts"
  }[storeName];
}

function remotePayloadForRecord(record: SyncableRecord): Record<string, unknown> {
  if ("name" in record) {
    return {
      local_id: record.id,
      local_user_id: record.userId,
      name: record.name,
      description: record.description ?? null,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      payload: record
    };
  }
  if ("normalizedText" in record) {
    return {
      local_id: record.id,
      local_user_id: record.userId,
      wordbook_local_id: record.wordbookId ?? null,
      text: record.text,
      normalized_text: record.normalizedText,
      language: record.language,
      meaning: record.meaning ?? null,
      source_sentence: record.sourceSentence ?? null,
      translated_sentence: record.translatedSentence ?? null,
      video_id: record.videoId ?? null,
      cue_id: record.cueId ?? null,
      mastery: record.mastery,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      payload: record
    };
  }
  if ("isFavorite" in record) {
    return {
      local_id: record.id,
      local_user_id: record.userId,
      video_id: record.videoId,
      cue_id: record.cueId,
      text: record.text,
      translated_text: record.translatedText ?? null,
      language: record.language,
      start_ms: record.startMs,
      duration_ms: record.durationMs,
      note: record.note ?? null,
      is_favorite: record.isFavorite,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      payload: record
    };
  }
  return {
    local_id: record.id,
    local_user_id: record.userId,
    practice_item_id: record.practiceItemId,
    cue_id: record.cueId,
    mode: record.mode,
    answer: record.answer ?? null,
    expected: record.expected,
    score: record.score,
    speech_score: record.speechScore ?? null,
    duration_ms: record.durationMs,
    created_at: record.createdAt,
    payload: record
  };
}

function remoteSettingsPayload(settings: ExtensionSettings): Record<string, unknown> {
  return {
    local_id: "settings",
    settings,
    updated_at: settings.updatedAt
  };
}

async function markRecordSynced(storeName: SyncableStoreName, record: SyncableRecord): Promise<void> {
  if (record.syncStatus === "synced") return;
  await putRecord(storeName, {
    ...record,
    syncStatus: "synced"
  } as SyncableRecord);
}

async function guardQuota(userId: string, feature: UsageFeature, cost: number): Promise<void> {
  const entitlement = await loadEffectiveEntitlement(userId);
  if (entitlement.usageToday[feature] + cost > entitlement.quota[feature]) {
    await recordUsage(userId, feature, cost, "skipped");
    throw new Error("免费额度已用尽。基础字幕和本地复习仍可使用；登录后可读取云端 Pro 权限。");
  }
}

async function loadEffectiveEntitlement(localUserId: string) {
  const remote = await loadRemoteAccount();
  return remote.entitlement ?? loadEntitlement(localUserId);
}

async function recordUsage(
  userId: string,
  feature: UsageFeature,
  cost: number,
  status: UsageEvent["status"],
  meta?: UsageEvent["meta"]
): Promise<UsageEvent> {
  return putRecord("usageEvents", {
    id: createId("usage"),
    userId,
    feature,
    cost,
    status,
    createdAt: new Date().toISOString(),
    meta
  });
}

function assertNever(value: never): never {
  throw new Error(`Unsupported message: ${JSON.stringify(value)}`);
}
