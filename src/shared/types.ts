export type UserPlan = "free" | "pro";

export type AuthProvider = "anonymous" | "email" | "google";

export type FeatureKey =
  | "basicSubtitles"
  | "localLibrary"
  | "aiTranslation"
  | "aiExplanation"
  | "speechScoring"
  | "cloudSync"
  | "advancedExport"
  | "batchTranslation"
  | "longTermBackup";

export type UsageFeature = "translate" | "explain" | "speechScore" | "practiceGenerate";

export type UsageStatus = "success" | "failed" | "skipped";

export type PracticeMode = "shadowing" | "dictation" | "cloze" | "quiz";

export type SyncEntity = "vocab" | "sentence" | "practiceAttempt" | "settings";

export type SyncStatus = "local-only" | "pending" | "synced" | "conflict";

export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  authProvider: AuthProvider;
  createdAt: string;
}

export type RemoteAuthStatus = "anonymous" | "signed-in" | "email-confirmation-required";

export interface RemoteAuthSnapshot {
  status: RemoteAuthStatus;
  user?: UserProfile;
  accessTokenExpiresAt?: string;
  lastError?: string;
}

export interface EmailPasswordCredentials {
  email: string;
  password: string;
}

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

export type AdminRole = "owner" | "admin" | "viewer";

export interface AdminAccessSnapshot {
  isAdmin: boolean;
  role?: AdminRole;
  canViewUsers: boolean;
  canManageEntitlements: boolean;
  canManageAdmins: boolean;
}

export interface AdminSubscriptionSnapshot {
  plan: UserPlan;
  status: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  stripePriceId?: string;
  updatedAt: string;
}

export interface AdminEntitlementOverrideSnapshot {
  plan: UserPlan;
  features: Partial<Record<FeatureKey, boolean>>;
  quota: Partial<Record<UsageFeature, number>>;
  expiresAt?: string;
  isEnabled: boolean;
  reason?: string;
  updatedAt: string;
}

export interface AdminUserSummary {
  userId: string;
  email?: string;
  displayName?: string;
  authProvider: AuthProvider;
  createdAt: string;
  plan: UserPlan;
  overrideEnabled: boolean;
  overrideExpiresAt?: string;
  subscriptionStatus?: string;
}

export interface AdminAuditLogEntry {
  id: string;
  actorUserId?: string;
  action: string;
  targetUserId?: string;
  targetEmail?: string;
  changes: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  entitlement: EntitlementSnapshot;
  override?: AdminEntitlementOverrideSnapshot;
  subscription?: AdminSubscriptionSnapshot;
  auditLogs: AdminAuditLogEntry[];
}

export interface AdminUserListRequest {
  query?: string;
  limit?: number;
}

export interface AdminUserListResponse {
  access: AdminAccessSnapshot;
  users: AdminUserSummary[];
}

export interface AdminEntitlementOverrideDraft {
  userId: string;
  plan: UserPlan;
  features: Partial<Record<FeatureKey, boolean>>;
  quota: Partial<Record<UsageFeature, number>>;
  expiresAt?: string;
  isEnabled: boolean;
  reason?: string;
}

