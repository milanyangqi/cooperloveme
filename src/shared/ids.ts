export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

export function cueId(videoId: string, startMs: number, text: string): string {
  const stableText = normalizeText(text).slice(0, 80).replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-");
  return `cue_${videoId}_${Math.round(startMs)}_${stableText}`;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function msToClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
