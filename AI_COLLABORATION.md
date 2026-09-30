# AI collaboration

Both OpenAI GPT-6 Sol Medium and Grok were used in creating this, inside Cursor. The assignment brief was the spec. Hidden test cases were not pasted into the classifier, and the heuristic does not special-case one full sentence.

## Which tools, and for which tasks

- **OpenAI GPT-6 Sol Medium and Grok**, through the Cursor agent, for the service structure, the classifier and prompt, the React dashboard, the tests, and these docs. Output from either model was accepted only after a typecheck, a test run, a live request, or a pass in the browser.
- **Web search**, once, to check which free models still exist in September 2026. Groq's deprecation page says `llama-3.1-8b-instant` stopped serving free and developer traffic on 16 August 2026 and names `openai/gpt-oss-20b` as the replacement. Gemini's docs point at `gemini-3.1-flash-lite` for short, low-latency JSON, with thinking set to minimal.
- **The local toolchain**: `npm run typecheck`, `npm test`, `curl`, a WebSocket client, and the in-editor browser. Early smoke tests ran on the heuristic because no provider key was loaded yet. Later runs used the free Groq key. The product does not require a paid API.

## Prompting patterns that worked

The pattern that held up was a constraint, then the contract, then a correction against a measurement:

1. State the non-negotiables first: TypeScript strict, keep the existing Express server, port 3000, no paid API required, under 250 ms as the goal, and never sit past 500 ms.
2. Point at the file that already implements the contract (`reference-backend/index.js`) and say to extend it instead of adding a second server.
3. Repeat the latency and WebSocket rules on their own: the same request and response JSON on `ws://localhost:PORT/ws/telemetry`, no artificial delay, cache and concurrency for speed.
4. When a generated answer drifted, paste the failing output next to the rule it broke. The OpenAI temperature bug and the appeasement miss below were both found that way.
5. Ask for a paired measurement before keeping a latency change. The seven-turn sample is the pair: same inputs, separate sessions, quality next to tokens and HTTP time.

The classifier prompt is the same shape. One short instruction names the enums and the four acoustic mismatches (sarcasm, a polite stall, appeasement, aggression). The user message is the current turn, the bins, and the previous sentiment, not the whole call.

## Where generated code failed, and the correction

- A search-and-replace split `assertContract` in the contract test and left the file uncompilable. The test file was rewritten. The suite passes.
- The first Groq default, copied from older tutorials, was `llama-3.1-8b-instant`. That model is off the free tier. The default is now `qwen/qwen3.8-27b`. `.env.example` names it.
- A smoke script used `require` inside a Node ESM eval and died before it printed timings. The check was redone with an ESM import of `ws`.
- The mitigation panel was written to the wrong frontend file and then overwritten. It lives in `MitigationPanel.tsx`, which is what the dashboard renders.
- Sub-millisecond heuristic work rounded to `processing_latency_ms: 0`, which looks like a timer that never started. The timer now uses `Math.ceil`, so that work reports 1 ms.
- The first nuance prompt told the model to be cautious: enthusiasm was not sarcasm, and a review was not a stall. The assignment scores the opposite reading when the voice is high or fast. The live prompt was rewritten to those rules, and `ARCHITECTURE.md` was updated to quote the prompt that is actually sent.
- OpenAI `gpt-5-nano` was selected in the dashboard and every turn came back as the heuristic in about 200–300 ms. The request always sent `temperature: 0`, which that model rejects. Reasoning models now omit temperature and send `reasoning_effort: minimal`. After the fix, a direct call returned 200. The model is still about 1–1.4 s, so the 420 ms cap still falls back to the heuristic. That is slowness, not the 400 error.
- The first compact-key trial, on the cautious prompt, saved about 8 percent of completion tokens and changed the apology line from `appeasement` to `positive`. That trial was reverted. A later trial on the nuance prompt kept every sentiment and risk label and saved about 13 percent, so the short keys stayed. The public field names did not change.
- The sentiment pill rendered as a full-width bar because it was a block-level paragraph. It is now inline and only as wide as the word.
- One short-key mitigation came back at 12 words. The prompt asks for 10. The server still enforces only the 120-character cut. That miss is recorded in `ARCHITECTURE.md` rather than hidden.

## How suggestions were checked

