import { buildEntitlement } from "../_shared/entitlements.ts";
import { error, json, options } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";

type UserPlan = "free" | "pro";
type AdminRole = "owner" | "admin" | "viewer";
type FeatureKey =
  | "basicSubtitles"
  | "localLibrary"
  | "aiTranslation"
  | "aiExplanation"
  | "speechScoring"
  | "cloudSync"
  | "advancedExport"
  | "batchTranslation"
  | "longTermBackup";
type UsageFeature = "translate" | "explain" | "speechScore" | "practiceGenerate";

interface AdminAccessSnapshot {
  isAdmin: boolean;
  role?: AdminRole;
  canViewUsers: boolean;
  canManageEntitlements: boolean;
  canManageAdmins: boolean;
}

interface AdminUserSummary {
  userId: string;
  email?: string;
  displayName?: string;
  authProvider: "anonymous" | "email" | "google";
  createdAt: string;
  plan: UserPlan;
  overrideEnabled: boolean;
  overrideExpiresAt?: string;
  subscriptionStatus?: string;
}

interface AdminEntitlementOverrideDraft {
  userId: string;
  plan: UserPlan;
  features: Partial<Record<FeatureKey, boolean>>;
  quota: Partial<Record<UsageFeature, number>>;
  expiresAt?: string;
  isEnabled: boolean;
  reason?: string;
}

interface AdminRequest {
  action?: "me" | "listUsers" | "getUser" | "saveOverride" | "clearOverride";
  query?: string;
  limit?: number;
  userId?: string;
  reason?: string;
  draft?: AdminEntitlementOverrideDraft;
}

interface AdminUserRow {
  role: AdminRole;
  is_enabled: boolean;
}

interface ProfileRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  auth_provider: "email" | "google";
  created_at: string;
}

interface OverrideRow {
  user_id: string;
  plan: UserPlan;
  features: Record<string, unknown> | null;
  quota: Record<string, unknown> | null;
  expires_at: string | null;
  is_enabled: boolean;
  reason: string | null;
  updated_at: string;
}

interface SubscriptionRow {
  user_id: string;
  plan: UserPlan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_price_id: string | null;
  updated_at: string;
}

interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  changes: Record<string, unknown>;
  created_at: string;
}

const FEATURE_KEYS: FeatureKey[] = [
  "basicSubtitles",
  "localLibrary",
  "aiTranslation",
  "aiExplanation",
  "speechScoring",
  "cloudSync",
  "advancedExport",
  "batchTranslation",
  "longTermBackup"
];

const USAGE_KEYS: UsageFeature[] = ["translate", "explain", "speechScore", "practiceGenerate"];
const PAID_STATUSES = new Set(["active", "trialing"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return error("Method not allowed", 405);

  try {
    const supabase = serviceClient();
    const user = await requireUser(req, supabase);
    const body = (await req.json().catch(() => ({}))) as AdminRequest;

    if (body.action === "me") {
      return json(await getAdminAccess(supabase, user.id));
    }

    const access = await getAdminAccess(supabase, user.id);
    if (!access.isAdmin || !access.canViewUsers) return error("没有管理员权限。", 403);

    switch (body.action) {
      case "listUsers":
        return json({
          access,
          users: await listUsers(supabase, body)
        });

      case "getUser":
        return json(await getUserDetail(supabase, requireUuid(body.userId)));

      case "saveOverride":
        if (!access.canManageEntitlements) return error("当前管理员角色不能修改权限。", 403);
        return json(await saveOverride(supabase, user, body.draft));

      case "clearOverride":
        if (!access.canManageEntitlements) return error("当前管理员角色不能修改权限。", 403);
        return json(await clearOverride(supabase, user, requireUuid(body.userId), body.reason));

      default:
        return error("Unknown admin action.", 400);
    }
  } catch (cause) {
    const err = cause as Error;
    const status =
      err.name === "Unauthorized" ? 401 : err.name === "BadRequest" ? 400 : err.name === "Forbidden" ? 403 : err.name === "NotFound" ? 404 : 500;
    return error(err.message, status);
  }
});

async function getAdminAccess(supabase: SupabaseClient, userId: string): Promise<AdminAccessSnapshot> {
  const { data, error: readError } = await supabase
    .from("admin_users")
    .select("role,is_enabled")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .maybeSingle<AdminUserRow>();

  if (readError) throw readError;
  if (!data) {
    return {
      isAdmin: false,
      canViewUsers: false,
      canManageEntitlements: false,
      canManageAdmins: false
    };
  }

  return {
    isAdmin: true,
    role: data.role,
    canViewUsers: true,
    canManageEntitlements: data.role === "owner" || data.role === "admin",
    canManageAdmins: data.role === "owner"
  };
}

