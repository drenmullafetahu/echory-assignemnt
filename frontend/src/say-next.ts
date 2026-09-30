import type { StreamItem } from "./types";

export const WAITING_FOR_COUNTERPART = "Waiting for counterpart";
export const TRIGGERED_BY_COUNTERPART = "Counterpart";
export const TRIGGERED_BY_CANDIDATE = "Candidate turn recorded";

export interface SayNext {
  suggestion: string | null;
  intent: string | null;
  triggeredBy: string | null;
}

export function sayNext(items: readonly StreamItem[]): SayNext {
  let suggestion: string | null = null;
  let intent: string | null = null;
  let sawCandidate = false;

  for (const item of items) {
    const speaker = item.chunk?.speaker;
    if (speaker === "counterpart") {
      suggestion = item.analysis.mitigation_suggestion;
      intent = item.analysis.hidden_intent;
      sawCandidate = false;
      continue;
    }
    if (speaker === "candidate") sawCandidate = true;
  }

  if (suggestion !== null) {
    return { suggestion, intent, triggeredBy: TRIGGERED_BY_COUNTERPART };
  }
  if (sawCandidate) {
    return { suggestion: WAITING_FOR_COUNTERPART, intent: null, triggeredBy: TRIGGERED_BY_CANDIDATE };
  }
  return { suggestion: null, intent: null, triggeredBy: null };
}
