# Setup

Node.js 20 or newer. One repository, commands from the repo root. No paid API is required. The backend listens on `http://localhost:3000`.

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# (edit .env with your free-tier API key or local model URL)

# 3. Start backend
npm start

# 4. (Track A) Start frontend
npm run dev:frontend
```

`npm start` and `npm run dev:frontend` are two processes. Run them in separate terminals. The dashboard is `http://localhost:5173` and proxies `/api`, `/health`, and `/ws` to port 3000. Open it and use **Run sample call** to stream a short negotiation over `ws://localhost:3000/ws/telemetry`. With no API key the backend still answers, using the local heuristic.

## Choose a provider

Set one option in `.env`. If `LLM_PROVIDER=groq` or `gemini` and the matching key is empty, the process does not wait on the network. It classifies with the local heuristic so a missing key cannot push every chunk past 500 ms.

### Groq (default, free tier)

1. Create a key at https://console.groq.com/keys
2. Set `GROQ_API_KEY` in `.env`
3. Leave `LLM_PROVIDER=groq`

`llama-3.1-8b-instant` was removed from the Groq free tier on 16 August 2026. The startup model is `qwen/qwen3.8-27b`. The client sends `reasoning_effort: none` and `reasoning_format: hidden`. `openai/gpt-oss-20b` is still listed and uses `reasoning_effort: low`.

### Gemini Flash (free tier)

1. Create a key at https://aistudio.google.com/apikey
2. Set `GEMINI_API_KEY` and `LLM_PROVIDER=gemini`

The default model is `gemini-3.1-flash-lite` with `thinkingLevel: minimal`.

### OpenAI (billed)

1. Create a key at https://platform.openai.com/api-keys
2. Set `OPENAI_API_KEY` and `LLM_PROVIDER=openai`

The default model is `gpt-4.1-nano`. It has no reasoning step. The same instruction and turn text are sent as a system message and a user message. A `gpt-5`, `o1`, `o3`, or `o4` model name also sends `reasoning_effort: minimal`. Groq stays the default when both keys are present. An empty OpenAI key falls back to the heuristic.

### Ollama (local)

```bash
ollama pull llama3.2:3b
ollama pull llama3.2:1b
```

```
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
```

Both sizes appear in the dashboard model list when Ollama is running. `llama3.2:3b` stays the local default. `llama3.2:1b` is the smaller option. If Ollama is down, the request fails fast and the heuristic answers.

## Environment

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP and WebSocket port. Default `3000`. |
| `LLM_PROVIDER` | `groq`, `gemini`, `openai`, `ollama`, or `fallback`. |
| `LLM_TIMEOUT_MS` | Abort the provider and use the heuristic. Default `420`. |
| `LLM_MAX_TOKENS` | Completion cap. Default `160`, enough for the JSON and a short reasoning trace. |
| `CACHE_MAX` | In-memory classifications kept for repeat phrases. Default `500`. |

## What to hit

```bash
curl -s http://localhost:3000/health

curl -s http://localhost:3000/api/telemetry/stream \
  -H 'content-type: application/json' \
  -d '{"chunk_id":"chunk_001","session_id":"session_abc123","timestamp_ms":1700000000000,"speaker":"counterpart","text":"Yes, we are absolutely committed to the partnership — though naturally our legal team will need to review every single line.","acoustic_metadata":{"pitch_volatility":0.82,"speech_rate_wpm":187,"pause_duration_ms":340,"volume_intensity":0.61}}'
```

On the heuristic path that chunk returns `sentiment: sarcastic`, `hidden_intent: deflection_via_polite_stall`, `volatility_flag: true`, and `risk_level: high`, typically in a few milliseconds.
