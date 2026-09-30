export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function roundConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.round(clamp(value, 0, 1) * 100) / 100;
}

export function truncate(value: string, max: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const sliced = trimmed.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > max * 0.6) return sliced.slice(0, lastSpace);
  return sliced;
}

export function toIntent(value: string): string {
  const snake = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return truncate(snake.length > 0 ? snake : "unspecified_intent", 60);
}

export function countWords(text: string, words: readonly string[]): number {
  const haystack = text.toLowerCase();
  let hits = 0;
  for (const word of words) {
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(haystack)) hits += 1;
  }
  return hits;
}

export function hasPhrase(text: string, phrases: readonly string[]): boolean {
  const haystack = text.toLowerCase();
  return phrases.some((phrase) => haystack.includes(phrase));
}