export interface LocalUserMigration {
  id: string;
  localAnonymousUserId: string;
  targetUserId?: string;
  localRecordCount: number;
  duplicateRecordCount: number;
  status: "not-started" | "ready" | "merged" | "failed";
  conflictStrategy: "keep-local" | "keep-cloud" | "merge-newest";
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface UsageEvent {
  id: string;
  userId: string;
  feature: UsageFeature;
  cost: number;
  status: UsageStatus;
  createdAt: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface SyncRecord {
  id: string;
  userId: string;
  entity: SyncEntity;
  entityId: string;
  version: number;
  status: SyncStatus;
  updatedAt: string;
  remoteUpdatedAt?: string;
  error?: string;
}

export interface VideoContext {
  videoId: string;
  url: string;
  title: string;
  channelName?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
}

export interface CaptionTrack {
  languageCode: string;
  name: string;
  baseUrl: string;
  isTranslatable: boolean;
  kind?: string;
}

export interface CaptionCue {
  id: string;
  videoId: string;
  startMs: number;
  durationMs: number;
  text: string;
  sourceLanguage: string;
}

export interface TranslatedCue extends CaptionCue {
  translatedText?: string;
  targetLanguage: string;
  provider: "youtube" | "ai" | "web" | "none";
  cachedAt?: string;
}

export interface VocabItem {
  id: string;
  userId: string;
  text: string;
  normalizedText: string;
  language: string;
  meaning?: string;
  sourceSentence?: string;
  translatedSentence?: string;
  videoId?: string;
  cueId?: string;
  createdAt: string;
  updatedAt: string;
  mastery: 0 | 1 | 2 | 3 | 4 | 5;
  syncStatus: SyncStatus;
}

export interface SentenceNote {
  id: string;
  userId: string;
  videoId: string;
  cueId: string;
  text: string;
  translatedText?: string;
  language: string;
  startMs: number;
  durationMs: number;
  note?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface SpeechScore {
  pronunciation: number;
  fluency: number;
  completeness: number;
  semanticMatch: number;
  overall: number;
  transcript?: string;
  feedback: string;
  improvements: string[];
  provider: "ai" | "browser" | "local";
}

export interface PracticeItem {
  id: string;
  userId: string;
  videoContext?: VideoContext;
  cue: TranslatedCue;
  modes: PracticeMode[];
  source: "current-video" | "saved-library";
  createdAt: string;
}

export interface PracticeAttempt {
  id: string;
  userId: string;
  practiceItemId: string;
  cueId: string;
  mode: PracticeMode;
  answer?: string;
  expected: string;
  score: number;
  speechScore?: SpeechScore;
  durationMs: number;
  createdAt: string;
  syncStatus: SyncStatus;
}

export interface PracticeSession {
  id: string;
  userId: string;
  source: "current-video" | "saved-library";
  videoContext?: VideoContext;
  itemIds: string[];
  activeIndex: number;
  activeMode: PracticeMode;
  startedAt: string;
  completedAt?: string;
}

export interface AiSettings {
  enabled: boolean;
  endpoint: string;
  model: string;
  temperature: number;
}

export interface SecretSettings {
  aiApiKey: string;
}

export interface ExtensionSettings {
  schemaVersion: 1;
  enabled: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  showDualSubtitles: boolean;
  hideNativeCaptions: boolean;
  autoPauseInPractice: boolean;
  loopPracticeCue: boolean;
  playbackRate: number;
  saveRawRecordings: boolean;
  syncEnabled: boolean;
  ai: AiSettings;
  updatedAt: string;
}

export interface ExportBundle {
  exportedAt: string;
  user: UserProfile;
  entitlement: EntitlementSnapshot;
  settings: ExtensionSettings;
  vocabItems: VocabItem[];
  sentenceNotes: SentenceNote[];
  practiceAttempts: PracticeAttempt[];
  usageEvents: UsageEvent[];
}

export interface RuntimeRequestMap {
  GET_BOOTSTRAP: undefined;
  SIGN_UP_EMAIL: EmailPasswordCredentials;
  SIGN_IN_EMAIL: EmailPasswordCredentials;
  SIGN_OUT: undefined;
  START_BILLING_CHECKOUT: undefined;
  ADMIN_ME: undefined;
  ADMIN_LIST_USERS: AdminUserListRequest;
  ADMIN_GET_USER: { userId: string };
  ADMIN_SAVE_OVERRIDE: AdminEntitlementOverrideDraft;
  ADMIN_CLEAR_OVERRIDE: { userId: string; reason?: string };
  UPDATE_SETTINGS: Partial<ExtensionSettings>;
  UPDATE_SECRETS: Partial<SecretSettings>;
  GET_LIBRARY: undefined;
  SAVE_SENTENCE: Omit<SentenceNote, "id" | "userId" | "createdAt" | "updatedAt" | "syncStatus">;
  SAVE_VOCAB: Omit<VocabItem, "id" | "userId" | "createdAt" | "updatedAt" | "syncStatus" | "mastery" | "normalizedText">;
  SAVE_PRACTICE_ATTEMPT: Omit<PracticeAttempt, "id" | "userId" | "createdAt" | "syncStatus">;
  TRANSLATE_CUES: { videoContext: VideoContext; cues: CaptionCue[]; targetLanguage: string };
  EXPLAIN_SELECTION: { text: string; sentence?: string; targetLanguage: string };
  SCORE_SPEECH: {
    expected: string;
    transcript?: string;
    recordingDurationMs: number;
    language: string;
  };
  EXPORT_DATA: undefined;
  CLEAR_LOCAL_DATA: undefined;
  READ_PAGE_PLAYER_RESPONSE: undefined;
  FETCH_CAPTION_TEXT: { url: string };
}

export type RuntimeRequestType = keyof RuntimeRequestMap;

export type RuntimeRequest<T extends RuntimeRequestType = RuntimeRequestType> = {
  [K in RuntimeRequestType]: RuntimeRequestMap[K] extends undefined
    ? { type: K }
    : { type: K; payload: RuntimeRequestMap[K] };
}[T];

export type RuntimeResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };
