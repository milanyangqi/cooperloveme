import { createAnonymousUser, createFreeEntitlement, DEFAULT_SECRETS, DEFAULT_SETTINGS } from "../shared/defaults";
import { createId, todayKey } from "../shared/ids";
import type { EntitlementSnapshot, ExtensionSettings, SecretSettings, UsageEvent, UsageFeature, UserProfile } from "../shared/types";
import { listByUser } from "./db";

const SYNC_SETTINGS_KEY = "settings";
const LOCAL_USER_KEY = "localUser";
const LOCAL_SECRETS_KEY = "secrets";

function storageGet<T>(area: chrome.storage.StorageArea, key: string): Promise<T | undefined> {
  return area.get(key).then((value) => value[key] as T | undefined);
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await storageGet<Partial<ExtensionSettings>>(chrome.storage.sync, SYNC_SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    ai: {
      ...DEFAULT_SETTINGS.ai,
      ...(stored?.ai ?? {})
    }
  };
}

export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const next: ExtensionSettings = {
    ...current,
    ...patch,
    ai: {
      ...current.ai,
      ...(patch.ai ?? {})
    },
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.sync.set({ [SYNC_SETTINGS_KEY]: next });
  return next;
}

export async function loadSecrets(): Promise<SecretSettings> {
  const stored = await storageGet<Partial<SecretSettings>>(chrome.storage.local, LOCAL_SECRETS_KEY);
  return {
    ...DEFAULT_SECRETS,
    ...stored
  };
}

export async function saveSecrets(patch: Partial<SecretSettings>): Promise<SecretSettings> {
  const current = await loadSecrets();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [LOCAL_SECRETS_KEY]: next });
  return next;
}

export async function ensureLocalUser(): Promise<UserProfile> {
  const stored = await storageGet<UserProfile>(chrome.storage.local, LOCAL_USER_KEY);
  if (stored) return stored;

  const user = createAnonymousUser(createId("local_user"));
  await chrome.storage.local.set({ [LOCAL_USER_KEY]: user });
  return user;
}

export async function currentUsageToday(userId: string): Promise<Record<UsageFeature, number>> {
  const today = todayKey();
  const events = await listByUser<UsageEvent>("usageEvents", userId);

  return events.reduce<Record<UsageFeature, number>>(
    (acc, event) => {
      if (event.status === "success" && event.createdAt.startsWith(today)) {
        acc[event.feature] += event.cost;
      }
      return acc;
    },
    { translate: 0, explain: 0, speechScore: 0, practiceGenerate: 0 }
  );
}

export async function loadEntitlement(userId: string): Promise<EntitlementSnapshot> {
  const usageToday = await currentUsageToday(userId);
  return createFreeEntitlement(userId, usageToday);
}
