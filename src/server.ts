import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod/v4";
import { BlastengineClient, type FetchLike } from "./blastengine-client.js";
import type { Config } from "./config.js";
import { loadConfig } from "./config.js";
import { errorToStructured } from "./errors.js";
import {
  bulkBegin,
  bulkCommitImmediate,
  bulkCommitScheduled,
  bulkImportErrorDownload,
  bulkImportRecipientsCsv,
  bulkImportStatus,
  bulkPreview,
  bulkUpdateRecipients,
  deliveriesList,
  deliveryGet,
  mailLogGet,
  mailResultsList,
  sendTransaction,
  usageLatestGet,
  usageMonthGet,
  type OperationContext
} from "./operations.js";
import {
  bulkBeginSchema,
  bulkBeginShape,
  bulkCommitImmediateSchema,
  bulkCommitImmediateShape,
  bulkCommitScheduledSchema,
  bulkCommitScheduledShape,
  bulkImportCsvSchema,
  bulkImportCsvShape,
  bulkImportErrorDownloadSchema,
  bulkImportErrorDownloadShape,
  bulkImportStatusSchema,
  bulkImportStatusShape,
  bulkPreviewSchema,
  bulkPreviewShape,
  bulkUpdateRecipientsSchema,
  bulkUpdateRecipientsShape,
  deliveriesListSchema,
  deliveriesListShape,
  deliveryGetSchema,
  deliveryGetShape,
  mailLogGetSchema,
  mailLogGetShape,
  mailResultsListSchema,
  mailResultsListShape,
  sendTransactionSchema,
  sendTransactionShape,
  usageMonthSchema,
  usageMonthShape
} from "./schemas.js";
import { VERSION } from "./version.js";

export interface ServerDependencies {
  config?: Config;
  fetchImpl?: FetchLike;
}

type Shape = Record<string, z.ZodType>;

