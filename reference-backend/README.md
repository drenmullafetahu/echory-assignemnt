# Track A server

This folder is the running backend for the Track A submission. Start it from the repository root with `npm start` (see the root `README.md`). The sections below are the original Track C scaffold note.

# Track C — Reference Backend

This backend handles the `POST /api/telemetry/stream` API contract so you can focus entirely on building the frontend dashboard.

## Quick Start

```bash
npm install
npm start
# → Running on http://localhost:3000
```

## What It Does

The reference backend accepts sentiment analysis requests and returns rule-based classifications. It is **intentionally simple** — the classifications are approximate and consistent enough for you to build and test a real-time dashboard against.

## Your Task (Track C)

Build an exceptional frontend dashboard that:
- Connects to this backend (or your own improved version)
- Displays live sentiment results as they arrive
- Implements the Traffic Light system, Sentiment Stream, Volatility Alerts, and Mitigation Panel
- Feels purpose-built for a live negotiation room

## Optional: Upgrade the Backend

The `analyzeChunk()` function in `index.js` is clearly marked with `TODO` comments. If you want to replace the rule-based logic with a real LLM call, go ahead — it will improve your Nuance Detection score. But it is not required for Track C.

## Evaluation

The hiring team will run `node EVALUATION_ENGINE.js` against your backend (this one or your own). Make sure it is running on `http://localhost:3000` before they evaluate.
