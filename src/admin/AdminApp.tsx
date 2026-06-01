import {
  Ban,
  Check,
  Clock,
  LogIn,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  UserRoundCog,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { sendRuntimeMessage } from "../shared/messages";
import type {
  AdminAccessSnapshot,
  AdminEntitlementOverrideDraft,
  AdminUserDetail,
  AdminUserListResponse,
  AdminUserSummary,
  FeatureKey,
  RemoteAuthSnapshot,
  UsageFeature,
  UserPlan
} from "../shared/types";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  basicSubtitles: "基础字幕",
  localLibrary: "本地词句库",
  aiTranslation: "AI 翻译",
  aiExplanation: "AI 解释",
  speechScoring: "跟读评分",
  cloudSync: "云同步",
  advancedExport: "高级导出",
  batchTranslation: "批量翻译",
  longTermBackup: "长期备份"
};

const USAGE_LABELS: Record<UsageFeature, string> = {
  translate: "翻译",
  explain: "解释",
  speechScore: "评分",
  practiceGenerate: "练习生成"
};

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];
const USAGE_KEYS = Object.keys(USAGE_LABELS) as UsageFeature[];

interface DraftState extends Omit<AdminEntitlementOverrideDraft, "expiresAt"> {
  expiresAt: string;
}

export function AdminApp() {
  const [access, setAccess] = useState<AdminAccessSnapshot | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const canEdit = Boolean(access?.canManageEntitlements);
  const selectedUserId = selected?.userId;

  const proCount = useMemo(() => users.filter((user) => user.plan === "pro").length, [users]);
  const overrideCount = useMemo(() => users.filter((user) => user.overrideEnabled).length, [users]);

  const loadDashboard = async (nextQuery = query) => {
    setLoading(true);
    setMessage("");

    const accessResponse = await sendRuntimeMessage<AdminAccessSnapshot>({ type: "ADMIN_ME" });
    if (!accessResponse.ok) {
      setAccess(null);
      setUsers([]);
      setSelected(null);
      setDraft(null);
      setMessage(accessResponse.error);
      setLoading(false);
      return;
    }

    setAccess(accessResponse.data);
    if (!accessResponse.data.isAdmin) {
      setUsers([]);
      setSelected(null);
      setDraft(null);
      setMessage("当前账号没有管理员权限。");
      setLoading(false);
      return;
    }

    const listResponse = await sendRuntimeMessage<AdminUserListResponse>({
      type: "ADMIN_LIST_USERS",
      payload: { query: nextQuery, limit: 40 }
    });

    if (!listResponse.ok) {
      setMessage(listResponse.error);
      setLoading(false);
      return;
    }

    setUsers(listResponse.data.users);
    setAccess(listResponse.data.access);

    const nextSelectedId = selectedUserId && listResponse.data.users.some((user) => user.userId === selectedUserId) ? selectedUserId : listResponse.data.users[0]?.userId;
    if (nextSelectedId) {
      await loadUser(nextSelectedId, false);
    } else {
      setSelected(null);
      setDraft(null);
    }

    setLoading(false);
  };

  const loadUser = async (userId: string, showLoading = true) => {
    if (showLoading) setLoading(true);
    const response = await sendRuntimeMessage<AdminUserDetail>({ type: "ADMIN_GET_USER", payload: { userId } });
    if (!response.ok) {
      setMessage(response.error);
      if (showLoading) setLoading(false);
      return;
    }

    setSelected(response.data);
    setDraft(detailToDraft(response.data));
    if (showLoading) setLoading(false);
  };

  const submitLogin = async () => {
    if (!authEmail.trim() || !authPassword) {
      setMessage("请输入邮箱和密码。");
      return;
    }

    const response = await sendRuntimeMessage<RemoteAuthSnapshot>({
      type: "SIGN_IN_EMAIL",
      payload: { email: authEmail, password: authPassword }
    });

    if (!response.ok) {
      setMessage(response.error);
      return;
    }

    setAuthPassword("");
    await loadDashboard("");
  };

  const searchUsers = async () => {
    await loadDashboard(query);
  };

  const saveOverride = async () => {
    if (!draft) return;

    const response = await sendRuntimeMessage<AdminUserDetail>({
      type: "ADMIN_SAVE_OVERRIDE",
      payload: {
        ...draft,
        expiresAt: fromDateTimeLocal(draft.expiresAt)
      }
    });

    if (!response.ok) {
      setMessage(response.error);
      return;
    }

    setSelected(response.data);
    setDraft(detailToDraft(response.data));
    setMessage("权限已保存。");
    await refreshListOnly();
  };

  const clearOverride = async () => {
    if (!selected) return;
    const response = await sendRuntimeMessage<AdminUserDetail>({
      type: "ADMIN_CLEAR_OVERRIDE",
      payload: { userId: selected.userId, reason: draft?.reason || "admin clear" }
    });

    if (!response.ok) {
      setMessage(response.error);
      return;
    }

    setSelected(response.data);
    setDraft(detailToDraft(response.data));
    setMessage("手动权限已撤销。");
    await refreshListOnly();
  };

  const refreshListOnly = async () => {
    const response = await sendRuntimeMessage<AdminUserListResponse>({
      type: "ADMIN_LIST_USERS",
      payload: { query, limit: 40 }
    });
    if (response.ok) setUsers(response.data.users);
  };

  useEffect(() => {
    void loadDashboard("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!access?.isAdmin) {
    return (
      <main className="admin-shell auth-shell">
        <section className="auth-panel">
          <div className="brand-lock">
            <Shield size={22} />
          </div>
          <h1>管理员后台</h1>
          {message ? <div className="admin-notice">{message}</div> : null}
          <label>
            <span>管理员邮箱</span>
            <input type="email" value={authEmail} autoComplete="email" onChange={(event) => setAuthEmail(event.target.value)} />
          </label>
          <label>
            <span>密码</span>
            <input type="password" value={authPassword} autoComplete="current-password" onChange={(event) => setAuthPassword(event.target.value)} />
          </label>
          <button type="button" className="primary-action" onClick={submitLogin}>
            <LogIn size={16} />
            登录
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <h1>管理员后台</h1>
          <p>{access.role} · {canEdit ? "可修改权限" : "只读"}</p>
        </div>
        <div className="metric-strip">
          <Metric icon={<Users size={16} />} label="用户" value={users.length} />
          <Metric icon={<Shield size={16} />} label="Pro" value={proCount} />
          <Metric icon={<SlidersHorizontal size={16} />} label="覆盖" value={overrideCount} />
        </div>
      </header>

      {message ? <div className="admin-notice">{message}</div> : null}

      <section className="admin-layout" aria-busy={loading}>
        <aside className="user-panel">
          <form
            className="search-row"
            onSubmit={(event) => {
              event.preventDefault();
              void searchUsers();
            }}
          >
            <Search size={16} />
            <input value={query} placeholder="搜索邮箱或昵称" onChange={(event) => setQuery(event.target.value)} />
            <button type="submit" title="搜索">
              <Search size={15} />
            </button>
            <button type="button" title="刷新" onClick={() => void loadDashboard(query)}>
              <RefreshCcw size={15} />
            </button>
          </form>

          <div className="user-list">
            {users.map((user) => (
              <button
                className={user.userId === selected?.userId ? "user-row active" : "user-row"}
                key={user.userId}
                type="button"
                onClick={() => void loadUser(user.userId)}
              >
                <span>
                  <strong>{user.email ?? user.userId}</strong>
                  <small>{user.displayName ?? user.authProvider}</small>
                </span>
                <StatusPill active={user.plan === "pro"}>{user.plan.toUpperCase()}</StatusPill>
              </button>
            ))}
          </div>
        </aside>

        <section className="detail-panel">
          {selected && draft ? (
            <>
              <div className="detail-head">
                <div>
                  <h2>{selected.email ?? selected.userId}</h2>
                  <p>{selected.displayName ?? "未设置昵称"} · {selected.authProvider}</p>
                </div>
                <StatusPill active={selected.entitlement.plan === "pro"}>{selected.entitlement.plan.toUpperCase()}</StatusPill>
              </div>

              <div className="summary-grid">
                <SummaryItem label="创建时间" value={formatDate(selected.createdAt)} />
                <SummaryItem label="到期时间" value={selected.entitlement.expiresAt ? formatDate(selected.entitlement.expiresAt) : "无"} />
                <SummaryItem label="订阅状态" value={selected.subscription?.status ?? "无"} />
                <SummaryItem label="覆盖状态" value={selected.override?.isEnabled ? "启用" : "未启用"} />
              </div>

              <section className="editor-block">
                <h3>
                  <UserRoundCog size={17} />
                  权限覆盖
                </h3>
                <div className="form-grid compact">
                  <label>
                    <span>套餐</span>
                    <select
                      value={draft.plan}
                      disabled={!canEdit}
                      onChange={(event) => setDraft({ ...draft, plan: event.target.value as UserPlan })}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                    </select>
                  </label>
                  <label>
                    <span>到期时间</span>
                    <input
                      type="datetime-local"
                      value={draft.expiresAt}
                      disabled={!canEdit}
                      onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>启用覆盖</span>
                    <select
                      value={draft.isEnabled ? "enabled" : "disabled"}
                      disabled={!canEdit}
                      onChange={(event) => setDraft({ ...draft, isEnabled: event.target.value === "enabled" })}
                    >
                      <option value="enabled">启用</option>
                      <option value="disabled">停用</option>
                    </select>
                  </label>
                  <label>
                    <span>备注</span>
                    <input value={draft.reason ?? ""} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
                  </label>
                </div>
              </section>

              <section className="editor-block">
                <h3>
                  <Check size={17} />
                  功能开关
                </h3>
                <div className="feature-grid">
                  {FEATURE_KEYS.map((key) => (
                    <label className="switch-line" key={key}>
                      <input
                        type="checkbox"
                        checked={draft.features[key] ?? false}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            features: { ...draft.features, [key]: event.target.checked }
                          })
                        }
                      />
                      <span>{FEATURE_LABELS[key]}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="editor-block">
                <h3>
                  <SlidersHorizontal size={17} />
                  每日额度
                </h3>
                <div className="quota-grid">
                  {USAGE_KEYS.map((key) => (
                    <label key={key}>
                      <span>
                        {USAGE_LABELS[key]}
                        <small>已用 {selected.entitlement.usageToday[key]}</small>
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={draft.quota[key] ?? 0}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            quota: { ...draft.quota, [key]: Math.max(0, Number(event.target.value) || 0) }
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>

              <div className="action-bar">
                <button type="button" className="primary-action" disabled={!canEdit} onClick={saveOverride}>
                  <Save size={16} />
                  保存权限
                </button>
                <button type="button" disabled={!canEdit} onClick={clearOverride}>
                  <Ban size={16} />
                  撤销覆盖
                </button>
                <button type="button" onClick={() => void loadUser(selected.userId)}>
                  <RotateCcw size={16} />
                  还原
                </button>
              </div>

              <section className="audit-block">
                <h3>
                  <Clock size={17} />
                  审计记录
                </h3>
                <div className="audit-list">
                  {selected.auditLogs.map((log) => (
                    <div className="audit-row" key={log.id}>
                      <span>{log.action}</span>
                      <strong>{formatDate(log.createdAt)}</strong>
                    </div>
                  ))}
                  {selected.auditLogs.length === 0 ? <p>暂无记录</p> : null}
                </div>
              </section>
            </>
          ) : (
            <div className="empty-state">暂无用户</div>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={active ? "status-pill active" : "status-pill"}>{children}</span>;
}

function detailToDraft(detail: AdminUserDetail): DraftState {
  const features = { ...detail.entitlement.features, ...detail.override?.features };
  const quota = { ...detail.entitlement.quota, ...detail.override?.quota };

  return {
    userId: detail.userId,
    plan: detail.override?.plan ?? detail.entitlement.plan,
    features,
    quota,
    expiresAt: toDateTimeLocal(detail.override?.expiresAt ?? detail.entitlement.expiresAt),
    isEnabled: detail.override?.isEnabled ?? true,
    reason: detail.override?.reason ?? ""
  };
}

function toDateTimeLocal(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
