# Senior Full-Stack Engineer — Technical Assessment

**Time Budget:** 3–4 evenings (after work) · ~12–16 hours total  
**AI Collaboration:** Required — use GitHub Copilot, Cursor, ChatGPT, Gemini, or any tool you prefer  
**Cost Constraint:** Zero spending required. Use free-tier LLM endpoints, local models (Ollama, LM Studio), or existing subscriptions only.

> **Tip on latency:** Real-time LLM classification is very achievable on free infrastructure if you pick a low-latency provider. Fast free / free-tier endpoints (e.g. Groq, Cerebras, or Google Gemini Flash) typically return short classifications in ~100–300 ms; small local models (e.g. Llama 3.x 1–3B via Ollama) can be even faster. A tight prompt, low max-tokens, caching, and concurrency all help you stay responsive.

---

## Background

You are building a core module for a **real-time AI negotiation copilot** — a discrete, multi-agent system that assists professionals during live B2B negotiations. The copilot listens, interprets emotional subtext, and delivers actionable dialogue recommendations in real time.

Your challenge: build the **Sentiment Intelligence Engine** — the analytical backbone that processes live call transcripts alongside acoustic metadata to detect not just *what* is said, but *what is meant*.

---

## Track Selection

Choose the track that best matches your background. Inform us of your choice in your submission.

| Track | Best For | Backend Focus | Frontend Focus |
|-------|----------|--------------|----------------|
| **A — Full-Stack** (Standard) | Engineers comfortable across the stack | High | High |
| **B — Backend Focus** | Engineers with strong backend/infra background | Very High | Minimal |
| **C — Frontend Focus** | Engineers with strong UI/realtime frontend background | Moderate (scaffold provided) | Very High |

> Track B and C specifics are detailed at the bottom of this document.

---

## Core Challenge (All Tracks)

Build an analytical micro-service that processes simulated live call data — streaming chunks of transcribed negotiation audio paired with acoustic/tonal metadata — and returns enriched emotional intelligence signals.

The engine must detect:
- Surface sentiment (positive / negative / neutral)
- Hidden intent markers (deflection, aggression, sarcasm, appeasement)
- Rapid emotional volatility shifts
- High-risk moments requiring mitigation

---

## Mandatory API Contract

Regardless of track, your backend **must** expose the following HTTP endpoint. This is used for automated evaluation.

### `POST /api/telemetry/stream`

**Request Payload (per chunk):**

```json
{
  "chunk_id": "chunk_001",
  "session_id": "session_abc123",
  "timestamp_ms": 1234567890000,
  "speaker": "counterpart",
  "text": "Yes, we are absolutely committed to the partnership — though naturally our legal team will need to review every single line.",
  "acoustic_metadata": {
    "pitch_volatility": 0.82,
    "speech_rate_wpm": 187,
    "pause_duration_ms": 340,
    "volume_intensity": 0.61
  }
}
```

**Field Definitions:**

| Field | Type | Description |
|-------|------|-------------|
| `chunk_id` | string | Unique identifier for this transcript chunk |
| `session_id` | string | Groups chunks belonging to the same call |
| `timestamp_ms` | number | Unix timestamp in milliseconds |
| `speaker` | `"candidate"` \| `"counterpart"` | Who is speaking |
| `text` | string | Transcribed speech for this chunk |
| `acoustic_metadata.pitch_volatility` | float 0–1 | 0 = monotone, 1 = extreme pitch variation |
| `acoustic_metadata.speech_rate_wpm` | number | Words per minute |
| `acoustic_metadata.pause_duration_ms` | number | Pause before this utterance in milliseconds |
| `acoustic_metadata.volume_intensity` | float 0–1 | Relative loudness |

**Response Payload:**

```json
{
  "chunk_id": "chunk_001",
  "processing_latency_ms": 87,
  "sentiment": "sarcastic",
  "confidence": 0.84,
  "volatility_flag": true,
  "hidden_intent": "deflection_via_legal_delay",
  "mitigation_suggestion": "Acknowledge concern, propose joint legal review session with fixed timeline",
  "risk_level": "high"
}
```

**Field Definitions:**

| Field | Type | Description |
|-------|------|-------------|
| `chunk_id` | string | Must match request chunk_id |
| `processing_latency_ms` | number | Time in ms your backend took to process (self-reported) |
| `sentiment` | enum | `positive` \| `negative` \| `neutral` \| `sarcastic` \| `aggressive` \| `deflecting` \| `appeasement` |
| `confidence` | float 0–1 | Model confidence in sentiment classification |
| `volatility_flag` | boolean | True if emotional volatility is high |
| `hidden_intent` | string | Free-text description of detected hidden intent (max 60 chars) |
| `mitigation_suggestion` | string | Actionable recommendation for the negotiator (max 120 chars) |
| `risk_level` | enum | `low` \| `medium` \| `high` \| `critical` |

