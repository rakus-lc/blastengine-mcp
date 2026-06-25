import { vi } from "vitest";
import { BlastengineClient, type FetchLike } from "../src/blastengine-client.js";
import type { Config } from "../src/config.js";
import type { OperationContext } from "../src/operations.js";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    baseUrl: "https://app.engn.jp/api/v1",
    bearerToken: "test-token",
    loginId: undefined,
    apiKey: undefined,
    acceptLanguage: "ja-JP",
    timeoutMs: 30_000,
    enableSend: false,
    enableBulk: false,
    enableCsvImport: false,
    bulkMaxRecipients: 50,
    logLevel: "silent",
    clientHeaders: true,
    ...overrides
  };
}

export function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
}

export type MockFetch = FetchLike & ReturnType<typeof vi.fn>;

export function mockFetch(response: Response = jsonResponse({ ok: true })): MockFetch {
  const mock = vi.fn(async () => response);
  return mock as unknown as MockFetch;
}

export function operationContext(
  configOverrides: Partial<Config> = {},
  fetchImpl: FetchLike = mockFetch()
): OperationContext {
  const config = testConfig(configOverrides);
  return {
    config,
    client: new BlastengineClient(config, fetchImpl)
  };
}
