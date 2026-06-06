import {
  BookMarked,
  BookOpen,
  Captions,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Languages,
  LogIn,
  LogOut,
  Mic,
  Power,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { sendRuntimeMessage } from "../shared/messages";
import type { EntitlementSnapshot, ExtensionSettings, RemoteAuthSnapshot, UserProfile } from "../shared/types";

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
    vocabItems: unknown[];
    sentenceNotes: unknown[];
    practiceAttempts: unknown[];
  };
};

type PopupView = "home" | "settings";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "英语" },
  { value: "zh-Hans", label: "中文(简体)" },
  { value: "zh-Hant", label: "中文(繁体)" },
  { value: "ja", label: "日语" },
  { value: "ko", label: "韩语" },
  { value: "es", label: "西班牙语" }
];

const PLAYBACK_RATE_OPTIONS = [
  { value: "0.8", label: "0.8x" },
  { value: "1", label: "1.0x" },
  { value: "1.1", label: "1.1x" },
  { value: "1.25", label: "1.25x" }
];

export function PopupApp() {
  const [status, setStatus] = useState("自动模式：YouTube 视频页会加载新版轻量字幕面板。");
  const [bootstrap, setBootstrap] = useState<PopupBootstrap | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<ExtensionSettings | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [activeView, setActiveView] = useState<PopupView>("home");

  const reloadBootstrap = async () => {
    const response = await sendRuntimeMessage<PopupBootstrap>({ type: "GET_BOOTSTRAP" });
    if (response.ok) {
      setBootstrap(response.data);
      setSettingsDraft(response.data.settings);
      return;
    }
    setStatus(response.error);
  };

  useEffect(() => {
    void reloadBootstrap();
  }, []);

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

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const page = window as Window & {
          __yllSafeTimer?: number;
          __yllSafeOverlayTimer?: number;
          __yllSafeOfficialRetryTimer?: number;
          __yllSafeStopCurrentScript?: () => void;
          __yllSafeRows?: unknown[];
          __yllSafeActiveKey?: string;
          __yllSafeLoadedVideoId?: string;
          __yllSafeLoadingVideoId?: string;
          __yllSafeOfficialLockedVideoId?: string;
        };
        page.__yllSafeStopCurrentScript?.();
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

  const updateSettings = async (patch: Partial<ExtensionSettings>) => {
    if (!settingsDraft) return;

    const previous = settingsDraft;
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
    setStatus("设置已保存。");
  };

  const isSignedIn = bootstrap?.auth.status === "signed-in";
  const vocabCount = bootstrap?.library.vocabItems.length ?? 0;
  const sentenceCount = bootstrap?.library.sentenceNotes.length ?? 0;
  const practiceCount = bootstrap?.library.practiceAttempts.length ?? 0;
  const accountBadge = !bootstrap ? "LOADING" : isSignedIn ? "SIGNED IN" : "LOCAL";
  const settings = settingsDraft;

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
          <section className="hero-panel" role="button" tabIndex={0} onClick={openPractice} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") void openPractice();
          }}>
            <div className="hero-icon">
              <Mic size={24} />
            </div>
            <div>
              <strong>全屏混合练习</strong>
              <span>跟读评分、听写、填空、理解选择</span>
            </div>
          </section>

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
            ) : isSignedIn ? (
              <>
                <div className="account-row-mini">
                  <UserRound size={18} />
                  <div>
                    <strong>{bootstrap.user.email ?? bootstrap.user.displayName ?? "Supabase 用户"}</strong>
                    <p>{bootstrap.entitlement.plan.toUpperCase()} · 本地学习数据继续保留</p>
                  </div>
                </div>
                <div className="account-dashboard">
                  <button type="button" onClick={openOptions}>
                    <BookOpen size={18} />
                    <span>生词</span>
                    <strong>{vocabCount}</strong>
                  </button>
                  <button type="button" onClick={openOptions}>
                    <BookMarked size={18} />
                    <span>收藏句</span>
                    <strong>{sentenceCount}</strong>
                  </button>
                  <button type="button" onClick={openPractice}>
                    <Dumbbell size={18} />
                    <span>练习</span>
                    <strong>{practiceCount}</strong>
                  </button>
                  <button type="button" onClick={openOptions}>
                    <CheckCircle2 size={18} />
                    <span>已掌握</span>
                    <strong>0</strong>
                  </button>
                </div>
                <div className="mini-button-row">
                  <button type="button" onClick={() => setActiveView("settings")}>
                    <Settings size={15} />
                    设置
                  </button>
                  <button type="button" onClick={signOut} disabled={authBusy}>
                    <LogOut size={15} />
                    退出
                  </button>
                </div>
              </>
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
              <strong>0.1.118 待审核</strong>
              <p>修复账号加载闪烁，并补充插件内设置视图。</p>
            </div>
            <span className="plan">
              <ShieldCheck size={13} />
              SAFE
            </span>
          </section>
        </>
      ) : (
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
                  onClick={isSignedIn ? openOptions : () => setActiveView("home")}
                />
              </SettingsSection>

              <SettingsSection title="基础设置" accent>
                <SwitchSetting
                  icon={<Power size={17} />}
                  label="开启插件"
                  checked={settings.enabled}
                  onChange={(checked) => void updateSettings({ enabled: checked })}
                />
                <ActionSetting icon={<BookMarked size={17} />} label="词本管理" value={`${vocabCount} 个生词`} onClick={openOptions} />
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
                <ActionSetting icon={<Settings size={17} />} label="字幕设置" value="打开面板" onClick={mountMiniPanel} />
              </SettingsSection>

              <SettingsSection title="练习设置" accent>
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
              </SettingsSection>

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