**Performance Requirement:** Latency is a **scored dimension, not a hard gate.** Aim for **< 250 ms** end-to-end round-trip per chunk for full marks — realistic on a fast LLM endpoint or a small local model. Slower-but-thoughtful LLM solutions are still accepted and judged on the whole; but consistently exceeding **500 ms** counts as a failure on this dimension. Optimize (fast provider, tight prompt, caching, concurrency) rather than adding artificial delays.

> **WebSocket (optional):** You may additionally expose a WebSocket endpoint at `ws://localhost:PORT/ws/telemetry` using the same schemas for your live dashboard. This is not evaluated automatically but demonstrates real-time streaming capability.

---

## Deliverables

Submit a **GitHub repository** (or zip archive) containing:

### 1. Backend Service
- Language: **Node.js with TypeScript** (strict mode)
- Framework: Your choice (Fastify, Express, Hono, etc.)
- Must expose `POST /api/telemetry/stream`
- Must include a `package.json` with a working `npm start` or `npm run dev` command
- Must include a `.env.example` listing required environment variables (LLM API keys, model names, etc.)
- Must not require paid API access to run (document the free-tier or local model setup)

### 2. Frontend Dashboard (Track A & C)
- Framework: Your choice — React, Vue, Svelte, or any modern SPA
- Must display live analysis results as chunks are processed
- Required UI elements:
  - **Traffic Light Indicator** — green/yellow/red/critical based on `risk_level`
  - **Sentiment Stream** — scrolling timeline of classified chunks
  - **Volatility Alert** — prominent warning when `volatility_flag` is true
  - **Mitigation Panel** — displays current `mitigation_suggestion`
- Must be launchable with a single command (e.g., `npm run dev` or served as static files)

### 3. `AI_COLLABORATION.md`
Document your AI collaboration strategy:
- Which tools you used and for which tasks
- Your most effective prompting patterns
- Where AI-generated code failed you and how you corrected it
- How you validated AI suggestions

### 4. `ARCHITECTURE.md`
Document your technical decisions:
- System architecture diagram (ASCII or Mermaid)
- LLM provider choice and why (latency, cost, quality trade-offs)
- How you handle streaming and concurrency
- How you approach sarcasm and hidden intent detection (prompt design or model choice)
- Known limitations and what you would improve with more time

---

## Setup & Running Instructions

**Repository layout:** A single repository is expected. Backend and frontend may live in one project (e.g. `/backend` and `/frontend` folders, or a monorepo) — your choice — as long as the commands below work from the repo root and are documented.

Your repository must include a `SETUP.md` or clear `README` section that allows us to run your solution with:

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# (edit .env with your free-tier API key or local model URL)

# 3. Start backend
npm start

# 4. (Track A/C) Start frontend
npm run dev:frontend
```

We evaluate your backend with an automated test harness (internal to the hiring team) that streams chunks to your endpoint and measures latency and classification quality. You don't need any file from us to run your solution — just ensure your backend is reachable at `http://localhost:3000` by default (or clearly document the correct port in your README).

---

## Evaluation Criteria

Your submission is scored automatically (latency + classification accuracy) and then reviewed by a senior engineer. The hiring team holds the full scoring matrix; the table below summarizes what we weight (Track A):

| Dimension | Weight | What we look for |
|-----------|--------|------------------|
| Nuance Detection Accuracy | 30% | Catching sarcasm, deflection and sudden emotional shifts — not just surface sentiment |
| Architectural Cleanliness | 25% | Clean separation of concerns, typed contracts, sound async handling |
| Execution Latency | 25% | Responsive, real-time behaviour (see Performance Requirement above) |
| UI/UX Creativity (Track A/C) | 15% | Minimal yet actionable dashboard |
| Documentation Quality | 5% | Clear ARCHITECTURE.md and AI_COLLABORATION.md |

> Track B and Track C use different weightings (frontend waived for B; UI/UX weighted higher for C).

---

## Track B — Backend Focus Specifics

Frontend requirement is **waived**. Instead, deliver:
- A CLI or simple HTML table output from your backend (no design required)
- Extended backend requirements:
  - Implement a **session aggregation endpoint** `GET /api/telemetry/session/:session_id/summary` that returns aggregated volatility score, dominant sentiment, and top 3 risk moments for a completed session
  - Handle concurrent sessions without state bleed
  - Include at least one integration test using your framework's test runner

The evaluation engine runs the same payload test plus the session summary check.

---

## Track C — Frontend Focus Specifics

A reference backend implementation is provided for you to run locally:

**Reference Backend:** [See `reference-backend/` folder in this repository]

The reference backend exposes `POST /api/telemetry/stream` with a simplified (rule-based, no LLM) implementation. Your task:
- Build an **exceptional** real-time dashboard consuming this endpoint
- Demonstrate creative, minimal, and highly actionable UI design
- Bonus: Replace or augment the reference backend with your own LLM-enriched version

Frontend scoring weight increases to **40%** for Track C.

---

## Submission

1. Share your GitHub repository link (or zip archive) via email
2. Include a short Loom video (< 5 minutes) walking through your solution and your biggest technical decision
3. Be prepared to defend your architectural choices in the follow-up technical interview

**Good luck. Build something you are proud of.**

---

*Questions? Contact us at pascal@echoryflow.com*
