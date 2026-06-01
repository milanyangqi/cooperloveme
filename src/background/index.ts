import { translateCuesWithAi, explainSelection, scoreSpeechWithAi } from "./ai";
import { buildExportBundle, clearAllStores, listByUser, putRecord } from "./db";
import { ensureLocalUser, loadEntitlement, loadSecrets, loadSettings, saveSecrets, saveSettings } from "./settings";
import {
  clearAdminEntitlementOverride,
  clearSupabaseSession,
  createBillingCheckout,
  getAdminAccess,
  getAdminUserDetail,
  listAdminUsers,
  loadRemoteAccount,
  saveAdminEntitlementOverride,
  signInWithEmail,
  signUpWithEmail
} from "./supabaseAuth";
import { createId, normalizeText } from "../shared/ids";
import type {
  PracticeAttempt,
  RuntimeRequest,
  RuntimeResponse,
  SentenceNote,
  UsageEvent,
  UsageFeature,
  VocabItem
} from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  void ensureLocalUser();
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

async function handleMessage(message: RuntimeRequest, sender: chrome.runtime.MessageSender): Promise<unknown> {
  const localUser = await ensureLocalUser();

  switch (message.type) {
    case "GET_BOOTSTRAP": {
      const [settings, secrets, localEntitlement, library, remote] = await Promise.all([
        loadSettings(),
        loadSecrets(),
        loadEntitlement(localUser.id),
        loadLibrary(localUser.id),
        loadRemoteAccount()
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
      return saveSettings(message.payload);

    case "UPDATE_SECRETS":
      return saveSecrets(message.payload);

    case "GET_LIBRARY":
      return loadLibrary(localUser.id);

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
      return putRecord("sentenceNotes", note);
    }

    case "SAVE_VOCAB": {
      const now = new Date().toISOString();
      const item: VocabItem = {
        ...message.payload,
        id: createId("vocab"),
        userId: localUser.id,
        normalizedText: normalizeText(message.payload.text),
        mastery: 0,
        createdAt: now,
        updatedAt: now,
        syncStatus: "local-only"
      };
      return putRecord("vocabItems", item);
    }

    case "SAVE_PRACTICE_ATTEMPT": {
      const attempt: PracticeAttempt = {
        ...message.payload,
        id: createId("attempt"),
        userId: localUser.id,
        createdAt: new Date().toISOString(),
        syncStatus: "local-only"
      };
      return putRecord("practiceAttempts", attempt);
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

    case "READ_PAGE_PLAYER_RESPONSE":
      if (!sender.tab?.id) {
        throw new Error("只能从 YouTube 视频页面读取播放器字幕信息。");
      }
      return readLivePlayerSnapshot(sender.tab.id);

    case "FETCH_CAPTION_TEXT":
      return fetchCaptionText(message.payload.url);

    default:
      return assertNever(message);
  }
}

async function fetchCaptionText(url: string): Promise<{ body: string; finalUrl: string; status: number }> {
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
    status: response.status
  };
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

      const win = window as unknown as {
        ytInitialPlayerResponse?: unknown;
        ytplayer?: { config?: { args?: { raw_player_response?: unknown; player_response?: unknown } } };
      };
      const player = document.getElementById("movie_player") as
        | (HTMLElement & {
            getPlayerResponse?: () => unknown;
            getVideoData?: () => unknown;
            getOption?: (section: string, key: string) => unknown;
          })
        | null;

      const playerResponse =
        safe(() => player?.getPlayerResponse?.()) ??
        win.ytInitialPlayerResponse ??
        parseMaybeJson(win.ytplayer?.config?.args?.raw_player_response) ??
        parseMaybeJson(win.ytplayer?.config?.args?.player_response);
      const videoData = safe(() => player?.getVideoData?.());
      const tracklist =
        safe(() => player?.getOption?.("captions", "tracklist")) ??
        safe(() => player?.getOption?.("captions", "captionTracks"));

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

      return JSON.parse(
        JSON.stringify({
          playerResponse,
          videoData,
          captionTracks,
          href: location.href
        })
      );
    }
  });

  return injection?.result ?? {};
}

async function loadLibrary(userId: string) {
  const [vocabItems, sentenceNotes, practiceAttempts, usageEvents] = await Promise.all([
    listByUser<VocabItem>("vocabItems", userId),
    listByUser<SentenceNote>("sentenceNotes", userId),
    listByUser<PracticeAttempt>("practiceAttempts", userId),
    listByUser<UsageEvent>("usageEvents", userId)
  ]);

  return { vocabItems, sentenceNotes, practiceAttempts, usageEvents };
}

async function guardQuota(userId: string, feature: UsageFeature, cost: number): Promise<void> {
  const entitlement = await loadEffectiveEntitlement(userId);
  if (entitlement.usageToday[feature] + cost > entitlement.quota[feature]) {
    await recordUsage(userId, feature, cost, "skipped");
    throw new Error("免费额度已用尽。基础字幕和本地复习仍可使用；登录后可读取 Supabase Pro 权限。");
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
