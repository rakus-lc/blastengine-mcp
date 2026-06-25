import { describe, expect, it } from "vitest";
import { generateBearerToken, loadConfig, requireBearerToken } from "../src/config.js";

describe("config", () => {
  it("loads defaults safely", () => {
    const config = loadConfig({});
    expect(config.baseUrl).toBe("https://app.engn.jp/api/v1");
    expect(config.enableSend).toBe(false);
    expect(config.enableBulk).toBe(false);
    expect(config.enableCsvImport).toBe(false);
    expect(config.bulkMaxRecipients).toBe(50);
  });

  it("parses explicit safety flags", () => {
    const config = loadConfig({
      BLASTENGINE_LOGIN_ID: "login-id",
      BLASTENGINE_API_KEY: "api-key",
      BLASTENGINE_ENABLE_SEND: "true",
      BLASTENGINE_ENABLE_BULK: "true",
      BLASTENGINE_ENABLE_CSV_IMPORT: "true",
      BLASTENGINE_CLIENT_HEADERS: "false"
    });
    expect(config.enableSend).toBe(true);
    expect(config.enableBulk).toBe(true);
    expect(config.enableCsvImport).toBe(true);
    expect(config.clientHeaders).toBe(false);
  });

  it("keeps explicit bearer token support", () => {
    const config = loadConfig({
      BLASTENGINE_BEARER_TOKEN: "token",
      BLASTENGINE_LOGIN_ID: "login-id",
      BLASTENGINE_API_KEY: "api-key"
    });
    expect(requireBearerToken(config)).toBe("token");
  });

  it("trims credential environment variables", () => {
    expect(
      requireBearerToken(
        loadConfig({
          BLASTENGINE_BEARER_TOKEN: " token\n"
        })
      )
    ).toBe("token");

    const generatedConfig = loadConfig({
      BLASTENGINE_LOGIN_ID: " login-id\n",
      BLASTENGINE_API_KEY: "\tapi-key "
    });
    expect(requireBearerToken(generatedConfig)).toBe(generateBearerToken("login-id", "api-key"));
  });

  it("generates bearer token from login ID and API key", () => {
    expect(generateBearerToken("login-id", "api-key")).toBe(
      "ZjFjZTcyZTAxNDMxNWZlZjc3MWU3NDFkZTM3MzIzNmY5OGMyODg2MjdiZTQ0NmRmZmYyZmRlZmViODA0ZWU1Mg=="
    );
  });

  it("uses generated bearer token when explicit token is not set", () => {
    const config = loadConfig({
      BLASTENGINE_LOGIN_ID: "login-id",
      BLASTENGINE_API_KEY: "api-key"
    });
    expect(requireBearerToken(config)).toBe(generateBearerToken("login-id", "api-key"));
  });

  it("throws when credentials are missing", () => {
    expect(() => requireBearerToken(loadConfig({}))).toThrow(/BLASTENGINE_LOGIN_ID/);
  });

  it("throws when generated-token credentials are incomplete", () => {
    expect(() => requireBearerToken(loadConfig({ BLASTENGINE_LOGIN_ID: "login-id" }))).toThrow(
      /BLASTENGINE_LOGIN_ID and BLASTENGINE_API_KEY/
    );
  });
});
