import {
  BookMarked,
  BookOpen,
  Captions,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Download,
  Dumbbell,
  FileText,
  Heart,
  Languages,
  LogIn,
  LogOut,
  Mic,
  Power,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { sendRuntimeMessage } from "../shared/messages";
import type { EntitlementSnapshot, ExportBundle, ExtensionSettings, RemoteAuthSnapshot, UserProfile, VocabItem } from "../shared/types";

type InjectResult = {
  href: string;
  title: string;
  videoCount: number;
};

type PopupBootstrap = {
  user: UserProfile;
  localUser: UserProfile;
  auth: RemoteAuthSnapshot;
  settings: ExtensionSettings;
  entitlement: EntitlementSnapshot;
  library: {
    wordbooks: unknown[];
    vocabItems: unknown[];
    sentenceNotes: unknown[];
    practiceAttempts: unknown[];
  };
};

type PopupView = "home" | "settings" | "account" | "library" | "siteAccess";

type VocabPreview = {
  id?: string;
  wordbookId?: string;
  text?: string;
  normalizedText?: string;
  meaning?: string;
  mastery?: number;
  sourceSentence?: string;
  translatedSentence?: string;
};

type WordbookPreview = {
  id?: string;
  name?: string;
  createdAt?: string;
};

type SentencePreview = {
  text?: string;
  translatedText?: string;
};

type PageWord = {
  text: string;
  sourceSentence?: string;
  translatedSentence?: string;
};

type PageWordPayload = {
  version?: string;
  videoId?: string;
  words: PageWord[];
};

type PreviewTab = "page" | "mastered" | "sentences";
type LibraryTab = "new" | "mastered" | "sentences";

type PreviewWord = PageWord & {
  id?: string;
  meaning?: string;
  mastery: number;
  saved: boolean;
};

type PlaybackRateApplyResult = {
  count: number;
  rate: number;
};

const CAPTION_PANEL_MIN_HEIGHT = 520;
const CAPTION_PANEL_MAX_HEIGHT = 1040;
const CAPTION_PANEL_VERTICAL_OFFSET = 92;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "英语" },
  { value: "zh-Hans", label: "中文(简体)" },
  { value: "zh-Hant", label: "中文(繁体)" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
  { value: "es", label: "西班牙语" }
];

const PLAYBACK_RATE_OPTIONS = [
  { value: "0.5", label: "0.5x" },
  { value: "0.6", label: "0.6x" },
  { value: "0.7", label: "0.7x" },
  { value: "0.75", label: "0.75x" },
  { value: "0.8", label: "0.8x" },
  { value: "0.85", label: "0.85x" },
  { value: "0.9", label: "0.9x" },
  { value: "0.95", label: "0.95x" },
  { value: "1", label: "1.0x" },
  { value: "1.05", label: "1.05x" },
  { value: "1.1", label: "1.1x" },
  { value: "1.15", label: "1.15x" },
  { value: "1.2", label: "1.2x" },
  { value: "1.25", label: "1.25x" },
  { value: "1.3", label: "1.3x" },
  { value: "1.4", label: "1.4x" },
  { value: "1.5", label: "1.5x" },
  { value: "1.75", label: "1.75x" },
  { value: "2", label: "2.0x" }
];

