import type { EntitlementSnapshot, ExtensionSettings, FeatureKey, SecretSettings, UsageFeature, UserProfile } from "./types";

export const EXTENSION_NAME = "YouTube Language Lab";

export const FREE_QUOTA: Record<UsageFeature, number> = {
  translate: 100,
  explain: 50,
  speechScore: 20,
  practiceGenerate: 30
};

export const PRO_QUOTA: Record<UsageFeature, number> = {
  translate: 3000,
  explain: 1200,
  speechScore: 600,
  practiceGenerate: 600
};

export const FREE_FEATURES: Record<FeatureKey, boolean> = {
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

export const PRO_FEATURES: Record<FeatureKey, boolean> = {
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

export const DEFAULT_SETTINGS: ExtensionSettings = {
  schemaVersion: 1,
  enabled: true,
  sourceLanguage: "en",
  targetLanguage: "zh-Hans",
  showDualSubtitles: true,
  hideNativeCaptions: true,
  autoPauseInPractice: true,
  loopPracticeCue: true,
  playbackRate: 1,
  saveRawRecordings: false,
  syncEnabled: false,
  ai: {
    enabled: false,
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
    temperature: 0.2
  },
  updatedAt: new Date(0).toISOString()
};

export const DEFAULT_SECRETS: SecretSettings = {
  aiApiKey: ""
};

export function createAnonymousUser(id: string): UserProfile {
  return {
    id,
    authProvider: "anonymous",
    displayName: "本地匿名用户",
    createdAt: new Date().toISOString()
  };
}

export function createFreeEntitlement(userId: string, usageToday: Record<UsageFeature, number>): EntitlementSnapshot {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);

  return {
    userId,
    plan: "free",
    features: FREE_FEATURES,
    quota: FREE_QUOTA,
    usageToday,
    quotaResetAt: tomorrow.toISOString(),
    syncEnabled: false,
    updatedAt: new Date().toISOString()
  };
}
