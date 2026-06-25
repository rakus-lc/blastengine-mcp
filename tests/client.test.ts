import { describe, expect, it } from "vitest";
import { BlastengineClient } from "../src/blastengine-client.js";
import { generateBearerToken } from "../src/config.js";
import { jsonResponse, mockFetch, testConfig } from "./helpers.js";

describe("BlastengineClient", () => {
  it("adds auth and MCP identification headers", async () => {
    const fetchImpl = mockFetch(jsonResponse({ delivery_id: 1 }));
    const client = new BlastengineClient(testConfig(), fetchImpl);

    await client.request({
      method: "GET",
      path: "/deliveries",
      toolName: "blastengine_deliveries_list",
      query: {
        "status[]": ["EDIT", "RESERVE"]
      }
    });

    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain("status%5B%5D=EDIT");
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("Accept-Language")).toBe("ja-JP");
    expect(headers.get("User-Agent")).toMatch(/^blastengine-mcp\//);
    expect(headers.get("X-Blastengine-Client")).toBe("mcp");
    expect(headers.get("X-Blastengine-MCP-Tool")).toBe("blastengine_deliveries_list");
  });

  it("adds generated bearer token when login ID and API key are configured", async () => {
    const fetchImpl = mockFetch(jsonResponse({ delivery_id: 1 }));
    const client = new BlastengineClient(
      testConfig({
        bearerToken: undefined,
        loginId: "login-id",
        apiKey: "api-key"
      }),
      fetchImpl
    );

    await client.request({
      method: "GET",
      path: "/deliveries",
      toolName: "blastengine_deliveries_list"
    });

    const [, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe(
      `Bearer ${generateBearerToken("login-id", "api-key")}`
    );
  });

  it("formats blastengine API errors", async () => {
    const fetchImpl = mockFetch(
      jsonResponse(
        {
          error_messages: {
            subject: "is required"
          }
        },
        { status: 400 }
      )
    );
    const client = new BlastengineClient(testConfig(), fetchImpl);

    await expect(
      client.request({
        method: "GET",
        path: "/deliveries",
        toolName: "blastengine_deliveries_list"
      })
    ).rejects.toThrow(/subject: is required/);
  });
});
