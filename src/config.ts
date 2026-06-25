import { createHash } from "node:crypto";
import { ToolError } from "./errors.js";

export interface Config {
  baseUrl: string;
  bearerToken?: string;
  loginId?: string;
  apiKey?: string;
  acceptLanguage: "ja-JP" | "en-US";
  timeoutMs: number;
  enableSend: boolean;
  enableBulk: boolean;
  enableCsvImport: boolean;
  bulkMaxRecipients: number;
  logLevel: "silent" | "error" | "warn" | "info" | "debug";
  clientHeaders: boolean;
}

type Env = Record<string, string | undefined>;

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readInteger(value: string | undefined, defaultValue: number, name: string): number {
  if (value == null || value === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ToolError("invalid_config", `${name} must be a positive integer`);
  }
  return parsed;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function readOptionalSecret(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function loadConfig(env: Env = process.env): Config {
  const acceptLanguage = env.BLASTENGINE_ACCEPT_LANGUAGE ?? "ja-JP";
  if (acceptLanguage !== "ja-JP" && acceptLanguage !== "en-US") {
    throw new ToolError("invalid_config", "BLASTENGINE_ACCEPT_LANGUAGE must be ja-JP or en-US");
  }

  const logLevel = env.BLASTENGINE_LOG_LEVEL ?? "info";
  if (!["silent", "error", "warn", "info", "debug"].includes(logLevel)) {
    throw new ToolError("invalid_config", "BLASTENGINE_LOG_LEVEL is invalid");
  }

  return {
    baseUrl: trimTrailingSlash(env.BLASTENGINE_BASE_URL ?? "https://app.engn.jp/api/v1"),
    bearerToken: readOptionalSecret(env.BLASTENGINE_BEARER_TOKEN),
    loginId: readOptionalSecret(env.BLASTENGINE_LOGIN_ID),
    apiKey: readOptionalSecret(env.BLASTENGINE_API_KEY),
    acceptLanguage,
    timeoutMs: readInteger(env.BLASTENGINE_TIMEOUT_MS, 30_000, "BLASTENGINE_TIMEOUT_MS"),
    enableSend: readBoolean(env.BLASTENGINE_ENABLE_SEND, false),
    enableBulk: readBoolean(env.BLASTENGINE_ENABLE_BULK, false),
    enableCsvImport: readBoolean(env.BLASTENGINE_ENABLE_CSV_IMPORT, false),
    bulkMaxRecipients: readInteger(
      env.BLASTENGINE_BULK_MAX_RECIPIENTS,
      50,
      "BLASTENGINE_BULK_MAX_RECIPIENTS"
    ),
    logLevel: logLevel as Config["logLevel"],
    clientHeaders: readBoolean(env.BLASTENGINE_CLIENT_HEADERS, true)
  };
}

export function requireBearerToken(config: Config): string {
  if (config.bearerToken) {
    return config.bearerToken;
  }

  if (config.loginId && config.apiKey) {
    return generateBearerToken(config.loginId, config.apiKey);
  }

  if (config.loginId || config.apiKey) {
    throw new ToolError(
      "incomplete_credentials",
      "BLASTENGINE_LOGIN_ID and BLASTENGINE_API_KEY are both required to generate a blastengine Bearer token"
    );
  }

  throw new ToolError(
    "missing_credentials",
    "Set BLASTENGINE_LOGIN_ID and BLASTENGINE_API_KEY, or set BLASTENGINE_BEARER_TOKEN, to call blastengine API"
  );
}

export function generateBearerToken(loginId: string, apiKey: string): string {
  if (loginId === "" || apiKey === "") {
    throw new ToolError(
      "missing_credentials",
      "BLASTENGINE_LOGIN_ID and BLASTENGINE_API_KEY must not be empty"
    );
  }
  const sha256Hex = createHash("sha256").update(`${loginId}${apiKey}`, "utf8").digest("hex");
  return Buffer.from(sha256Hex.toLowerCase(), "utf8").toString("base64");
}
