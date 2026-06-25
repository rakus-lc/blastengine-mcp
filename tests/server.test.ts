import { describe, expect, it } from "vitest";
import { createBlastengineMcpServer } from "../src/server.js";
import { testConfig } from "./helpers.js";

describe("server registration", () => {
  it("creates MCP server without requiring bearer token at startup", () => {
    expect(() =>
      createBlastengineMcpServer({
        config: testConfig({ bearerToken: undefined })
      })
    ).not.toThrow();
  });
});