async function listUsers(supabase: SupabaseClient, body: AdminRequest): Promise<AdminUserSummary[]> {
  const limit = clampInteger(body.limit, 1, 100, 40);
  const search = sanitizeSearch(body.query);

  let query = supabase
    .from("profiles")
    .select("user_id,email,display_name,auth_provider,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }

  const { data: profiles, error: profileError } = await query.returns<ProfileRow[]>();
  if (profileError) throw profileError;

  const userIds = (profiles ?? []).map((profile) => profile.user_id);
  if (userIds.length === 0) return [];

  const [overrides, subscriptions] = await Promise.all([
    fetchOverrides(supabase, userIds),
    fetchSubscriptions(supabase, userIds)
  ]);

  return (profiles ?? []).map((profile) =>
    toUserSummary(profile, overrides.get(profile.user_id), subscriptions.get(profile.user_id))
  );
}

async function getUserDetail(supabase: SupabaseClient, userId: string) {
  const [{ data: profile, error: profileError }, { data: override, error: overrideError }, { data: subscription, error: subscriptionError }, entitlement] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,email,display_name,auth_provider,created_at")
        .eq("user_id", userId)
        .maybeSingle<ProfileRow>(),
      supabase
        .from("entitlement_overrides")
        .select("user_id,plan,features,quota,expires_at,is_enabled,reason,updated_at")
        .eq("user_id", userId)
        .maybeSingle<OverrideRow>(),
      supabase
        .from("subscriptions")
        .select("user_id,plan,status,current_period_end,cancel_at_period_end,stripe_price_id,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle<SubscriptionRow>(),
      buildEntitlement(supabase, userId)
    ]);

  if (profileError) throw profileError;
  if (overrideError) throw overrideError;
  if (subscriptionError) throw subscriptionError;
  if (!profile) throw namedError("NotFound", "用户不存在。");

  const auditLogs = await fetchAuditLogs(supabase, userId);

  return {
    ...toUserSummary(profile, override ?? undefined, subscription ?? undefined),
    entitlement,
    override: override ? toOverrideSnapshot(override) : undefined,
    subscription: subscription ? toSubscriptionSnapshot(subscription) : undefined,
    auditLogs
  };
}

async function saveOverride(supabase: SupabaseClient, actor: User, draft?: AdminEntitlementOverrideDraft) {
  const normalized = normalizeDraft(draft);
  const profile = await requireProfile(supabase, normalized.userId);
  const before = await fetchOverride(supabase, normalized.userId);

  const { error: upsertError } = await supabase.from("entitlement_overrides").upsert(
    {
      user_id: normalized.userId,
      plan: normalized.plan,
      features: normalized.features,
      quota: normalized.quota,
      expires_at: normalized.expiresAt ?? null,
      is_enabled: normalized.isEnabled,
      reason: normalized.reason ?? null
    },
    { onConflict: "user_id" }
  );

  if (upsertError) throw upsertError;

  await writeAuditLog(supabase, {
    actorUserId: actor.id,
    action: "save_entitlement_override",
    targetUserId: normalized.userId,
    targetEmail: profile.email ?? actor.email,
    changes: {
      before,
      after: normalized
    }
  });

  return getUserDetail(supabase, normalized.userId);
}

async function clearOverride(supabase: SupabaseClient, actor: User, userId: string, reason?: string) {
  const profile = await requireProfile(supabase, userId);
  const before = await fetchOverride(supabase, userId);

  const { error: updateError } = await supabase
    .from("entitlement_overrides")
    .update({
      is_enabled: false,
      reason: reason?.trim() || "admin clear"
    })
    .eq("user_id", userId);

  if (updateError) throw updateError;

  await writeAuditLog(supabase, {
    actorUserId: actor.id,
    action: "clear_entitlement_override",
    targetUserId: userId,
    targetEmail: profile.email ?? actor.email,
    changes: {
      before,
      after: { isEnabled: false, reason: reason?.trim() || "admin clear" }
    }
  });

  return getUserDetail(supabase, userId);
}

async function fetchOverrides(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, OverrideRow>> {
  const { data, error: readError } = await supabase
    .from("entitlement_overrides")
    .select("user_id,plan,features,quota,expires_at,is_enabled,reason,updated_at")
    .in("user_id", userIds)
    .returns<OverrideRow[]>();

  if (readError) throw readError;
  return new Map((data ?? []).map((row) => [row.user_id, row]));
}

async function fetchOverride(supabase: SupabaseClient, userId: string): Promise<OverrideRow | null> {
  const { data, error: readError } = await supabase
    .from("entitlement_overrides")
    .select("user_id,plan,features,quota,expires_at,is_enabled,reason,updated_at")
    .eq("user_id", userId)
    .maybeSingle<OverrideRow>();

  if (readError) throw readError;
  return data ?? null;
}

async function fetchSubscriptions(supabase: SupabaseClient, userIds: string[]): Promise<Map<string, SubscriptionRow>> {
  const { data, error: readError } = await supabase
    .from("subscriptions")
    .select("user_id,plan,status,current_period_end,cancel_at_period_end,stripe_price_id,updated_at")
    .in("user_id", userIds)
    .order("updated_at", { ascending: false })
    .returns<SubscriptionRow[]>();

  if (readError) throw readError;
  const rowsByUser = new Map<string, SubscriptionRow>();
  for (const row of data ?? []) {
    if (!rowsByUser.has(row.user_id)) rowsByUser.set(row.user_id, row);
  }
  return rowsByUser;
}

async function fetchAuditLogs(supabase: SupabaseClient, userId: string) {
  const { data, error: readError } = await supabase
    .from("admin_audit_logs")
    .select("id,actor_user_id,action,target_user_id,target_email,changes,created_at")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<AuditLogRow[]>();

  if (readError) throw readError;
  return (data ?? []).map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id ?? undefined,
    action: row.action,
    targetUserId: row.target_user_id ?? undefined,
    targetEmail: row.target_email ?? undefined,
    changes: row.changes,
    createdAt: row.created_at
  }));
}

