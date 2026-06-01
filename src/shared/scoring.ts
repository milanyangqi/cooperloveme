import type { SpeechScore } from "./types";
import { normalizeText } from "./ids";

export function wordSimilarity(expected: string, actual: string): number {
  const expectedWords = normalizeText(expected).split(/\s+/).filter(Boolean);
  const actualWords = normalizeText(actual).split(/\s+/).filter(Boolean);
  if (expectedWords.length === 0) return 0;

  const actualSet = new Set(actualWords);
  const matches = expectedWords.filter((word) => actualSet.has(word)).length;
  const lengthPenalty = Math.min(actualWords.length, expectedWords.length) / Math.max(actualWords.length, expectedWords.length, 1);
  return Math.round((matches / expectedWords.length) * lengthPenalty * 100);
}

export function localSpeechScore(expected: string, transcript: string | undefined, recordingDurationMs: number): SpeechScore {
  const semanticMatch = transcript ? wordSimilarity(expected, transcript) : 45;
  const expectedSeconds = Math.max(1.5, expected.split(/\s+/).length * 0.45);
  const durationSeconds = recordingDurationMs / 1000;
  const durationRatio = Math.min(durationSeconds, expectedSeconds) / Math.max(durationSeconds, expectedSeconds);
  const fluency = Math.round(Math.max(30, Math.min(100, durationRatio * 100)));
  const completeness = transcript ? semanticMatch : Math.round(Math.max(35, Math.min(85, durationRatio * 90)));
  const pronunciation = transcript ? Math.round((semanticMatch + fluency) / 2) : Math.round((fluency + completeness) / 2);
  const overall = Math.round(pronunciation * 0.3 + fluency * 0.25 + completeness * 0.25 + semanticMatch * 0.2);

  return {
    pronunciation,
    fluency,
    completeness,
    semanticMatch,
    overall,
    transcript,
    provider: transcript ? "browser" : "local",
    feedback: transcript
      ? "已根据浏览器转写和目标句做本地评分。配置 AI 后可获得更细的发音建议。"
      : "已记录跟读时长。若要获得完整语音评分，请开启浏览器语音识别或配置 AI。",
    improvements: [
      "先跟着原声逐词慢读，再恢复正常速度。",
      "注意句尾收音和重读词，第二遍尽量保持完整句节奏。"
    ]
  };
}