- `npm run typecheck` on the backend and the dashboard.
- `npm test` in `reference-backend`: contract shape, character limits, session isolation, cache behavior, in-flight dedupe, the timeout fallback, the WebSocket schema, and the heuristic cases (fast stall, calm stall, sarcasm, aggression, appeasement). The dashboard has its own test for Say Next: a counterpart turn sets the line, and a later candidate turn does not replace it.
- `curl` against `http://localhost:3000/api/telemetry/stream` and a WebSocket client against `/ws/telemetry`. On the heuristic path the round trip was 2–4 ms. A forced 40 ms abort still returned well under 500 ms.
- Live Groq calls on `qwen/qwen3.8-27b`, cache off. Usage came from the original response. There was no second diagnostic call for the same chunk. The account limit is 1000 output tokens per minute, so a run waited when the rolling completion-token count neared that cap.
- The dashboard at `http://localhost:5173`. A custom turn was typed, analyzed, and checked in the browser: the transcript showed the utterance, the sentiment, and the backend time, and Live state showed the same backend time. Desktop and a 390-wide viewport both fit without horizontal scrolling.

The two key trials are below. They are the check that decided which prompt stayed.

### Compact keys on the cautious prompt

This trial was measured and not kept. The guidance was cautious: enthusiasm was not treated as sarcasm, and a review was not treated as a stall. Only the output-key lines changed. The model was asked for `s`, `c`, `v`, `i`, `m`, and `r`. The public HTTP and WebSocket bodies stayed on the full names. Both versions returned `source: groq` on all seven turns.

Saved full-key benchmark, `qwen/qwen3.8-27b`, cache off, 3000 ms timeout. Completion-token total 517.

| Chunk | HTTP | Completion tokens | Sentiment | Risk | Mitigation words |
|---|---:|---:|---|---|---:|
| 001 | 308 ms | 73 | positive | low | 6 |
| 002 | 288 ms | 71 | positive | low | 7 |
| 003 | 240 ms | 75 | sarcastic | high | 6 |
| 004 | 271 ms | 74 | deflecting | high | 8 |
| 005 | 229 ms | 71 | aggressive | critical | 5 |
| 006 | 232 ms | 79 | appeasement | medium | 8 |
| 007 | 221 ms | 74 | neutral | low | 7 |

| Turn | Full HTTP | Full tokens | Compact HTTP | Compact tokens | Sentiment |
|---|---:|---:|---:|---:|---|
| 001 | 279 ms | 73 | 203 ms | 70 | positive / positive |
| 002 | 210 ms | 71 | 196 ms | 65 | positive / positive |
| 003 | 230 ms | 75 | 448 ms | 69 | sarcastic / sarcastic |
| 004 | 402 ms | 74 | 336 ms | 68 | deflecting / deflecting |
| 005 | 291 ms | 71 | 239 ms | 65 | aggressive / aggressive |
| 006 | 245 ms | 79 | 198 ms | 70 | appeasement / positive |
| 007 | 235 ms | 74 | 478 ms | 68 | neutral / neutral |

Compact completion tokens were 475 against 517. Generation time moved from 1079 ms to 1026 ms. Prompt tokens went from 1922 to 1934. The compact mean was slower, 300 ms against 270 ms, because turns 003 and 007 picked up queue time. Risk matched on every turn. Turn 006 did not: the apology-and-flexibility line became `positive`. That is a contract sentiment on the sample's appeasement turn, so the saving was rejected.

### Short keys on the nuance prompt

The current prompt asks for `s`, `c`, `i`, `m`, `r`, and `v` and maps them back to the public fields. The same seven turns ran on `qwen/qwen3.8-27b`, cache off, 420 ms timeout. Each version had its own session. Every turn was `source: groq`. The model returned only the short keys.

| Turn | Full HTTP | Full tokens | Short HTTP | Short tokens | Sentiment | Risk |
|---|---:|---:|---:|---:|---:|---|
| 001 | 311 ms | 72 | 235 ms | 61 | positive / positive | low / low |
| 002 | 217 ms | 70 | 214 ms | 62 | positive / positive | low / low |
| 003 | 228 ms | 76 | 209 ms | 64 | sarcastic / sarcastic | high / high |
| 004 | 284 ms | 76 | 206 ms | 65 | sarcastic / sarcastic | high / high |
| 005 | 248 ms | 73 | 216 ms | 64 | aggressive / aggressive | critical / critical |
| 006 | 224 ms | 79 | 394 ms | 67 | appeasement / appeasement | medium / medium |
| 007 | 222 ms | 74 | 215 ms | 68 | neutral / neutral | low / low |

Short completion tokens were 451 against 520, about 13 percent fewer. Generation time moved from 1045 ms to 899 ms. Mean HTTP was 241 ms against 248 ms. Six of seven short calls were under 250 ms, against five of seven full-key calls. Turn 006 at 394 ms spent 108 ms in the Groq queue; generation was 132 ms.

Sentiment and risk matched on every turn, including appeasement. Turn 004 still names the stall as `legal_review_stall`. Turn 007's mitigation is 12 words. The other six stay inside the 10-word cap. The short keys stayed. The public response names are unchanged.
