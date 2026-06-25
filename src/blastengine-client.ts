import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { Config } from "./config.js";
import { requireBearerToken } from "./config.js";
import { ToolError } from "./errors.js";
import { VERSION } from "./version.js";

export type FetchLike = typeof fetch;

export interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH";
  path: string;
  toolName: string;
  mode?: string;
  query?: Record<string, unknown>;
  body?: unknown;
}

export interface MultipartOptions {
  path: string;
  toolName: string;
  mode?: string;
  filePath: string;
  data?: Record<string, string>;
}

export interface DownloadOptions {
  path: string;
  toolName: string;
  mode?: string;
  query?: Record<string, unknown>;
}

export class BlastengineClient {
  constructor(
    private readonly config: Config,
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.toolName, options.mode);
    let body: BodyInit | undefined;

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const response = await this.fetchWithTimeout(url, {
      method: options.method,
      headers,
      body
    });

    return this.parseJsonResponse<T>(response);
  }

  async multipart<T = unknown>(options: MultipartOptions): Promise<T> {
    const url = this.buildUrl(options.path);
    const headers = this.buildHeaders(options.toolName, options.mode);
    const formData = new FormData();
    const fileBuffer = await readFile(options.filePath);
    formData.append("file", new Blob([fileBuffer], { type: "text/csv" }), basename(options.filePath));
    if (options.data) {
      formData.append(
        "data",
        new Blob([JSON.stringify(options.data)], { type: "application/json" }),
        "data.json"
      );
    }

    const response = await this.fetchWithTimeout(url, {
      method: "POST",
      headers,
      body: formData
    });

    return this.parseJsonResponse<T>(response);
  }

  async download(options: DownloadOptions): Promise<Uint8Array> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.toolName, options.mode);
    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      headers
    });

    if (!response.ok) {
      await this.throwApiError(response);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  private buildUrl(path: string, query?: Record<string, unknown>): URL {
    const url = new URL(`${this.config.baseUrl}${path}`);
    if (!query) {
      return url;
    }
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === "") {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private buildHeaders(toolName: string, mode?: string): Headers {
    const token = requireBearerToken(this.config);
    const headers = new Headers({
      Authorization: `Bearer ${token}`,
      "Accept-Language": this.config.acceptLanguage,
      "User-Agent": `blastengine-mcp/${VERSION}`
    });

    if (this.config.clientHeaders) {
      headers.set("X-Blastengine-Client", "mcp");
      headers.set("X-Blastengine-Client-Version", VERSION);
      headers.set("X-Blastengine-MCP-Tool", toolName);
      if (mode) {
        headers.set("X-Blastengine-MCP-Mode", mode);
      }
    }

    return headers;
  }

  private async fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ToolError("timeout", "blastengine API request timed out", {
          retryable: init.method === "GET"
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseJsonResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      await this.throwApiError(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    if (text.length === 0) {
      return undefined as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ToolError("invalid_api_response", "blastengine API returned non-JSON response", {
        status: response.status,
        retryable: false
      });
    }
  }

  private async throwApiError(response: Response): Promise<never> {
    const text = await response.text();
    let details: unknown;
    let message = `blastengine API error (${response.status})`;

    if (text.length > 0) {
      try {
        details = JSON.parse(text);
        message = extractApiMessage(details) ?? message;
      } catch {
        details = text.slice(0, 500);
      }
    }

    throw new ToolError("blastengine_api_error", message, {
      status: response.status,
      details,
      retryable: response.status === 429 || response.status >= 500
    });
  }
}

function extractApiMessage(details: unknown): string | undefined {
  if (!details || typeof details !== "object") {
    return undefined;
  }
  const record = details as Record<string, unknown>;
  const errorMessages = record.error_messages;
  if (errorMessages && typeof errorMessages === "object") {
    return Object.entries(errorMessages as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; ");
  }
  if (typeof record.message === "string") {
    return record.message;
  }
  return undefined;
}