export function PopupApp() {
  const isDocked = new URLSearchParams(location.search).get("dock") === "1";
  const [status, setStatus] = useState("自动模式：YouTube 视频页会加载新版轻量字幕面板。");
  const [bootstrap, setBootstrap] = useState<PopupBootstrap | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<ExtensionSettings | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [activeView, setActiveView] = useState<PopupView>("home");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("page");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("new");
  const [pageWords, setPageWords] = useState<PageWord[]>([]);
  const [wordActionBusy, setWordActionBusy] = useState("");
  const [libraryWordbookId, setLibraryWordbookId] = useState("");
  const [newWordbookName, setNewWordbookName] = useState("");
  const [sitePattern, setSitePattern] = useState("");
  const [activePageVideoId, setActivePageVideoId] = useState("");

  const syncPopupHeightWithCaptionPanel = async () => {
    if (isDocked) {
      document.documentElement.style.setProperty("--yll-popup-height", "100dvh");
      return;
    }

    const applyHeight = (viewportHeight: number) => {
      if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return;
      const panelHeight = Math.min(
        CAPTION_PANEL_MAX_HEIGHT,
        Math.max(CAPTION_PANEL_MIN_HEIGHT, Math.round(viewportHeight - CAPTION_PANEL_VERTICAL_OFFSET))
      );
      document.documentElement.style.setProperty("--yll-popup-height", `${panelHeight}px`);
    };

    applyHeight(window.screen?.availHeight ?? CAPTION_PANEL_MAX_HEIGHT);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) return;

      const parsed = new URL(tab.url);
      if (!parsed.hostname.includes("youtube.com")) return;

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.innerHeight
      });
      if (typeof result?.result === "number") applyHeight(result.result);
    } catch {
      // Keep the screen-height fallback. Chrome may deny injection on non-page tabs.
    }
  };

  const reloadBootstrap = async () => {
    const [response, wordsResponse] = await Promise.all([
      sendRuntimeMessage<PopupBootstrap>({ type: "GET_BOOTSTRAP" }),
      sendRuntimeMessage<PageWordPayload>({ type: "READ_ACTIVE_PAGE_WORDS" })
    ]);
    if (response.ok) {
      setBootstrap(response.data);
      setSettingsDraft(response.data.settings);
    }
    if (wordsResponse.ok) {
      setPageWords(wordsResponse.data.words);
      setActivePageVideoId(wordsResponse.data.videoId ?? "");
    }
    if (!response.ok) setStatus(response.error);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("yll-dock-popup", isDocked);
    void reloadBootstrap();
    void syncPopupHeightWithCaptionPanel();
    const handleRuntimeMessage = (message: { type?: string }) => {
      if (message?.type === "LIBRARY_UPDATED") void reloadBootstrap();
    };
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      document.documentElement.classList.remove("yll-dock-popup");
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [isDocked]);

  const wakeSafeContentScript = async (message: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      setStatus("没有找到当前标签页。");
      return;
    }

    const parsed = new URL(tab.url);
    if (!parsed.hostname.includes("youtube.com") || parsed.pathname !== "/watch") {
      setStatus("请先切换到 YouTube 视频播放页。");
      return;
    }

    const expectedVersion = chrome.runtime.getManifest().version;
    const [probe] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (version: string) => {
        const page = window as Window & { __yllSafeScriptVersion?: string };
        return page.__yllSafeScriptVersion === version;
      },
      args: [expectedVersion]
    });

    if (!probe?.result) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const page = window as Window & {
            __yllSafeTimer?: number;
            __yllSafeOverlayTimer?: number;
            __yllSafeOfficialRetryTimer?: number;
            __yllSafeRows?: unknown[];
            __yllSafeActiveKey?: string;
            __yllSafeLoadedVideoId?: string;
            __yllSafeLoadingVideoId?: string;
            __yllSafeOfficialLockedVideoId?: string;
          };
          if (page.__yllSafeTimer) window.clearInterval(page.__yllSafeTimer);
          page.__yllSafeTimer = undefined;
          if (page.__yllSafeOverlayTimer) window.clearInterval(page.__yllSafeOverlayTimer);
          page.__yllSafeOverlayTimer = undefined;
          if (page.__yllSafeOfficialRetryTimer) window.clearTimeout(page.__yllSafeOfficialRetryTimer);
          page.__yllSafeOfficialRetryTimer = undefined;
          page.__yllSafeRows = [];
          page.__yllSafeActiveKey = undefined;
          page.__yllSafeLoadedVideoId = undefined;
          page.__yllSafeLoadingVideoId = undefined;
          page.__yllSafeOfficialLockedVideoId = undefined;
          [
            "yll-lab-panel-v2",
            "yll-lab-overlay-v2",
            "yll-lab-word-popover-v2",
            "yll-lab-settings-v2",
            "yll-lab-practice-v2",
            "yll-lab-library-v2",
            "yll-lab-debug-v2",
            "yll-lab-style-v2"
          ].forEach((id) => document.getElementById(id)?.remove());
          document.documentElement.classList.remove("yll-hide-native-captions");
        }
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["assets/content.js"]
      });
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.dispatchEvent(new Event("yll-safe-reload"))
    });
    setStatus(message);
  };

  const runSafePageProbe = async () => {
    try {
      setStatus("正在检测当前 YouTube 页面...");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        setStatus("没有找到当前标签页。");
        return;
      }

      const parsed = new URL(tab.url);
      if (!parsed.hostname.includes("youtube.com")) {
        setStatus("请先切换到 YouTube 页面。");
        return;
      }

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: () => ({
          href: location.href,
          title: document.title,
          videoCount: document.querySelectorAll("video").length
        })
      });
      const payload = result?.result as InjectResult | undefined;
      setStatus(payload ? `页面正常：检测到 ${payload.videoCount} 个视频元素。` : "页面已连接，但没有返回检测结果。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "页面检测失败。");
    }
  };

  const mountMiniPanel = async () => {
    try {
      setStatus("正在唤醒新版字幕面板...");
      await wakeSafeContentScript("新版字幕面板已唤醒，正在自动读取官方字幕。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "面板注入失败。");
    }
  };

  const openSubtitleSettingsPanel = async () => {
    try {
      setStatus("正在打开字幕设置面板...");
      await wakeSafeContentScript("新版字幕面板已唤醒。");
      const opened = await dispatchActiveYouTubeEvent("yll-open-settings", true);
      setStatus(opened ? "字幕设置面板已打开。" : "请先切换到 YouTube 视频播放页。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "字幕设置面板打开失败。");
    }
  };

  const loadMiniCaptions = async () => {
    try {
      setStatus("正在唤醒新版字幕读取任务...");
      await wakeSafeContentScript("新版字幕读取任务已唤醒，不再使用旧的手动采集器。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "字幕读取失败。");
    }
  };

  const openPractice = async () => {
    try {
      setStatus("正在打开全屏混合练习...");
      await wakeSafeContentScript("全屏混合练习已唤醒，请在 YouTube 页面查看。");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.dispatchEvent(new Event("yll-open-practice"))
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "练习模式打开失败。");
    }
  };

  const applyPlaybackRateToActiveTab = async (playbackRate: number) => {
    try {
      if (!Number.isFinite(playbackRate) || playbackRate <= 0) {
        setStatus("播放速度无效。");
        return;
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url) {
        setStatus("播放速度已保存，但没有找到当前标签页。");
        return;
      }

      const parsed = new URL(tab.url);
      if (!parsed.hostname.includes("youtube.com")) {
        setStatus("播放速度已保存；切换到 YouTube 视频页后再应用。");
        return;
      }

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (nextRate: number) => {
          const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("video"));
          videos.forEach((video) => {
            video.playbackRate = nextRate;
            video.dispatchEvent(new Event("ratechange", { bubbles: true }));
          });
          const activeVideo = videos.find((video) => !video.paused) ?? videos[0];
          return { count: videos.length, rate: activeVideo?.playbackRate ?? nextRate };
        },
        args: [playbackRate]
      });
      const payload = result?.result as PlaybackRateApplyResult | undefined;
      setStatus(payload?.count ? `播放速度已调整为 ${payload.rate}x。` : "播放速度已保存，但当前页面没有找到视频。");
    } catch (error) {
      setStatus(error instanceof Error ? `播放速度已保存，但应用失败：${error.message}` : "播放速度已保存，但应用失败。");
    }
  };

  const submitAuth = async (type: "SIGN_IN_EMAIL" | "SIGN_UP_EMAIL") => {
    if (!authEmail.trim() || !authPassword) {
      setStatus("请输入邮箱和密码。");
      return;
    }

    try {
      setAuthBusy(true);
      setStatus(type === "SIGN_IN_EMAIL" ? "正在登录账号..." : "正在注册账号...");
      const response = await sendRuntimeMessage<RemoteAuthSnapshot>({
        type,
        payload: { email: authEmail.trim(), password: authPassword }
      });
      if (!response.ok) {
        setStatus(response.error);
        return;
      }
      setAuthPassword("");
      setStatus(response.data.status === "email-confirmation-required" ? "注册成功，请先到邮箱完成验证。" : "账号已连接。");
      await reloadBootstrap();
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    try {
      setAuthBusy(true);
      const response = await sendRuntimeMessage<RemoteAuthSnapshot>({ type: "SIGN_OUT" });
      setStatus(response.ok ? "已退出账号，本地学习记录仍保留。" : response.error);
      await reloadBootstrap();
    } finally {
      setAuthBusy(false);
    }
  };

  const openOptions = async () => {
    await chrome.runtime.openOptionsPage();
  };

  const dispatchActiveYouTubeEvent = async (eventName: string, openSettings = false) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return false;

    const parsed = new URL(tab.url);
    if (!parsed.hostname.includes("youtube.com")) return false;

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (name: string, shouldOpenSettings: boolean) => {
        const page = window as Window & { __yllSafeOpenSettingsPanel?: () => boolean };
        if (shouldOpenSettings && page.__yllSafeOpenSettingsPanel?.()) return true;
        window.dispatchEvent(new Event(name));
        return shouldOpenSettings ? Boolean(document.getElementById("yll-lab-settings-v2")) : true;
      },
      args: [eventName, openSettings]
    });
    return Boolean(result?.result);
  };

  const openLearningLibrary = async () => {
    setActiveView("library");
    setStatus("学习库已打开。");
    await reloadBootstrap();
  };

  const saveCurrentSentence = async () => {
    try {
      setStatus("正在收藏当前句...");
      await wakeSafeContentScript("新版字幕面板已唤醒，正在收藏当前句。");
      const opened = await dispatchActiveYouTubeEvent("yll-save-current-sentence");
      setStatus(opened ? "已发送收藏当前句指令。" : "请先切换到 YouTube 视频播放页。");
      await reloadBootstrap();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "收藏当前句失败。");
    }
  };

  const createLibraryWordbook = async () => {
    const name = newWordbookName.trim();
    if (!name) {
      setStatus("请输入新词本名称。");
      return;
    }
    setStatus("正在新建词本...");
    const response = await sendRuntimeMessage<WordbookPreview>({ type: "CREATE_WORDBOOK", payload: { name } });
    if (!response.ok) {
      setStatus(response.error);
      return;
    }
    setNewWordbookName("");
    setLibraryWordbookId(response.data.id ?? "");
    setStatus(`已新建词本：${response.data.name ?? name}`);
    await reloadBootstrap();
  };

  const deleteLibraryWordbook = async () => {
    const selectedWordbook = wordbooks.find((wordbook) => wordbook.id === selectedLibraryWordbookId);
    if (!selectedWordbook?.id) {
      setStatus("请选择要删除的词本。");
      return;
    }
    if ((selectedWordbook.name ?? "").trim() === "默认词本") {
      setStatus("默认词本不能删除。");
      return;
    }
    const confirmed = window.confirm(`确认删除词本「${selectedWordbook.name ?? "未命名词本"}」？该词本内的单词也会删除。`);
    if (!confirmed) return;
    const response = await sendRuntimeMessage<{ deleted: boolean; deletedVocab: number }>({ type: "DELETE_WORDBOOK", payload: { id: selectedWordbook.id } });
    if (!response.ok) {
      setStatus(response.error);
      return;
    }
    setLibraryWordbookId("");
    setStatus(response.data.deleted ? `词本已删除，同时删除 ${response.data.deletedVocab} 个单词。` : "没有找到要删除的词本。");
    await reloadBootstrap();
    await refreshPageWords();
  };

  const exportCurrentWordbook = () => {
    const selectedWordbook = wordbooks.find((wordbook) => wordbook.id === selectedLibraryWordbookId);
    const rows = [
      ["wordbook", "text", "meaning", "source_sentence", "translated_sentence", "mastery"],
      ...libraryWords.map((item) => [
        selectedWordbook?.name ?? "默认词本",
        item.text ?? "",
        item.meaning ?? "",
        item.sourceSentence ?? "",
        item.translatedSentence ?? "",
        String(item.mastery ?? 0)
      ])
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `youtube-language-lab-${safeFilename(selectedWordbook?.name ?? "wordbook")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("当前词本已导出。");
  };

  const startBilling = async () => {
    const response = await sendRuntimeMessage<{ url: string }>({ type: "START_BILLING_CHECKOUT" });
    if (!response.ok) {
      setStatus(response.error);
      return;
    }

    await chrome.tabs.create({ url: response.data.url });
    setStatus("已打开会员管理页面。");
  };

  const exportData = async () => {
    const response = await sendRuntimeMessage<ExportBundle>({ type: "EXPORT_DATA" });
    if (!response.ok) {
      setStatus(response.error);
      return;
    }

    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `youtube-language-lab-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("本地学习数据已导出。");
  };

  const syncLibrary = async () => {
    const confirmed = window.confirm("确认将本地词本、生词、收藏句、练习记录和设置上传同步到 Supabase？");
    if (!confirmed) {
      setStatus("已取消 Supabase 同步。");
      return;
    }
    setStatus("正在同步学习数据到 Supabase...");
    const response = await sendRuntimeMessage<{ synced: number; failed: number }>({ type: "SYNC_LIBRARY" });
    if (!response.ok) {
      setStatus(response.error);
      window.alert(response.error);
      return;
    }
    const message = response.data.failed ? `同步完成：${response.data.synced} 条成功，${response.data.failed} 条失败。` : `已同步 ${response.data.synced} 条学习数据。`;
    setStatus(message);
    window.alert(message);
    await reloadBootstrap();
  };

  const refreshPageWords = async () => {
    const response = await sendRuntimeMessage<PageWordPayload>({ type: "READ_ACTIVE_PAGE_WORDS" });
    if (!response.ok) return;
    setPageWords(response.data.words);
    setActivePageVideoId(response.data.videoId ?? "");
  };

  const savePreviewWord = async (word: PreviewWord, mastery: VocabItem["mastery"], message: string) => {
    const key = `${word.text}:${mastery}`;
    try {
      setWordActionBusy(key);
      const response = word.id
        ? await sendRuntimeMessage<VocabPreview>({ type: "UPDATE_VOCAB_MASTERY", payload: { id: word.id, mastery } })
        : await sendRuntimeMessage<VocabPreview>({
            type: "UPSERT_VOCAB_MASTERY",
            payload: {
              text: word.text,
              language: "en",
              meaning: word.meaning,
              sourceSentence: word.sourceSentence,
              translatedSentence: word.translatedSentence,
              mastery
            }
          });
      if (!response.ok) {
        setStatus(response.error);
        return;
      }
      setBootstrap((current) => {
        if (!current) return current;
        const nextItem = response.data;
        const vocabItems = current.library.vocabItems as VocabPreview[];
        const nextItems = vocabItems.some((item) => item.id === nextItem.id)
          ? vocabItems.map((item) => (item.id === nextItem.id ? { ...item, ...nextItem } : item))
          : [nextItem, ...vocabItems];
        return { ...current, library: { ...current.library, vocabItems: nextItems } };
      });
      setStatus(message);
      await reloadBootstrap();
      await refreshPageWords();
    } finally {
      setWordActionBusy("");
    }
  };

  const deleteLibraryWord = async (item: VocabPreview) => {
    if (!item.id) {
      setStatus("这个单词还没有保存到词本。");
      return;
    }
    const confirmed = window.confirm(`确认从当前词本删除「${item.text ?? "这个单词"}」？`);
    if (!confirmed) return;
    const response = await sendRuntimeMessage<{ deleted: boolean }>({ type: "DELETE_VOCAB", payload: { id: item.id } });
    if (!response.ok) {
      setStatus(response.error);
      return;
    }
    setBootstrap((current) => {
      if (!current) return current;
      const nextItems = (current.library.vocabItems as VocabPreview[]).filter((word) => word.id !== item.id);
      return { ...current, library: { ...current.library, vocabItems: nextItems } };
    });
    setStatus(response.data.deleted ? "单词已删除。" : "没有找到要删除的单词。");
    await reloadBootstrap();
    await refreshPageWords();
  };

  const saveSentenceFromWord = async (word: PreviewWord) => {
    const text = word.sourceSentence?.trim();
    if (!text) {
      setStatus("这个单词没有对应的字幕句子。");
      return;
    }
    const response = await sendRuntimeMessage<SentencePreview>({
      type: "SAVE_SENTENCE",
      payload: {
        videoId: activePageVideoId || "unknown",
        cueId: `page-word:${normalizePreviewWord(word.text)}`,
        text,
        translatedText: word.translatedSentence,
        language: "en",
        startMs: 0,
        durationMs: 0,
        isFavorite: true
      }
    });
    if (!response.ok) {
      setStatus(response.error);
      return;
    }
    setStatus("该句已收藏。");
    await reloadBootstrap();
  };

  const addSiteRule = async () => {
    const pattern = cleanSitePattern(sitePattern);
    if (!pattern) {
      setStatus("请输入网站域名或通配符。");
      return;
    }
    const listKey = settings?.siteAccessMode === "whitelist" ? "siteWhitelist" : "siteBlacklist";
    const current = settings?.[listKey] ?? [];
    if (current.includes(pattern)) {
      setStatus("该网站已在列表中。");
      return;
    }
    setSitePattern("");
    await updateSettings({ [listKey]: [...current, pattern] } as Partial<ExtensionSettings>);
  };

  const removeSiteRule = async (pattern: string, listKey: "siteBlacklist" | "siteWhitelist") => {
    const current = settings?.[listKey] ?? [];
    await updateSettings({ [listKey]: current.filter((item) => item !== pattern) } as Partial<ExtensionSettings>);
  };

  const updateSettings = async (patch: Partial<ExtensionSettings>) => {
    if (!settingsDraft) return;

    const previous = settingsDraft;
    const playbackRateToApply = typeof patch.playbackRate === "number" ? patch.playbackRate : null;
    const next = mergeSettings(settingsDraft, patch);
    setSettingsDraft(next);
    setBootstrap((current) => (current ? { ...current, settings: next } : current));

    const response = await sendRuntimeMessage<ExtensionSettings>({ type: "UPDATE_SETTINGS", payload: patch });
    if (!response.ok) {
      setSettingsDraft(previous);
      setBootstrap((current) => (current ? { ...current, settings: previous } : current));
      setStatus(response.error);
      return;
    }

    setSettingsDraft(response.data);
    setBootstrap((current) => (current ? { ...current, settings: response.data } : current));
    if (playbackRateToApply !== null) {
      await applyPlaybackRateToActiveTab(playbackRateToApply);
      return;
    }
    setStatus("设置已保存。");
  };

  const isSignedIn = bootstrap?.auth.status === "signed-in";
  const vocabCount = bootstrap?.library.vocabItems.length ?? 0;
  const sentenceCount = bootstrap?.library.sentenceNotes.length ?? 0;
  const practiceCount = bootstrap?.library.practiceAttempts.length ?? 0;
  const vocabItems = (bootstrap?.library.vocabItems as VocabPreview[] | undefined) ?? [];
  const wordbooks = uniqueWordbookPreviews((bootstrap?.library.wordbooks as WordbookPreview[] | undefined) ?? []);
  const sentenceNotes = (bootstrap?.library.sentenceNotes as SentencePreview[] | undefined) ?? [];
  const settings = settingsDraft;
  const masteredCount = vocabItems.filter((item) => item.mastery && item.mastery >= 4).length;
  const recentSentences = sentenceNotes.slice(0, 4);
  const savedByKey = new Map(vocabItems.map((item) => [normalizePreviewWord(item.normalizedText ?? item.text ?? ""), item]));
  const currentPageWords: PreviewWord[] = pageWords
    .map((word) => {
      const saved = savedByKey.get(normalizePreviewWord(word.text));
      return {
        ...word,
        id: saved?.id,
        meaning: saved?.meaning,
        mastery: saved?.mastery ?? 0,
        saved: Boolean(saved)
      };
    })
    .filter((word) => normalizePreviewWord(word.text));
  const pageNewWords = currentPageWords.filter((word) => word.mastery < 4);
  const pageMasteredWords = currentPageWords.filter((word) => word.mastery >= 4);
  const selectedLibraryWordbookId = libraryWordbookId || wordbooks[0]?.id || "";
  const selectedLibraryWordbook = wordbooks.find((wordbook) => wordbook.id === selectedLibraryWordbookId);
  const libraryWords = vocabItems.filter((item) => !selectedLibraryWordbookId || item.wordbookId === selectedLibraryWordbookId);
  const libraryNewWords = libraryWords.filter((item) => (item.mastery ?? 0) < 4);
  const libraryMasteredWords = libraryWords.filter((item) => (item.mastery ?? 0) >= 4);
  const visibleLibraryWords = libraryTab === "mastered" ? libraryMasteredWords : libraryNewWords;
  const currentSiteRules = settings?.siteAccessMode === "whitelist" ? settings.siteWhitelist : settings?.siteBlacklist ?? [];
  const accountBadge = !bootstrap ? "LOADING" : isSignedIn ? "SIGNED IN" : "LOCAL";

  return (
    <main className="popup">
      <header className="popup-header">
        <div>
          <h1>YouTube Language Lab</h1>
          <p>{status}</p>
        </div>
      </header>

      {activeView === "home" ? (
        <>
          {isSignedIn ? (
            <>
              <section className="signed-home-head">
                <button type="button" onClick={() => setActiveView("account")}>
                  <UserRound size={17} />
                  <span>{bootstrap?.user.email ?? bootstrap?.user.displayName ?? "账号"}</span>
                  <ChevronRight size={16} />
                </button>
                <span className="plan">
                  <ShieldCheck size={13} />
                  {bootstrap?.entitlement.plan.toUpperCase()}
                </span>
              </section>

              <section className="feature-grid">
                <FeatureCard icon={<BookOpen size={18} />} label="生词" value={vocabCount} onClick={openLearningLibrary} />
                <FeatureCard icon={<CheckCircle2 size={18} />} label="已掌握" value={masteredCount} onClick={openLearningLibrary} />
                <FeatureCard icon={<BookMarked size={18} />} label="例句库" value={sentenceCount} onClick={openLearningLibrary} />
                <FeatureCard icon={<Dumbbell size={18} />} label="混合练习" value={practiceCount} onClick={openPractice} />
                <FeatureCard icon={<FileText size={18} />} label="PDF 翻译" value="beta" onClick={openOptions} />
              </section>

              {settings ? (
                <section className="site-card">
                  <SwitchSetting
                    icon={<Power size={17} />}
                    label="允许在此网站运行"
                    checked={settings.enabled}
                    onChange={(checked) => void updateSettings({ enabled: checked })}
                  />
                  <SwitchSetting
                    icon={<Languages size={17} />}
                    label="始终翻译此站点"
                    checked={settings.showDualSubtitles}
                    onChange={(checked) => void updateSettings({ showDualSubtitles: checked })}
                  />
                  <ActionSetting icon={<Settings size={17} />} label="youtube.com" value="管理黑名单" onClick={() => setActiveView("siteAccess")} />
                </section>
              ) : null}

              <section className="library-preview">
                <div className="preview-tabs">
                  <button className={previewTab === "page" ? "active" : ""} type="button" onClick={() => setPreviewTab("page")}>
                    本页生词({pageNewWords.length})
                  </button>
                  <button className={previewTab === "mastered" ? "active" : ""} type="button" onClick={() => setPreviewTab("mastered")}>
                    已掌握({pageMasteredWords.length})
                  </button>
                  <button className={previewTab === "sentences" ? "active" : ""} type="button" onClick={() => setPreviewTab("sentences")}>
                    收藏句({sentenceCount})
                  </button>
                </div>
                {previewTab === "page" && pageNewWords.length ? (
                  <div className="word-list">
                    {pageNewWords.map((item) => (
                      <PreviewWordRow
                        key={item.text}
                        item={item}
                        busyKey={wordActionBusy}
                        saveLabel={item.saved ? "已收" : "生词"}
                        onSave={() => void savePreviewWord(item, 0, item.saved ? "已在生词库中。" : "已添加到生词库。")}
                        onMaster={() => void savePreviewWord(item, 5, "已移动到已掌握。")}
                        onSaveSentence={() => void saveSentenceFromWord(item)}
                        onOpen={openLearningLibrary}
                      />
                    ))}
                  </div>
                ) : null}
                {previewTab === "mastered" && pageMasteredWords.length ? (
                  <div className="word-list">
                    {pageMasteredWords.map((item) => (
                      <PreviewWordRow
                        key={item.text}
                        item={item}
                        busyKey={wordActionBusy}
                        saveLabel="生词"
                        onSave={() => void savePreviewWord(item, 0, "已移回本页生词。")}
                        onMaster={() => void savePreviewWord(item, 5, "已在已掌握列表中。")}
                        onSaveSentence={() => void saveSentenceFromWord(item)}
                        onOpen={openLearningLibrary}
                      />
                    ))}
                  </div>
                ) : null}
                {previewTab === "sentences" && recentSentences.length ? (
                  <div className="word-list">
                    <button className="sentence-save-inline" type="button" onClick={saveCurrentSentence}>
                      <BookMarked size={15} />
                      <span>收藏当前句</span>
                    </button>
                    {recentSentences.map((item, index) => (
                      <button key={`${item.text ?? "sentence"}-${index}`} type="button" onClick={openLearningLibrary}>
                        <span>
                          <strong>{item.text ?? "未命名例句"}</strong>
                          <small>{item.translatedText ?? "译文待补充"}</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                ) : null}
                {((previewTab === "page" && !pageNewWords.length) ||
                  (previewTab === "mastered" && !pageMasteredWords.length) ||
                  (previewTab === "sentences" && !recentSentences.length)) ? (
                  <div className="empty-preview">
                    <CircleAlert size={18} />
                    <span>{previewEmptyText(previewTab, pageWords.length)}</span>
                    {previewTab === "sentences" ? (
                      <button className="sentence-save-inline" type="button" onClick={saveCurrentSentence}>
                        <BookMarked size={15} />
                        收藏当前句
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {!isSignedIn ? (
            <section className="login-card">
              <div className="login-heading">
                <span className="label">账号</span>
                <span className="plan">
                  <ShieldCheck size={13} />
                  {accountBadge}
                </span>
              </div>
              {!bootstrap ? (
                <div className="account-loading" aria-live="polite">
                  <span className="loading-line wide" />
                  <span className="loading-line" />
                  <p>正在读取已保存的登录状态...</p>
                </div>
              ) : (
                <>
                  <div className="login-fields">
                    <label>
                      <span>邮箱</span>
                      <input type="email" value={authEmail} autoComplete="email" onChange={(event) => setAuthEmail(event.target.value)} />
                    </label>
                    <label>
                      <span>密码</span>
                      <input
                        type="password"
                        value={authPassword}
                        autoComplete="current-password"
                        placeholder="至少 6 位"
                        onChange={(event) => setAuthPassword(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mini-button-row">
                    <button type="button" onClick={() => submitAuth("SIGN_IN_EMAIL")} disabled={authBusy}>
                      <LogIn size={15} />
                      登录
                    </button>
                    <button type="button" onClick={() => submitAuth("SIGN_UP_EMAIL")} disabled={authBusy}>
                      <UserRound size={15} />
                      注册
                    </button>
                  </div>
                  <p className="login-note">V1 可匿名使用；登录后读取远端权限，后续用于云同步。</p>
                </>
              )}
            </section>
          ) : null}

          <div className="action-grid">
            <button type="button" onClick={runSafePageProbe}>
              <BookOpen size={17} />
              检测页面
            </button>
            <button type="button" onClick={mountMiniPanel}>
              <BookOpen size={17} />
              唤醒面板
            </button>
            <button type="button" onClick={loadMiniCaptions}>
              <BookOpen size={17} />
              重读字幕
            </button>
          </div>

          <section className="account-card">
            <div>
              <span className="label">当前版本</span>
              <strong>0.1.141 待审核</strong>
              <p>修复学习库筛选、字幕设置面板和官方字幕优先读取。</p>
            </div>
            <span className="plan">
              <ShieldCheck size={13} />
              SAFE
            </span>
          </section>
        </>
      ) : activeView === "siteAccess" ? (
        <section className="site-access-view">
          <div className="subpage-title">
            <button type="button" onClick={() => setActiveView("home")}>
              <ChevronRight size={17} />
            </button>
            <strong>管理黑白名单</strong>
            <button type="button" onClick={() => setActiveView("home")}>
              ×
            </button>
          </div>

          {!settings ? (
            <div className="settings-loading">正在读取设置...</div>
          ) : (
            <>
              <div className="site-mode-card">
                <button
                  className={settings.siteAccessMode === "blacklist" ? "active" : ""}
                  type="button"
                  onClick={() => void updateSettings({ siteAccessMode: "blacklist" })}
                >
                  <span>
                    <strong>黑名单功能</strong>
                    <small>加入黑名单内的网站将不支持 Language Lab 功能</small>
                  </span>
                  <CheckCircle2 size={17} />
                </button>
                <button
                  className={settings.siteAccessMode === "whitelist" ? "active" : ""}
                  type="button"
                  onClick={() => void updateSettings({ siteAccessMode: "whitelist" })}
                >
                  <span>
                    <strong>白名单功能</strong>
                    <small>加入白名单内的网站将才会支持 Language Lab 功能</small>
                  </span>
                  <CheckCircle2 size={17} />
                </button>
              </div>

              <div className="site-list-editor">
                <strong>网址列表</strong>
                <input
                  type="text"
                  placeholder="可搜索、添加网址、通配符"
                  value={sitePattern}
                  onChange={(event) => setSitePattern(event.target.value)}
                />
                <button type="button" onClick={addSiteRule}>添加</button>
                <div className="site-rule-list">
                  {currentSiteRules.length ? currentSiteRules.map((pattern) => (
                    <div className="site-rule-row" key={pattern}>
                      <span>{pattern}</span>
                      <em>子域名匹配</em>
                      <button
                        type="button"
                        onClick={() => void removeSiteRule(pattern, settings.siteAccessMode === "whitelist" ? "siteWhitelist" : "siteBlacklist")}
                        title="删除"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )) : (
                    <small>当前列表为空。</small>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      ) : activeView === "settings" ? (
        <section className="popup-settings">
          <div className="settings-title-row">
            <div>
              <strong>设置</strong>
              <span>{accountBadge}</span>
            </div>
            <button type="button" onClick={reloadBootstrap}>
              <SlidersHorizontal size={15} />
              刷新
            </button>
          </div>

          {!bootstrap || !settings ? (
            <div className="settings-loading">正在读取设置...</div>
          ) : (
            <>
              <SettingsSection title="账号" accent>
                <ActionSetting
                  icon={<UserRound size={17} />}
                  label={isSignedIn ? bootstrap.user.email ?? bootstrap.user.displayName ?? "Supabase 用户" : "本地匿名"}
                  value={isSignedIn ? bootstrap.entitlement.plan.toUpperCase() : "LOCAL"}
                  onClick={isSignedIn ? () => setActiveView("account") : () => setActiveView("home")}
                />
                {isSignedIn ? (
                  <>
                    <ActionSetting icon={<CreditCard size={17} />} label="会员管理" value={bootstrap.entitlement.plan.toUpperCase()} onClick={startBilling} />
                    <ActionSetting icon={<LogOut size={17} />} label="退出登录" value="本地保留" onClick={signOut} />
                  </>
                ) : (
                  <ActionSetting icon={<LogIn size={17} />} label="登录 / 注册" value="账号" onClick={() => setActiveView("home")} />
                )}
              </SettingsSection>

              <SettingsSection title="基础设置" accent>
                <SwitchSetting
                  icon={<Power size={17} />}
                  label="开启插件"
                  checked={settings.enabled}
                  onChange={(checked) => void updateSettings({ enabled: checked })}
                />
                {isSignedIn ? <ActionSetting icon={<BookMarked size={17} />} label="学习库 / 词本管理" value={`${vocabCount} 个生词`} onClick={openLearningLibrary} /> : null}
              </SettingsSection>

              <SettingsSection title="语言设置" accent>
                <SelectSetting
                  icon={<Languages size={17} />}
                  label="学习语言"
                  value={settings.sourceLanguage}
                  options={LANGUAGE_OPTIONS}
                  onChange={(value) => void updateSettings({ sourceLanguage: value })}
                />
                <SelectSetting
                  icon={<Languages size={17} />}
                  label="翻译结果"
                  value={settings.targetLanguage}
                  options={LANGUAGE_OPTIONS}
                  onChange={(value) => void updateSettings({ targetLanguage: value })}
                />
              </SettingsSection>

              <SettingsSection title="浏览设置" accent>
                <SwitchSetting
                  icon={<Captions size={17} />}
                  label="视频双语字幕"
                  checked={settings.showDualSubtitles}
                  onChange={(checked) => void updateSettings({ showDualSubtitles: checked })}
                />
                <SwitchSetting
                  icon={<Captions size={17} />}
                  label="隐藏 YouTube CC"
                  checked={settings.hideNativeCaptions}
                  onChange={(checked) => void updateSettings({ hideNativeCaptions: checked })}
                />
                <ActionSetting icon={<Settings size={17} />} label="字幕设置" value="打开面板" onClick={openSubtitleSettingsPanel} />
              </SettingsSection>

              {isSignedIn ? (
                <SettingsSection title="练习设置" accent>
                  <ActionSetting icon={<Dumbbell size={17} />} label="打开混合练习" value={`${practiceCount} 次记录`} onClick={openPractice} />
                  <SwitchSetting
                    icon={<Dumbbell size={17} />}
                    label="逐句自动暂停"
                    checked={settings.autoPauseInPractice}
                    onChange={(checked) => void updateSettings({ autoPauseInPractice: checked })}
                  />
                  <SwitchSetting
                    icon={<Dumbbell size={17} />}
                    label="循环当前句"
                    checked={settings.loopPracticeCue}
                    onChange={(checked) => void updateSettings({ loopPracticeCue: checked })}
                  />
                  <SelectSetting
                    icon={<Mic size={17} />}
                    label="播放速度"
                    value={String(settings.playbackRate)}
                    options={PLAYBACK_RATE_OPTIONS}
                    onChange={(value) => void updateSettings({ playbackRate: Number(value) })}
                  />
                  <SwitchSetting
                    icon={<Mic size={17} />}
                    label="保存跟读录音"
                    checked={settings.saveRawRecordings}
                    onChange={(checked) => void updateSettings({ saveRawRecordings: checked })}
                  />
                </SettingsSection>
              ) : null}

              {isSignedIn ? (
                <SettingsSection title="数据设置" accent>
                  <SwitchSetting
                    icon={<ShieldCheck size={17} />}
                    label="云同步"
                    checked={settings.syncEnabled}
                    onChange={(checked) => void updateSettings({ syncEnabled: checked })}
                  />
                  <ActionSetting
                    icon={<ShieldCheck size={17} />}
                    label="立即同步到 Supabase"
                    value="上传学习数据"
                    onClick={syncLibrary}
                  />
                  <ActionSetting
                    icon={<Download size={17} />}
                    label="导出数据"
                    value={`${sentenceCount} 句 / ${vocabCount} 词`}
                    onClick={exportData}
                  />
                </SettingsSection>
              ) : null}

              <SettingsSection title="翻译与更多" accent>
                <SwitchSetting
                  icon={<Sparkles size={17} />}
                  label="AI 翻译/讲解"
                  checked={settings.ai.enabled}
                  onChange={(checked) => void updateSettings({ ai: { ...settings.ai, enabled: checked } })}
                />
                <ActionSetting icon={<Settings size={17} />} label="高级设置" value="选项页" onClick={openOptions} />
              </SettingsSection>
            </>
          )}
        </section>
      ) : activeView === "library" ? (
        <section className="popup-library-view">
          <div className="subpage-title">
            <button type="button" onClick={() => setActiveView("home")}>
              <ChevronRight size={17} />
            </button>
            <strong>学习库</strong>
            <button type="button" onClick={() => setActiveView("home")}>
              ×
            </button>
          </div>

          {!bootstrap || !isSignedIn ? (
            <div className="settings-loading">请先登录账号。</div>
          ) : (
            <>
              <div className="library-toolbar">
                <select value={selectedLibraryWordbookId} onChange={(event) => setLibraryWordbookId(event.target.value)}>
                  {wordbooks.map((wordbook) => (
                    <option key={wordbook.id ?? wordbook.name} value={wordbook.id ?? ""}>
                      {wordbook.name ?? "默认词本"}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={syncLibrary}>同步</button>
                <button
                  type="button"
                  onClick={deleteLibraryWordbook}
                  disabled={!selectedLibraryWordbook?.id || selectedLibraryWordbook.name === "默认词本"}
                  title="删除当前词本"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="library-manage">
                <input
                  type="text"
                  maxLength={40}
                  placeholder="新建词本名称"
                  value={newWordbookName}
                  onChange={(event) => setNewWordbookName(event.target.value)}
                />
                <button type="button" onClick={createLibraryWordbook}>新建词本</button>
                <button type="button" onClick={exportCurrentWordbook}>导出当前词本</button>
              </div>
              <div className="library-summary">
                <button className={libraryTab === "new" ? "active" : ""} type="button" onClick={() => setLibraryTab("new")}>
                  生词 {libraryNewWords.length}
                </button>
                <button className={libraryTab === "mastered" ? "active" : ""} type="button" onClick={() => setLibraryTab("mastered")}>
                  已掌握 {libraryMasteredWords.length}
                </button>
                <button className={libraryTab === "sentences" ? "active" : ""} type="button" onClick={() => setLibraryTab("sentences")}>
                  收藏句 {sentenceCount}
                </button>
              </div>
              {libraryTab === "sentences" ? (
                <div className="popup-sentence-list">
                  {sentenceNotes.length ? sentenceNotes.map((item, index) => (
                    <button key={`${item.text ?? "sentence"}-${index}`} type="button" onClick={openPractice}>
                      <span>
                        <em>{item.text ?? "未命名例句"}</em>
                        <small>{item.translatedText ?? "译文待补充"}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  )) : (
                    <small>暂无收藏句。可在视频页点击“收藏当前句”。</small>
                  )}
                </div>
              ) : (
                <div className="popup-library-list">
                  {visibleLibraryWords.length ? visibleLibraryWords.map((item) => (
                    <div className="popup-library-row" key={item.id ?? item.text}>
                      <span>
                        <strong>{item.text ?? "未命名单词"}</strong>
                        <small>{item.meaning ?? item.sourceSentence ?? "释义待补充"}</small>
                      </span>
                      <em>{(item.mastery ?? 0) >= 4 ? "已掌握" : "生词"}</em>
                      <button type="button" onClick={() => void deleteLibraryWord(item)} title="从当前词本删除">
                        <Trash2 size={14} />
                        删除
                      </button>
                    </div>
                  )) : (
                    <div className="empty-preview">
                      <CircleAlert size={18} />
                      <span>{libraryTab === "mastered" ? "当前词本还没有已掌握单词。" : "当前词本还没有生词。"}</span>
                    </div>
                  )}
                </div>
              )}
              <button className="detail-action" type="button" onClick={openPractice}>打开混合练习</button>
            </>
          )}
        </section>
      ) : (
        <section className="account-detail">
          <div className="subpage-title">
            <button type="button" onClick={() => setActiveView("settings")}>
              <ChevronRight size={17} />
            </button>
            <strong>账号</strong>
            <button type="button" onClick={() => setActiveView("home")}>
              ×
            </button>
          </div>

          {!bootstrap || !isSignedIn ? (
            <div className="settings-loading">请先登录账号。</div>
          ) : (
            <>
              <div className="detail-row">
                <span>邮箱</span>
                <strong>{bootstrap.user.email ?? "未绑定邮箱"}</strong>
              </div>
              <div className="detail-row">
                <span>会员</span>
                <strong className="premium-badge">{bootstrap.entitlement.plan === "pro" ? "Premium" : "Free"}</strong>
              </div>
              <div className="detail-row">
                <span>到期时间</span>
                <strong>{bootstrap.entitlement.expiresAt ? new Date(bootstrap.entitlement.expiresAt).toLocaleDateString() : "长期可用"}</strong>
              </div>
              <button className="detail-action" type="button" onClick={startBilling}>个人中心</button>
              <button className="detail-action" type="button" onClick={openOptions}>数据统计</button>
              <div className="detail-stats">
                <span>生词 {vocabCount}</span>
                <span>例句 {sentenceCount}</span>
                <span>练习 {practiceCount}</span>
              </div>
              <button className="detail-action muted" type="button" onClick={signOut}>退出登录</button>
            </>
          )}
        </section>
      )}

      <nav className="popup-nav" aria-label="Popup views">
        <button className={activeView === "home" ? "active" : ""} type="button" onClick={() => setActiveView("home")}>
          <UserRound size={16} />
          我的
        </button>
        <button className={activeView === "settings" ? "active" : ""} type="button" onClick={() => setActiveView("settings")}>
          <Settings size={16} />
          设置
        </button>
      </nav>
    </main>
  );
}

function FeatureCard({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: number | string; onClick: () => void }) {
  return (
    <button className="feature-card" type="button" onClick={onClick}>
      <span>{icon}</span>
      <strong>{label}</strong>
      <em>{value}</em>
    </button>
  );
}

function PreviewWordRow({
  item,
  busyKey,
  saveLabel,
  onSave,
  onMaster,
  onSaveSentence,
  onOpen
}: {
  item: PreviewWord;
  busyKey: string;
  saveLabel: string;
  onSave: () => void;
  onMaster: () => void;
  onSaveSentence: () => void;
  onOpen: () => void;
}) {
  const saveBusy = busyKey === `${item.text}:0`;
  const masterBusy = busyKey === `${item.text}:5`;
  return (
    <div className="word-row">
      <button className="word-row-main" type="button" onClick={onOpen}>
        <span>
          <strong>{item.text}</strong>
          <small>{item.meaning ?? item.sourceSentence ?? "释义待补充"}</small>
        </span>
        <ChevronRight size={15} />
      </button>
      <div className="word-row-actions">
        <button type="button" onClick={onSave} disabled={saveBusy || masterBusy} title={saveLabel === "生词" ? "加入本页生词/生词库" : "已在生词库"}>
          <Heart size={14} />
          <span>{saveLabel}</span>
        </button>
        <button type="button" onClick={onMaster} disabled={saveBusy || masterBusy} title="标记为已掌握">
          <CheckCircle2 size={14} />
          <span>掌握</span>
        </button>
        <button type="button" onClick={onSaveSentence} disabled={!item.sourceSentence} title="收藏该单词所在字幕句">
          <BookMarked size={14} />
          <span>收藏句</span>
        </button>
      </div>
    </div>
  );
}

function normalizePreviewWord(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function safeFilename(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 48) || "wordbook";
}

function cleanSitePattern(value: string): string {
  const trimmed = value.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return trimmed.toLowerCase().replace(/\s+/g, "");
}

function uniqueWordbookPreviews(wordbooks: WordbookPreview[]): WordbookPreview[] {
  const byName = new Map<string, WordbookPreview>();
  for (const wordbook of wordbooks) {
    const key = (wordbook.name ?? "默认词本").trim().toLowerCase();
    const existing = byName.get(key);
    if (!existing || (wordbook.createdAt ?? "").localeCompare(existing.createdAt ?? "") < 0) {
      byName.set(key, wordbook);
    }
  }
  return Array.from(byName.values());
}

function previewEmptyText(tab: PreviewTab, totalPageWords: number): string {
  if (tab === "page") return totalPageWords ? "本页单词都已掌握。" : "当前页还没有读取到字幕单词，请先点击重读字幕。";
  if (tab === "mastered") return "本页还没有已掌握单词。";
  return "当前还没有收藏句。";
}

function mergeSettings(settings: ExtensionSettings, patch: Partial<ExtensionSettings>): ExtensionSettings {
  return {
    ...settings,
    ...patch,
    ai: {
      ...settings.ai,
      ...(patch.ai ?? {})
    }
  };
}

function SettingsSection({ title, accent, children }: { title: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className="settings-section">
      <h2 className={accent ? "accent" : ""}>{title}</h2>
      <div className="settings-rows">{children}</div>
    </div>
  );
}

function SwitchSetting({
  icon,
  label,
  checked,
  onChange
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting-row">
      <span className="setting-icon">{icon}</span>
      <span className="setting-label">{label}</span>
      <span className="switch-control">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span />
      </span>
    </label>
  );
}

function SelectSetting({
  icon,
  label,
  value,
  options,
  onChange
}: {
  icon: ReactNode;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="setting-row">
      <span className="setting-icon">{icon}</span>
      <span className="setting-label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionSetting({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button className="setting-row action" type="button" onClick={onClick}>
      <span className="setting-icon">{icon}</span>
      <span className="setting-label">{label}</span>
      <span className="setting-value">{value}</span>
      <ChevronRight size={16} />
    </button>
  );
}
