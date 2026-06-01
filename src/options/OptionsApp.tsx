import { AlertTriangle, CreditCard, Download, KeyRound, LogIn, LogOut, Mic, RefreshCcw, Save, Shield, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type {
  AdminAccessSnapshot,
  EntitlementSnapshot,
  ExportBundle,
  ExtensionSettings,
  RemoteAuthSnapshot,
  RuntimeResponse,
  SecretSettings,
  UserProfile
} from "../shared/types";
import { sendRuntimeMessage } from "../shared/messages";

interface Bootstrap {
  user: UserProfile;
  localUser: UserProfile;
  auth: RemoteAuthSnapshot;
  settings: ExtensionSettings;
  secrets: { aiApiKey: string };
  entitlement: EntitlementSnapshot;
  library: {
    vocabItems: unknown[];
    sentenceNotes: unknown[];
    practiceAttempts: unknown[];
  };
}

export function OptionsApp() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [secretDraft, setSecretDraft] = useState("");
  const [message, setMessage] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [adminAccess, setAdminAccess] = useState<AdminAccessSnapshot | null>(null);

  const reload = async () => {
    const response = await sendRuntimeMessage<Bootstrap>({ type: "GET_BOOTSTRAP" });
    if (response.ok) {
      setBootstrap(response.data);
      setSettings(response.data.settings);
      setSecretDraft(response.data.secrets.aiApiKey === "configured" ? "" : "");

      if (response.data.auth.status === "signed-in") {
        const adminResponse = await sendRuntimeMessage<AdminAccessSnapshot>({ type: "ADMIN_ME" });
        setAdminAccess(adminResponse.ok ? adminResponse.data : null);
      } else {
        setAdminAccess(null);
      }
    } else {
      setMessage(response.error);
    }
  };

  const submitAuth = async (type: "SIGN_UP_EMAIL" | "SIGN_IN_EMAIL") => {
    if (!authEmail.trim() || !authPassword) {
      setMessage("请输入邮箱和密码。");
      return;
    }

    const response = await sendRuntimeMessage<RemoteAuthSnapshot>({
      type,
      payload: { email: authEmail, password: authPassword }
    });

    if (!response.ok) {
      setMessage(response.error);
      return;
    }

    setAuthPassword("");
    setMessage(response.data.status === "email-confirmation-required" ? "注册成功，请先到邮箱完成验证后再登录。" : "Supabase 账号已连接。");
    await reload();
  };

  const signOut = async () => {
    const response = await sendRuntimeMessage<RemoteAuthSnapshot>({ type: "SIGN_OUT" });
    setMessage(response.ok ? "已退出 Supabase 账号，本地学习数据仍保留。" : response.error);
    await reload();
  };

  const startBilling = async () => {
    const response = await sendRuntimeMessage<{ url: string }>({ type: "START_BILLING_CHECKOUT" });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }

    await chrome.tabs.create({ url: response.data.url });
  };

  const openAdmin = async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("admin.html") });
  };

  useEffect(() => {
    void reload();
  }, []);

  const save = async () => {
    if (!settings) return;
    const settingsResponse = await sendRuntimeMessage<ExtensionSettings>({ type: "UPDATE_SETTINGS", payload: settings });
    let secretsResponse: RuntimeResponse<SecretSettings | null> = { ok: true, data: null };
    if (secretDraft) {
      secretsResponse = await sendRuntimeMessage<SecretSettings>({ type: "UPDATE_SECRETS", payload: { aiApiKey: secretDraft } });
    }

    if (!settingsResponse.ok) {
      setMessage(settingsResponse.error);
      return;
    }

    if (!secretsResponse.ok) {
      setMessage(secretsResponse.error);
      return;
    }

    setMessage("设置已保存。");
    await reload();
  };

  const exportData = async () => {
    const response = await sendRuntimeMessage<ExportBundle>({ type: "EXPORT_DATA" });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }

    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube-language-lab-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearData = async () => {
    const confirmed = window.confirm("确定删除本地词库、收藏句和练习记录？此操作不会影响未来 V2 云端账号。");
    if (!confirmed) return;

    const response = await sendRuntimeMessage({ type: "CLEAR_LOCAL_DATA" });
    setMessage(response.ok ? "本地学习数据已清空。" : response.error);
    await reload();
  };

  if (!bootstrap || !settings) {
    return <main className="options loading">正在加载设置...</main>;
  }

  return (
    <main className="options">
      <header className="page-header">
        <div>
          <h1>YouTube Language Lab 设置</h1>
          <p>本地学习数据继续保留；Supabase 账号用于登录、远端权限和后续云同步。</p>
        </div>
        <button className="primary-button" type="button" onClick={save}>
          <Save size={16} />
          保存设置
        </button>
      </header>

      {message ? <div className="notice">{message}</div> : null}

      <section className="settings-grid">
        <Panel icon={<UserRound size={18} />} title="账号与迁移">
          <div className="account-row">
            <div>
              <span>当前身份</span>
              <strong>{bootstrap.user.displayName}</strong>
              <p>{bootstrap.auth.status === "signed-in" ? bootstrap.user.email ?? bootstrap.user.id : bootstrap.localUser.id}</p>
            </div>
            <span className="badge">{bootstrap.auth.status === "signed-in" ? "Supabase" : "本地匿名"}</span>
          </div>
          {bootstrap.auth.status === "signed-in" ? (
            <>
              <div className="future-box">
                <strong>账号已连接</strong>
                <p>当前 Pro 权限和额度会从 Supabase `me` 函数读取；本地收藏和练习记录暂时仍存放在此浏览器。</p>
              </div>
              <div className="button-row">
                <button type="button" onClick={startBilling}>
                  <CreditCard size={15} />
                  开通 / 管理会员
                </button>
                {adminAccess?.isAdmin ? (
                  <button type="button" onClick={openAdmin}>
                    <Shield size={15} />
                    管理员后台
                  </button>
                ) : null}
                <button type="button" onClick={signOut}>
                  <LogOut size={15} />
                  退出登录
                </button>
              </div>
            </>
          ) : (
            <>
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
              <div className="button-row">
                <button type="button" onClick={() => submitAuth("SIGN_IN_EMAIL")}>
                  <LogIn size={15} />
                  登录
                </button>
                <button type="button" onClick={() => submitAuth("SIGN_UP_EMAIL")}>
                  <UserRound size={15} />
                  注册
                </button>
              </div>
              <div className="future-box">
                <strong>本地数据不丢</strong>
                <p>登录后会先读取远端权限；本地记录合并到云端会作为下一步单独处理。</p>
              </div>
            </>
          )}
        </Panel>

        <Panel icon={<ShieldCheck size={18} />} title="权限与额度">
          <div className="quota-list">
            {Object.entries(bootstrap.entitlement.quota).map(([key, total]) => {
              const used = bootstrap.entitlement.usageToday[key as keyof EntitlementSnapshot["quota"]];
              return (
                <div className="quota-line" key={key}>
                  <span>{usageLabel(key)}</span>
                  <strong>
                    {used} / {total}
                  </strong>
                </div>
              );
            })}
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.syncEnabled}
              onChange={(event) => setSettings({ ...settings, syncEnabled: event.target.checked })}
            />
            <span>开启云同步占位开关。V2 后端上线前不会上传数据。</span>
          </label>
        </Panel>

        <Panel icon={<KeyRound size={18} />} title="AI 翻译与评分">
          <label>
            <span>启用 AI 功能</span>
            <input
              type="checkbox"
              checked={settings.ai.enabled}
              onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, enabled: event.target.checked } })}
            />
          </label>
          <label>
            <span>OpenAI-compatible endpoint</span>
            <input
              value={settings.ai.endpoint}
              onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, endpoint: event.target.value } })}
            />
          </label>
          <label>
            <span>模型</span>
            <input
              value={settings.ai.model}
              onChange={(event) => setSettings({ ...settings, ai: { ...settings.ai, model: event.target.value } })}
            />
          </label>
          <label>
            <span>API Key {bootstrap.secrets.aiApiKey === "configured" ? "已配置" : "未配置"}</span>
            <input
              value={secretDraft}
              type="password"
              placeholder="只保存在本机 chrome.storage.local"
              onChange={(event) => setSecretDraft(event.target.value)}
            />
          </label>
        </Panel>

        <Panel icon={<Mic size={18} />} title="练习与隐私">
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.hideNativeCaptions}
              onChange={(event) => setSettings({ ...settings, hideNativeCaptions: event.target.checked })}
            />
            <span>隐藏 YouTube 原生字幕，避免和插件双语字幕互相遮挡。</span>
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.autoPauseInPractice}
              onChange={(event) => setSettings({ ...settings, autoPauseInPractice: event.target.checked })}
            />
            <span>进入练习时逐句自动暂停</span>
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.loopPracticeCue}
              onChange={(event) => setSettings({ ...settings, loopPracticeCue: event.target.checked })}
            />
            <span>默认循环当前句</span>
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={settings.saveRawRecordings}
              onChange={(event) => setSettings({ ...settings, saveRawRecordings: event.target.checked })}
            />
            <span>保存原始录音。默认关闭；开启前请确认隐私风险。</span>
          </label>
          <div className="warning">
            <AlertTriangle size={15} />
            麦克风权限只在进入跟读练习并点击录音时请求。
          </div>
        </Panel>

        <Panel icon={<Download size={18} />} title="数据导出与删除">
          <div className="data-stats">
            <span>收藏句：{bootstrap.library.sentenceNotes.length}</span>
            <span>词汇：{bootstrap.library.vocabItems.length}</span>
            <span>练习：{bootstrap.library.practiceAttempts.length}</span>
          </div>
          <div className="button-row">
            <button type="button" onClick={exportData}>
              <Download size={15} />
              导出 JSON
            </button>
            <button type="button" onClick={reload}>
              <RefreshCcw size={15} />
              刷新
            </button>
            <button className="danger" type="button" onClick={clearData}>
              <Trash2 size={15} />
              清空本地数据
            </button>
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function usageLabel(key: string): string {
  const labels: Record<string, string> = {
    translate: "AI 翻译",
    explain: "句子讲解",
    speechScore: "跟读评分",
    practiceGenerate: "练习生成"
  };
  return labels[key] ?? key;
}
