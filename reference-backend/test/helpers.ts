import type { ChunkRequest, ClassifyFn } from "../src/types";

export function sampleChunk(overrides: Partial<ChunkRequest> = {}): ChunkRequest {
  const acoustic = {
    pitch_volatility: 0.82,
    speech_rate_wpm: 187,
    pause_duration_ms: 340,
    volume_intensity: 0.61,
    ...overrides.acoustic_metadata,
  };
  return {
    chunk_id: "chunk_001",
    session_id: "session_abc123",
    timestamp_ms: 1_700_000_000_000,
    speaker: "counterpart",
    text: "Yes, we are absolutely committed to the partnership — though naturally our legal team will need to review every single line.",
    ...overrides,
    acoustic_metadata: acoustic,
  };
}

export function classifying(impl: ClassifyFn): { fn: ClassifyFn; calls: () => number } {
  let count = 0;
  return {
    calls: () => count,
    fn: async (context, signal) => {
      count += 1;
      return impl(context, signal);
    },
  };
}
