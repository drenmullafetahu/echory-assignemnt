import type { AcousticMetadata, ChunkRequest } from "../types";

export const DEMO_SCRIPT: ChunkRequest[] = [
  {
    chunk_id: "001",
    session_id: "pending",
    timestamp_ms: 0,
    speaker: "candidate",
    text: "Thanks. We see a partnership and are ready.",
    acoustic_metadata: meter(0.22, 132, 480, 0.38),
  },
  {
    chunk_id: "002",
    session_id: "pending",
    timestamp_ms: 0,
    speaker: "counterpart",
    text: "Glad to be here. The team is excited.",
    acoustic_metadata: meter(0.28, 140, 360, 0.42),
  },
  {
    chunk_id: "003",
    session_id: "pending",
    timestamp_ms: 0,
    speaker: "counterpart",
    text: "Oh, absolutely. Your timeline is wonderfully ambitious.",
    acoustic_metadata: meter(0.84, 198, 160, 0.66),
  },
  {
    chunk_id: "004",
    session_id: "pending",
    timestamp_ms: 0,
    speaker: "counterpart",
    text: "Yes, but legal must review every line.",
    acoustic_metadata: meter(0.82, 187, 340, 0.61),
  },
  {
    chunk_id: "005",
    session_id: "pending",
    timestamp_ms: 0,
    speaker: "counterpart",
    text: "Unacceptable. We will not be pushed.",
    acoustic_metadata: meter(0.88, 206, 90, 0.86),
  },
  {
    chunk_id: "006",
    session_id: "pending",
    timestamp_ms: 0,
    speaker: "counterpart",
    text: "Sorry. We are happy to be flexible.",
    acoustic_metadata: meter(0.3, 122, 640, 0.34),
  },
  {
    chunk_id: "007",
    session_id: "pending",
    timestamp_ms: 0,
    speaker: "candidate",
    text: "Good. Let's lock the timeline today.",
    acoustic_metadata: meter(0.24, 130, 400, 0.4),
  },
];

function meter(pitch: number, wpm: number, pause: number, volume: number): AcousticMetadata {
  return {
    pitch_volatility: pitch,
    speech_rate_wpm: wpm,
    pause_duration_ms: pause,
    volume_intensity: volume,
  };
}
