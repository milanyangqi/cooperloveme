import { SUPABASE_AUTH_CALLBACK_URL, SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../shared/supabaseConfig";
import type {
  AdminAccessSnapshot,
  AdminEntitlementOverrideDraft,
  AdminUserDetail,
  AdminUserListRequest,
  AdminUserListResponse,
  EmailPasswordCredentials,
  EntitlementSnapshot,
  RemoteAuthSnapshot,
  UserProfile
} from "../shared/types";

const SESSION_KEY = "supabaseSession";
const ACCOUNT_CACHE_KEY = "supabaseAccountCache";
const REFRESH_SKEW_SECONDS = 90;

interface StoredSupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface SupabaseUser {
  id: string;
  email?: string;
  created_at: string;
  app_metadata?: {
    provider?: string;
  };
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface SupabaseAuthResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: SupabaseUser;
  msg?: string;
  error?: string;
  error_description?: string;
}

interface RemoteMeResponse {
  user: UserProfile;
  entitlement: EntitlementSnapshot;
}

type AdminFunctionRequest =
  | { action: "me" }
  | ({ action: "listUsers" } & AdminUserListRequest)
  | { action: "getUser"; userId: string }
  | { action: "saveOverride"; draft: AdminEntitlementOverrideDraft }
  | { action: "clearOverride"; userId: string; reason?: string };

export interface RemoteAccountSnapshot {
  auth: RemoteAuthSnapshot;
  user?: UserProfile;
  entitlement?: EntitlementSnapshot;
}

function storageGet<T>(key: string): Promise<T | undefined> {
  return chrome.storage.local.get(key).then((value) => value[key] as T | undefined);
}

async function saveSession(session: StoredSupabaseSession): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

async function saveAccountCache(snapshot: RemoteAccountSnapshot): Promise<void> {
  if (snapshot.auth.status !== "signed-in") return;
  await chrome.storage.local.set({ [ACCOUNT_CACHE_KEY]: snapshot });
}

async function loadAccountCache(): Promise<RemoteAccountSnapshot | undefined> {
  return storageGet<RemoteAccountSnapshot>(ACCOUNT_CACHE_KEY);
}

export async function clearSupabaseSession(): Promise<RemoteAuthSnapshot> {
  const session = await storageGet<StoredSupabaseSession>(SESSION_KEY);

  if (session?.accessToken) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(session.accessToken)
    }).catch(() => undefined);
  }

  await chrome.storage.local.remove([SESSION_KEY, ACCOUNT_CACHE_KEY]);
  return { status: "anonymous" };
}

export async function signUpWithEmail(credentials: EmailPasswordCredentials): Promise<RemoteAuthSnapshot> {
  const redirectTo = encodeURIComponent(SUPABASE_AUTH_CALLBACK_URL);
  const response = await authRequest(`/auth/v1/signup?redirect_to=${redirectTo}`, {
    method: "POST",
    body: JSON.stringify(normalizeCredentials(credentials))
  });

  if (response.access_token && response.refresh_token) {
    await saveSession(toStoredSession(response));
    return sessionSnapshot(toStoredSession(response), response.user);
  }

  return {
    status: "email-confirmation-required",
    user: response.user ? toUserProfile(response.user) : undefined
  };
}

export async function signInWithEmail(credentials: EmailPasswordCredentials): Promise<RemoteAuthSnapshot> {
  const response = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify(normalizeCredentials(credentials))
  });

  if (!response.access_token || !response.refresh_token) {
    throw new Error("Supabase did not return a session.");
  }

  const session = toStoredSession(response);
  await saveSession(session);
  const auth = sessionSnapshot(session, response.user);
  if (auth.user) {
    await saveAccountCache({ auth, user: auth.user });
  }
  return auth;
}

export async function loadRemoteAccountWithFallback(timeoutMs = 2200): Promise<RemoteAccountSnapshot> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timeoutId = globalThis.setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const result = await Promise.race([loadRemoteAccount(), timeout]);
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    if (result !== "timeout") return result;
  } catch (error) {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
    const cached = await loadAccountCache();
    if (cached?.auth.status === "signed-in") {
      return {
        ...cached,
        auth: {
          ...cached.auth,
          lastError: error instanceof Error ? error.message : "远端账号读取失败，先使用上次登录状态。"
        }
      };
    }
    return {
      auth: {
        status: "anonymous",
        lastError: error instanceof Error ? error.message : "远端账号读取失败。"
      }
    };
  }

  const cached = await loadAccountCache();
  if (cached?.auth.status === "signed-in") {
    return {
      ...cached,
      auth: {
        ...cached.auth,
        lastError: "远端账号读取较慢，先使用上次登录状态。"
      }
    };
  }

  return {
    auth: {
      status: "anonymous",
      lastError: "远端账号读取较慢，请稍后刷新。"
    }
  };
}