async function requireProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRow> {
  const { data, error: readError } = await supabase
    .from("profiles")
    .select("user_id,email,display_name,auth_provider,created_at")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (readError) throw readError;
  if (!data) throw namedError("NotFound", "用户不存在。");
  return data;
}

async function writeAuditLog(
  supabase: SupabaseClient,
  input: {
    actorUserId: string;
    action: string;
    targetUserId: string;
    targetEmail?: string;
    changes: Record<string, unknown>;
  }
) {
  const { error: insertError } = await supabase.from("admin_audit_logs").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_user_id: input.targetUserId,
    target_email: input.targetEmail ?? null,
    changes: input.changes
  });

  if (insertError) throw insertError;
}

function toUserSummary(profile: ProfileRow, override?: OverrideRow, subscription?: SubscriptionRow): AdminUserSummary {
  const activeOverride = override && isOverrideActive(override);
  const activeSubscription = subscription && isPaidSubscription(subscription);
  const plan = activeOverride ? override.plan : activeSubscription ? "pro" : "free";

  return {
    userId: profile.user_id,
    email: profile.email ?? undefined,
    displayName: profile.display_name ?? undefined,
    authProvider: profile.auth_provider,
    createdAt: profile.created_at,
    plan,
    overrideEnabled: Boolean(activeOverride),
    overrideExpiresAt: override?.expires_at ?? undefined,
    subscriptionStatus: subscription?.status
  };
}

function toOverrideSnapshot(row: OverrideRow) {
  return {
    plan: row.plan,
    features: pickFeatureMap(row.features),
    quota: pickQuotaMap(row.quota),
    expiresAt: row.expires_at ?? undefined,
    isEnabled: row.is_enabled,
    reason: row.reason ?? undefined,
    updatedAt: row.updated_at
  };
}

function toSubscriptionSnapshot(row: SubscriptionRow) {
  return {
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.current_period_end ?? undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    stripePriceId: row.stripe_price_id ?? undefined,
    updatedAt: row.updated_at
  };
}

function normalizeDraft(draft?: AdminEntitlementOverrideDraft): AdminEntitlementOverrideDraft {
  if (!draft) throw namedError("BadRequest", "缺少权限设置。");
  const userId = requireUuid(draft.userId);
  const plan = draft.plan === "pro" ? "pro" : "free";
  const expiresAt = normalizeExpiresAt(draft.expiresAt);

  return {
    userId,
    plan,
    features: pickFeatureMap(draft.features),
    quota: pickQuotaMap(draft.quota),
    expiresAt,
    isEnabled: Boolean(draft.isEnabled),
    reason: typeof draft.reason === "string" ? draft.reason.trim().slice(0, 500) : undefined
  };
}

function pickFeatureMap(value: Record<string, unknown> | null | undefined): Partial<Record<FeatureKey, boolean>> {
  const result: Partial<Record<FeatureKey, boolean>> = {};
  if (!value) return result;
  for (const key of FEATURE_KEYS) {
    if (typeof value[key] === "boolean") result[key] = value[key] as boolean;
  }
  return result;
}

function pickQuotaMap(value: Record<string, unknown> | null | undefined): Partial<Record<UsageFeature, number>> {
  const result: Partial<Record<UsageFeature, number>> = {};
  if (!value) return result;
  for (const key of USAGE_KEYS) {
    const raw = value[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      result[key] = Math.min(1000000, Math.max(0, Math.round(raw)));
    }
  }
  return result;
}

function isOverrideActive(row: OverrideRow): boolean {
  return row.is_enabled && (!row.expires_at || new Date(row.expires_at) > new Date());
}

function isPaidSubscription(row: SubscriptionRow): boolean {
  return PAID_STATUSES.has(row.status) && (!row.current_period_end || new Date(row.current_period_end) > new Date());
}

function sanitizeSearch(value?: string): string {
  return (value ?? "")
    .trim()
    .replace(/[%_,()]/g, "")
    .slice(0, 80);
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function requireUuid(value?: string): string {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw namedError("BadRequest", "用户 ID 无效。");
  }
  return value;
}

function normalizeExpiresAt(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw namedError("BadRequest", "到期时间无效。");
  return date.toISOString();
}

function namedError(name: string, message: string): Error {
  const err = new Error(message);
  err.name = name;
  return err;
}
