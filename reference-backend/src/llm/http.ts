import { Agent, fetch as undiciFetch } from "undici";

const agent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 16,
  pipelining: 1,
});

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export async function providerFetch(url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}): Promise<unknown> {
  const response = await undiciFetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
    dispatcher: agent,
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new ProviderError(`Provider ${response.status}: ${raw.slice(0, 180)}`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ProviderError("Provider returned non-JSON");
  }
}
