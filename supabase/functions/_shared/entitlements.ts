import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type UserPlan = "free" | "pro";

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

export interface EntitlementSnapshot {
  userId: string;
  plan: UserPlan;
  features: Record<FeatureKey, boolean>;
  quota: Record<UsageFeature, number>;
  usageToday: Record<UsageFeature, number>;
  quotaResetAt: string;
  expiresAt?: string;
  syncEnabled: boolean;
  updatedAt: string;
}

const FREE_QUOTA: Record<UsageFeature, number> = {
  translate: 100,
  explain: 50,
  speechScore: 20,
  practiceGenerate: 30
};

const PRO_QUOTA: Record<UsageFeature, number> = {
  translate: 3000,
  explain: 1200,
  speechScore: 600,
  practiceGenerate: 600
};

const FREE_FEATURES: Record<FeatureKey, boolean> = {
  basicSubtitles: true,
  localLibrary: true,
  aiTranslation: true,
  aiExplanation: true,
  speechScoring: true,
  cloudSync: false,
  advancedExport: false,
  batchTranslation: false,
  longTermBackup: false
};

const PRO_FEATURES: Record<FeatureKey, boolean> = {
  basicSubtitles: true,
  localLibrary: true,
  aiTranslation: true,
  aiExplanation: true,
  speechScoring: true,
  cloudSync: true,
  advancedExport: true,
  batchTranslation: true,
  longTermBackup: true
};

const ZERO_USAGE: Record<UsageFeature, number> = {
  translate: 0,
  explain: 0,
  speechScore: 0,
  practiceGenerate: 0
};

const PAID_STATUSES = new Set(["active", "trialing"]);

interface SubscriptionRow {
  plan: UserPlan;
  status: string;
  current_period_end: string | null;
}

interface UsageRow {
  feature: UsageFeature;
  cost: number;
}

interface EntitlementOverrideRow {
  plan: UserPlan;
  features: Record<string, unknown> | null;
  quota: Record<string, unknown> | null;
  expires_at: string | null;
  is_enabled: boolean;
}

export async function buildEntitlement(supabase: SupabaseClient, userId: string): Promise<EntitlementSnapshot> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const [
    { data: subscription, error: subscriptionError },
    { data: override, error: overrideError },
    { data: usageRows, error: usageError }
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan,status,current_period_end")
      .eq("user_id", userId)
      .in("status", Array.from(PAID_STATUSES))
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<SubscriptionRow>(),
    supabase
      .from("entitlement_overrides")
      .select("plan,features,quota,expires_at,is_enabled")
      .eq("user_id", userId)
      .eq("is_enabled", true)
      .maybeSingle<EntitlementOverrideRow>(),
    supabase
      .from("usage_events")
      .select("feature,cost")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .eq("status", "success")
      .returns<UsageRow[]>()
  ]);

  if (subscriptionError) throw subscriptionError;
  if (overrideError) throw overrideError;
  if (usageError) throw usageError;

  const hasActiveOverride = Boolean(override) && (!override!.expires_at || new Date(override!.expires_at) > now);
  const isPaid =
    hasActiveOverride && override!.plan === "pro"
      ? true
      : Boolean(subscription) &&
        PAID_STATUSES.has(subscription!.status) &&
        (!subscription!.current_period_end || new Date(subscription!.current_period_end) > now);

  const plan: UserPlan = hasActiveOverride ? override!.plan : isPaid ? "pro" : "free";
  const usageToday = { ...ZERO_USAGE };

  for (const row of usageRows ?? []) {
    usageToday[row.feature] += row.cost;
  }

  const baseFeatures = plan === "pro" ? PRO_FEATURES : FREE_FEATURES;
  const baseQuota = plan === "pro" ? PRO_QUOTA : FREE_QUOTA;

  return {
    userId,
    plan,
    features: mergeFeatureOverrides(baseFeatures, override?.features),
    quota: mergeQuotaOverrides(baseQuota, override?.quota),
    usageToday,
    quotaResetAt: nextUtcMidnight(now),
    expiresAt: override?.expires_at ?? subscription?.current_period_end ?? undefined,
    syncEnabled: plan === "pro",
    updatedAt: now.toISOString()
  };
}

function nextUtcMidnight(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function mergeFeatureOverrides(
  base: Record<FeatureKey, boolean>,
  overrides?: Record<string, unknown> | null
): Record<FeatureKey, boolean> {
  const next = { ...base };
  if (!overrides) return next;

  for (const key of Object.keys(next) as FeatureKey[]) {
    if (typeof overrides[key] === "boolean") next[key] = overrides[key];
  }

  return next;
}

function mergeQuotaOverrides(
  base: Record<UsageFeature, number>,
  overrides?: Record<string, unknown> | null
): Record<UsageFeature, number> {
  const next = { ...base };
  if (!overrides) return next;

  for (const key of Object.keys(next) as UsageFeature[]) {
    const value = overrides[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      next[key] = Math.round(value);
    }
  }

  return next;
}