export function createBlastengineMcpServer(deps: ServerDependencies = {}): McpServer {
  const config = deps.config ?? loadConfig();
  const client = new BlastengineClient(config, deps.fetchImpl);
  const ctx: OperationContext = {
    config,
    client
  };

  const server = new McpServer({
    name: "blastengine-mcp-server",
    version: VERSION
  });

  registerTool(
    server,
    "blastengine_send_transaction",
    "Send one transaction email through blastengine. Requires BLASTENGINE_ENABLE_SEND=true. The server never logs bearer tokens, body, or recipients.",
    { title: "トランザクションメール送信", destructiveHint: true },
    sendTransactionShape,
    sendTransactionSchema,
    (input) => sendTransaction(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_begin",
    "Create a bulk delivery draft in EDIT status. Requires BLASTENGINE_ENABLE_BULK=true.",
    { title: "一斉配信下書き作成", destructiveHint: true },
    bulkBeginShape,
    bulkBeginSchema,
    (input) => bulkBegin(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_update_recipients",
    "Update a bulk delivery draft: optionally replace recipients (to) and/or update delivery fields (from, reply_to, subject, list_unsubscribe, text_part, html_part). All fields are optional; supplying 'to' replaces existing recipients (max defaults to 50), omitting it leaves recipients unchanged.",
    { title: "一斉配信下書き更新", destructiveHint: true },
    bulkUpdateRecipientsShape,
    bulkUpdateRecipientsSchema,
    (input) => bulkUpdateRecipients(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_import_recipients_csv",
    "Import bulk recipients from a local CSV file. immediate=true can trigger delivery after import and has misdelivery risk.",
    { title: "CSV宛先インポート", destructiveHint: true },
    bulkImportCsvShape,
    bulkImportCsvSchema,
    (input) => bulkImportRecipientsCsv(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_import_status",
    "Get CSV recipient import job status and counts.",
    { title: "CSVインポート状況取得", readOnlyHint: true },
    bulkImportStatusShape,
    bulkImportStatusSchema,
    (input) => bulkImportStatus(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_import_error_download",
    "Download CSV import error zip to a local output_path. File contents are not returned in MCP output.",
    { title: "CSVインポートエラーダウンロード", readOnlyHint: false, destructiveHint: false },
    bulkImportErrorDownloadShape,
    bulkImportErrorDownloadSchema,
    (input) => bulkImportErrorDownload(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_preview",
    "Fetch bulk delivery details for human review. This is informational only and does not authorize commit. Delivery data/logs are retained by blastengine for 62 days from delivery start.",
    { title: "一斉配信プレビュー", readOnlyHint: true },
    bulkPreviewShape,
    bulkPreviewSchema,
    (input) => bulkPreview(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_commit_immediate",
    "Commit bulk delivery immediately. Requires BLASTENGINE_ENABLE_BULK=true and has misdelivery risk.",
    { title: "一斉配信即時確定", destructiveHint: true },
    bulkCommitImmediateShape,
    bulkCommitImmediateSchema,
    (input) => bulkCommitImmediate(input, ctx)
  );

  registerTool(
    server,
    "blastengine_bulk_commit_scheduled",
    "Commit bulk delivery for a reservation_time. Requires BLASTENGINE_ENABLE_BULK=true and has misdelivery risk.",
    { title: "一斉配信予約確定", destructiveHint: true },
    bulkCommitScheduledShape,
    bulkCommitScheduledSchema,
    (input) => bulkCommitScheduled(input, ctx)
  );

  registerTool(
    server,
    "blastengine_deliveries_list",
    "Search blastengine deliveries. Delivery information is retained for 62 days from delivery start.",
    { title: "配信一覧検索", readOnlyHint: true },
    deliveriesListShape,
    deliveriesListSchema,
    (input) => deliveriesList(input, ctx)
  );

  registerTool(
    server,
    "blastengine_delivery_get",
    "Get blastengine delivery details. Delivery information is retained for 62 days from delivery start.",
    { title: "配信詳細取得", readOnlyHint: true },
    deliveryGetShape,
    deliveryGetSchema,
    (input) => deliveryGet(input, ctx)
  );

  registerTool(
    server,
    "blastengine_mail_results_list",
    "List mail delivery logs. Delivery logs are retained for 62 days from delivery start.",
    { title: "メール配信ログ検索", readOnlyHint: true },
    mailResultsListShape,
    mailResultsListSchema,
    (input) => mailResultsList(input, ctx)
  );

  registerTool(
    server,
    "blastengine_mail_log_get",
    "Get a single mail delivery log. Delivery logs are retained for 62 days from delivery start.",
    { title: "メール配信ログ取得", readOnlyHint: true },
    mailLogGetShape,
    mailLogGetSchema,
    (input) => mailLogGet(input, ctx)
  );

  server.registerTool(
    "blastengine_usage_latest_get",
    {
      title: "最新使用量取得",
      description: "Get latest blastengine usage.",
      annotations: { title: "最新使用量取得", readOnlyHint: true }
    },
    async () => toToolResult(() => usageLatestGet(ctx))
  );

  registerTool(
    server,
    "blastengine_usage_month_get",
    "Get blastengine usage for a YYYYMM month.",
    { title: "月次使用量取得", readOnlyHint: true },
    usageMonthShape,
    usageMonthSchema,
    (input) => usageMonthGet(input, ctx)
  );

  return server;
}

function registerTool<T extends Shape, Output>(
  server: McpServer,
  name: string,
  description: string,
  annotations: ToolAnnotations,
  inputShape: T,
  schema: z.ZodObject<T>,
  handler: (input: z.output<z.ZodObject<T>>) => Promise<Output>
): void {
  const register = server.registerTool.bind(server) as (
    toolName: string,
    config: { title?: string; description: string; inputSchema: Shape; annotations: ToolAnnotations },
    cb: (args: unknown) => Promise<CallToolResult>
  ) => void;

  register(
    name,
    {
      title: annotations.title,
      description,
      inputSchema: inputShape,
      annotations
    },
    async (args) => toToolResult(() => handler(schema.parse(args)))
  );
}

async function toToolResult(run: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    const data = await run();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data ?? {}, null, 2)
        }
      ],
      structuredContent: toStructured(data)
    };
  } catch (error) {
    const structured = errorToStructured(error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(structured, null, 2)
        }
      ],
      structuredContent: structured
    };
  }
}

function toStructured(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return { result: data };
}
