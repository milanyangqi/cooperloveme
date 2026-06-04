import type { CaptionCue, ExtensionSettings, SecretSettings, SpeechScore, TranslatedCue, VideoContext } from "../shared/types";
import { createId } from "../shared/ids";
import { localSpeechScore } from "../shared/scoring";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

async function callChatJson<T>(
  settings: ExtensionSettings,
  secrets: SecretSettings,
  messages: ChatMessage[],
  fallback: T
): Promise<{ data: T; provider: "ai" | "local" }> {
  if (!settings.ai.enabled || !secrets.aiApiKey.trim()) {
    return { data: fallback, provider: "local" };
  }

  const response = await fetch(settings.ai.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.aiApiKey}`
    },
    body: JSON.stringify({
      model: settings.ai.model,
      temperature: settings.ai.temperature,
      response_format: { type: "json_object" },
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return { data: fallback, provider: "local" };

  try {
    return { data: JSON.parse(content) as T, provider: "ai" };
  } catch {
    return { data: fallback, provider: "local" };
  }
}

export async function translateCuesWithAi(
  settings: ExtensionSettings,
  secrets: SecretSettings,
  videoContext: VideoContext,
  cues: CaptionCue[],
  targetLanguage: string
): Promise<TranslatedCue[]> {
  if (!settings.ai.enabled || !secrets.aiApiKey.trim()) {
    return translateCuesWithWeb(cues, targetLanguage);
  }

  const fallback = {
    translations: cues.map((cue) => ({
      id: cue.id,
      translatedText: targetLanguage.startsWith("zh") ? "请在设置中配置 AI，或使用 YouTube 可翻译字幕。" : cue.text
    }))
  };

  let result: { data: typeof fallback; provider: "ai" | "local" };
  try {
    result = await callChatJson<typeof fallback>(
      settings,
      secrets,
      [
        {
          role: "system",
          content:
            "You translate subtitle cues for language learners. Return compact JSON only: {\"translations\":[{\"id\":\"cue id\",\"translatedText\":\"translation\"}]}."
        },
        {
          role: "user",
          content: JSON.stringify({
            videoTitle: videoContext.title,
            targetLanguage,
            cues: cues.map((cue) => ({ id: cue.id, text: cue.text }))
          })
        }
      ],
      fallback
    );
  } catch {
    return translateCuesWithWeb(cues, targetLanguage);
  }

  const translations = new Map(result.data.translations.map((item) => [item.id, item.translatedText]));

  return cues.map((cue) => ({
    ...cue,
    targetLanguage,
    translatedText: translations.get(cue.id),
    provider: result.provider === "ai" ? "ai" : "none",
    cachedAt: new Date().toISOString()
  }));
}

async function translateCuesWithWeb(cues: CaptionCue[], targetLanguage: string): Promise<TranslatedCue[]> {
  return mapWithConcurrency(cues, 4, async (cue) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await translateCueWithWeb(cue, targetLanguage);
      } catch {
        if (attempt === 0) await delay(180);
      }
    }
    return translatedCueFallback(cue, targetLanguage);
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateCueWithWeb(cue: CaptionCue, targetLanguage: string): Promise<TranslatedCue> {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", normalizeTranslateLanguage(cue.sourceLanguage, "source"));
  url.searchParams.set("tl", normalizeTranslateLanguage(targetLanguage, "target"));
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", cue.text);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Web translation failed: ${response.status}`);

  const payload = (await response.json()) as unknown;
  const translatedText = readGoogleTranslateText(payload);
  if (!translatedText) throw new Error("Web translation returned empty text");

  return {
    ...cue,
    targetLanguage,
    translatedText,
    provider: "web",
    cachedAt: new Date().toISOString()
  };
}

function readGoogleTranslateText(payload: unknown): string | undefined {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return undefined;

  const text = payload[0]
    .map((item) => (Array.isArray(item) && typeof item[0] === "string" ? item[0] : ""))
    .join("")
    .trim();

  return text || undefined;
}

function normalizeTranslateLanguage(language: string, role: "source" | "target"): string {
  const normalized = language.toLowerCase();
  if (role === "source" && (!normalized || normalized === "auto")) return "auto";
  if (normalized.startsWith("zh-hant") || normalized === "zh-tw") return "zh-TW";
  if (normalized.startsWith("zh")) return "zh-CN";
  return normalized.split("-")[0] || (role === "source" ? "auto" : "en");
}

export async function explainSelection(
  settings: ExtensionSettings,
  secrets: SecretSettings,
  text: string,
  sentence: string | undefined,
  targetLanguage: string
): Promise<{ title: string; explanation: string; examples: string[]; provider: "ai" | "local" }> {
  const fallback = {
    title: text,
    explanation: "配置 AI 后，这里会显示词义、句子结构、自然表达和易错点。当前已保存原文，方便稍后复习。",
    examples: sentence ? [sentence] : [text]
  };

  const result = await callChatJson<typeof fallback>(
    settings,
    secrets,
    [
      {
        role: "system",
        content:
          "You are a concise bilingual language tutor. Return JSON only: {\"title\":\"...\",\"explanation\":\"...\",\"examples\":[\"...\"]}."
      },
      {
        role: "user",
        content: JSON.stringify({ text, sentence, targetLanguage })
      }
    ],
    fallback
  );

  return { ...result.data, provider: result.provider };
}

export async function scoreSpeechWithAi(
  settings: ExtensionSettings,
  secrets: SecretSettings,
  expected: string,
  transcript: string | undefined,
  recordingDurationMs: number,
  language: string
): Promise<SpeechScore> {
  const fallback = localSpeechScore(expected, transcript, recordingDurationMs);
  if (!settings.ai.enabled || !secrets.aiApiKey.trim() || !transcript) return fallback;

  const result = await callChatJson<SpeechScore>(
    settings,
    secrets,
    [
      {
        role: "system",
        content:
          "You score shadowing practice from an expected sentence and speech transcript. Return JSON with pronunciation, fluency, completeness, semanticMatch, overall numbers 0-100, transcript, feedback, improvements array."
      },
      {
        role: "user",
        content: JSON.stringify({ expected, transcript, recordingDurationMs, language })
      }
    ],
    fallback
  );

  return {
    ...fallback,
    ...result.data,
    provider: result.provider === "ai" ? "ai" : fallback.provider,
    transcript,
    overall: clampScore(result.data.overall ?? fallback.overall),
    pronunciation: clampScore(result.data.pronunciation ?? fallback.pronunciation),
    fluency: clampScore(result.data.fluency ?? fallback.fluency),
    completeness: clampScore(result.data.completeness ?? fallback.completeness),
    semanticMatch: clampScore(result.data.semanticMatch ?? fallback.semanticMatch),
    feedback: result.data.feedback || fallback.feedback,
    improvements: result.data.improvements?.length ? result.data.improvements : fallback.improvements
  };
}

export function translatedCueFallback(cue: CaptionCue, targetLanguage: string): TranslatedCue {
  return {
    ...cue,
    targetLanguage,
    provider: "none",
    translatedText: undefined,
    cachedAt: new Date().toISOString()
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createUsageId(): string {
  return createId("usage");
}