export async function loadRemoteAccount(): Promise<RemoteAccountSnapshot> {
  const session = await ensureFreshSession();
  if (!session) return { auth: { status: "anonymous" } };

  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      apikey: SUPABASE_PUBLISHABLE_KEY
    }
  });

  if (response.status === 401) {
    await chrome.storage.local.remove([SESSION_KEY, ACCOUNT_CACHE_KEY]);
    return {
      auth: {
        status: "anonymous",
        lastError: "登录已过期，请重新登录。"
      }
    };
  }

  if (!response.ok) {
    const detail = await readError(response);
    const cached = await loadAccountCache();
    if (cached?.auth.status === "signed-in") {
      return {
        ...cached,
        auth: {
          ...cached.auth,
          lastError: detail
        }
      };
    }
    return {
      auth: {
        status: "anonymous",
        lastError: detail
      }
    };
  }

  const data = (await response.json()) as RemoteMeResponse;
  const snapshot: RemoteAccountSnapshot = {
    auth: {
      status: "signed-in",
      user: data.user,
      accessTokenExpiresAt: new Date(session.expiresAt * 1000).toISOString()
    },
    user: data.user,
    entitlement: data.entitlement
  };
  await saveAccountCache(snapshot);
  return snapshot;
}

export async function createBillingCheckout(): Promise<{ url: string }> {
  const session = await ensureFreshSession();
  if (!session) throw new Error("请先登录账号。");

  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/billing-checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as { url: string };
}

export async function getSupabaseDataSession(): Promise<{ accessToken: string; expiresAt: number } | undefined> {
  const session = await ensureFreshSession();
  if (!session) return undefined;
  return {
    accessToken: session.accessToken,
    expiresAt: session.expiresAt
  };
}

export function getAdminAccess(): Promise<AdminAccessSnapshot> {
  return callAdmin<AdminAccessSnapshot>({ action: "me" });
}

export function listAdminUsers(payload: AdminUserListRequest): Promise<AdminUserListResponse> {
  return callAdmin<AdminUserListResponse>({
    action: "listUsers",
    query: payload.query,
    limit: payload.limit
  });
}

export function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  return callAdmin<AdminUserDetail>({ action: "getUser", userId });
}

export function saveAdminEntitlementOverride(draft: AdminEntitlementOverrideDraft): Promise<AdminUserDetail> {
  return callAdmin<AdminUserDetail>({ action: "saveOverride", draft });
}

export function clearAdminEntitlementOverride(userId: string, reason?: string): Promise<AdminUserDetail> {
  return callAdmin<AdminUserDetail>({ action: "clearOverride", userId, reason });
}

async function callAdmin<T>(payload: AdminFunctionRequest): Promise<T> {
  const session = await ensureFreshSession();
  if (!session) throw new Error("请先登录 Supabase 账号。");

  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/admin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as T;
}

async function ensureFreshSession(): Promise<StoredSupabaseSession | undefined> {
  const session = await storageGet<StoredSupabaseSession>(SESSION_KEY);
  if (!session?.accessToken || !session.refreshToken) return undefined;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (session.expiresAt - nowSeconds > REFRESH_SKEW_SECONDS) return session;

  try {
    const response = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refreshToken })
    });

    if (!response.access_token || !response.refresh_token) {
      await chrome.storage.local.remove(SESSION_KEY);
      return undefined;
    }

    const refreshed = toStoredSession(response);
    await saveSession(refreshed);
    return refreshed;
  } catch {
    return undefined;
  }
}

async function authRequest(path: string, init: RequestInit): Promise<SupabaseAuthResponse> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: authHeaders(undefined, init.headers)
  });

  const data = (await response.json().catch(() => ({}))) as SupabaseAuthResponse;
  if (!response.ok) {
    throw new Error(data.error_description ?? data.msg ?? data.error ?? `Supabase Auth failed: ${response.status}`);
  }

  return data;
}

function authHeaders(accessToken?: string, extra: HeadersInit = {}): Headers {
  const headers = new Headers(extra);
  headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

function normalizeCredentials(credentials: EmailPasswordCredentials): EmailPasswordCredentials {
  return {
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password
  };
}

function toStoredSession(response: SupabaseAuthResponse): StoredSupabaseSession {
  if (!response.access_token || !response.refresh_token) {
    throw new Error("Supabase did not return a session.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresAt: response.expires_at ?? nowSeconds + (response.expires_in ?? 3600)
  };
}

function sessionSnapshot(session: StoredSupabaseSession, user?: SupabaseUser): RemoteAuthSnapshot {
  return {
    status: "signed-in",
    user: user ? toUserProfile(user) : undefined,
    accessTokenExpiresAt: new Date(session.expiresAt * 1000).toISOString()
  };
}

function toUserProfile(user: SupabaseUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.user_metadata?.name ?? user.user_metadata?.full_name ?? user.email ?? "Supabase 用户",
    avatarUrl: user.user_metadata?.avatar_url,
    authProvider: user.app_metadata?.provider === "google" ? "google" : "email",
    createdAt: user.created_at
  };
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => undefined)) as { error?: string; message?: string } | undefined;
  return data?.error ?? data?.message ?? `Supabase request failed: ${response.status}`;
}
