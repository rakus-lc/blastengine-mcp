import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  bulkCommitImmediate,
  bulkImportErrorDownload,
  bulkImportRecipientsCsv,
  bulkPreview,
  bulkUpdateRecipients,
  deliveriesList,
  sendTransaction
} from "../src/operations.js";
import { deliveriesListSchema } from "../src/schemas.js";
import { jsonResponse, mockFetch, operationContext } from "./helpers.js";

describe("operations write gates", () => {
  it("rejects transaction send before API call when send is disabled", async () => {
    const fetchImpl = mockFetch();
    const ctx = operationContext({ enableSend: false }, fetchImpl);

    await expect(
      sendTransaction(
        {
          from_email: "sender@example.com",
          to: "to@example.com",
          subject: "subject",
          text_part: "body"
        },
        ctx
      )
    ).rejects.toThrow(/BLASTENGINE_ENABLE_SEND/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects too many bulk recipients before API call", async () => {
    const fetchImpl = mockFetch();
    const ctx = operationContext({ enableBulk: true, bulkMaxRecipients: 1 }, fetchImpl);

    await expect(
      bulkUpdateRecipients(
        {
          delivery_id: 1,
          to: [{ email: "a@example.com" }, { email: "b@example.com" }]
        },
        ctx
      )
    ).rejects.toThrow(/1 or fewer/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("updates bulk delivery fields and recipients in one request", async () => {
    const fetchImpl = mockFetch(jsonResponse({ delivery_id: 7 }));
    const ctx = operationContext({ enableBulk: true }, fetchImpl);

    const result = await bulkUpdateRecipients(
      {
        delivery_id: 7,
        from_email: "sender@example.com",
        from_name: "Sender",
        reply_to_email: "reply@example.com",
        subject: "Updated subject",
        text_part: "Hello __name__",
        list_unsubscribe: { url: "https://example.com/unsub" },
        to: [{ email: "a@example.com" }]
      },
      ctx
    );

    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/deliveries/bulk/update/7");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      from: { email: "sender@example.com", name: "Sender" },
      reply_to: { email: "reply@example.com" },
      subject: "Updated subject",
      list_unsubscribe: { url: "https://example.com/unsub" },
      text_part: "Hello __name__",
      to: [{ email: "a@example.com" }]
    });
    expect((result as { warning: string }).warning).toMatch(/replaces existing recipients|replaced/);
  });

  it("updates delivery fields without touching recipients when 'to' is omitted", async () => {
    const fetchImpl = mockFetch(jsonResponse({ delivery_id: 7 }));
    const ctx = operationContext({ enableBulk: true, bulkMaxRecipients: 1 }, fetchImpl);

    const result = await bulkUpdateRecipients(
      { delivery_id: 7, subject: "Subject only" },
      ctx
    );

    const [, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ subject: "Subject only" });
    expect(Object.keys(body)).not.toContain("to");
    expect((result as { warning: string }).warning).toMatch(/left unchanged/);
  });

  it("commits bulk immediately when bulk is enabled", async () => {
    const fetchImpl = mockFetch(jsonResponse({ delivery_id: 123 }));
    const ctx = operationContext({ enableBulk: true }, fetchImpl);

    await bulkCommitImmediate({ delivery_id: 123 }, ctx);

    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/deliveries/bulk/commit/123/immediate");
    expect(init.method).toBe("PATCH");
  });

  it("forwards list_unsubscribe filters to the deliveries search query", async () => {
    const fetchImpl = mockFetch(jsonResponse({ data: [] }));
    const ctx = operationContext({}, fetchImpl);

    await deliveriesList(
      deliveriesListSchema.parse({
        list_unsubscribe_url: "https://example.com/unsub",
        list_unsubscribe_mailto: "mailto:unsub@example.com"
      }),
      ctx
    );

    const [url] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/deliveries");
    expect(url.searchParams.get("list_unsubscribe_url")).toBe("https://example.com/unsub");
    expect(url.searchParams.get("list_unsubscribe_mailto")).toBe("mailto:unsub@example.com");
  });

  it("returns bulk preview without authorization token", async () => {
    const fetchImpl = mockFetch(
      jsonResponse({
        delivery_id: 123,
        total_count: 2,
        subject: "subject",
        text_part: "hello"
      })
    );
    const ctx = operationContext({ enableBulk: true }, fetchImpl);

    const result = await bulkPreview({ delivery_id: 123 }, ctx);

    expect(result).toMatchObject({
      delivery_id: 123,
      recipient_count: 2,
      body_summary: "hello"
    });
    expect(result).not.toHaveProperty("confirmation_token");
  });

  it("passes CSV import immediate flag through when enabled", async () => {
    const csvPath = join(tmpdir(), `blastengine-mcp-${Date.now()}.csv`);
    await writeFile(csvPath, "email\na@example.com\n", "utf8");
    const fetchImpl = mockFetch(jsonResponse({ job_id: 10 }));
    const ctx = operationContext(
      {
        enableBulk: true,
        enableCsvImport: true
      },
      fetchImpl
    );

    const result = await bulkImportRecipientsCsv(
      {
        delivery_id: 1,
        csv_path: csvPath,
        ignore_errors: false,
        immediate: true
      },
      ctx
    );

    expect(result).toMatchObject({ job_id: 10, immediate: true });
    const [, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("rejects CSV import when bulk is disabled even if CSV import is enabled", async () => {
    const csvPath = join(tmpdir(), `blastengine-mcp-${Date.now()}-bulk-disabled.csv`);
    await writeFile(csvPath, "email\na@example.com\n", "utf8");
    const fetchImpl = mockFetch(jsonResponse({ job_id: 10 }));
    const ctx = operationContext(
      {
        enableBulk: false,
        enableCsvImport: true
      },
      fetchImpl
    );

    await expect(
      bulkImportRecipientsCsv(
        {
          delivery_id: 1,
          csv_path: csvPath,
          ignore_errors: false,
          immediate: false
        },
        ctx
      )
    ).rejects.toThrow(/BLASTENGINE_ENABLE_BULK/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("saves CSV import error zip to a new .zip output path", async () => {
    const outputPath = join(tmpdir(), `blastengine-mcp-error-${Date.now()}-ok.zip`);
    const fetchImpl = mockFetch(new Response(new Uint8Array([1, 2, 3])));
    const ctx = operationContext({}, fetchImpl);

    const result = await bulkImportErrorDownload(
      {
        job_id: 10,
        output_path: outputPath
      },
      ctx
    );

    expect(result).toMatchObject({
      output_path: resolve(outputPath),
      bytes_written: 3
    });
    await expect(readFile(outputPath)).resolves.toEqual(Buffer.from([1, 2, 3]));
  });

  it("rejects CSV import error download output path traversal before API call", async () => {
    const fetchImpl = mockFetch(new Response(new Uint8Array([1])));
    const ctx = operationContext({}, fetchImpl);

    await expect(
      bulkImportErrorDownload(
        {
          job_id: 10,
          output_path: "../outside.zip"
        },
        ctx
      )
    ).rejects.toThrow(/current working directory/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects CSV import error download non-zip output before API call", async () => {
    const fetchImpl = mockFetch(new Response(new Uint8Array([1])));
    const ctx = operationContext({}, fetchImpl);

    await expect(
      bulkImportErrorDownload(
        {
          job_id: 10,
          output_path: join(tmpdir(), `blastengine-mcp-error-${Date.now()}.txt`)
        },
        ctx
      )
    ).rejects.toThrow(/\.zip/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects CSV import error download existing output before API call", async () => {
    const outputPath = join(tmpdir(), `blastengine-mcp-error-${Date.now()}-exists.zip`);
    await writeFile(outputPath, "existing", "utf8");
    const fetchImpl = mockFetch(new Response(new Uint8Array([1])));
    const ctx = operationContext({}, fetchImpl);

    await expect(
      bulkImportErrorDownload(
        {
          job_id: 10,
          output_path: outputPath
        },
        ctx
      )
    ).rejects.toThrow(/already exists/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
