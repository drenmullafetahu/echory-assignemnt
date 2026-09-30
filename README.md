# Echory Sentiment Intelligence Engine

**Track A — Full-Stack**

Real-time classifier for live B2B negotiation transcripts. The Express server in `reference-backend/` accepts each spoken chunk with acoustic metadata and returns sentiment, hidden intent, volatility, risk, and a line the negotiator can say next. The React dashboard shows that result as it arrives.

## Run

```bash
npm install
cp .env.example .env
# Add a free Groq or Gemini key, or point LLM_PROVIDER at Ollama.
npm start
npm run dev:frontend
```

- Backend: `http://localhost:3000`
- Dashboard: `http://localhost:5173`
- WebSocket: `ws://localhost:3000/ws/telemetry`

`npm start` serves `POST /api/telemetry/stream`, `GET /api/telemetry/session/:session_id/summary`, and `GET /health`. With no API key the server still answers, using the local heuristic, and says so in the log. Nuance scoring needs a free-tier key. See [SETUP.md](SETUP.md).

## Checks

```bash
npm test
npm run typecheck
```

## Layout

- `reference-backend/` — Express + strict TypeScript. This is the server the evaluators call.
- `frontend/` — negotiation cockpit (traffic light, sentiment stream, volatility alert, mitigation panel).
- [ARCHITECTURE.md](ARCHITECTURE.md) — provider choice, latency budget, prompt, limitations.
- [AI_COLLABORATION.md](AI_COLLABORATION.md) — how the work was done with Cursor.
- [ASSIGNMENT.md](ASSIGNMENT.md) — the original brief.

The original Track C note is still in [reference-backend/README.md](reference-backend/README.md).
