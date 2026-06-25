import { stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import type { Config } from "./config.js";
import type { BlastengineClient } from "./blastengine-client.js";
import { createBulkPreview } from "./bulk-preview.js";
import { requireEnabled } from "./errors.js";
import { ToolError } from "./errors.js";
import type {
  BulkBeginInput,
  BulkCommitImmediateInput,
  BulkCommitScheduledInput,
  BulkImportCsvInput,
  BulkImportErrorDownloadInput,
  BulkImportStatusInput,
  BulkPreviewInput,
  BulkUpdateRecipientsInput,
  DeliveriesListInput,
  DeliveryGetInput,
  MailLogGetInput,
  MailResultsListInput,
  SendTransactionInput,
  UsageMonthInput
} from "./schemas.js";
import type { DeliveryDetail } from "./types.js";

export interface OperationContext {
  config: Config;
  client: BlastengineClient;
}

export async function sendTransaction(input: SendTransactionInput, ctx: OperationContext): Promise<unknown> {
  requireEnabled(
    ctx.config.enableSend,
    "send_disabled",
    "BLASTENGINE_ENABLE_SEND=true is required to send transaction mail"
  );
  return ctx.client.request({
    method: "POST",
    path: "/deliveries/transaction",
    toolName: "blastengine_send_transaction",
    body: buildDeliveryBody(input, true)
  });
}

export async function bulkBegin(input: BulkBeginInput, ctx: OperationContext): Promise<unknown> {
  requireBulkEnabled(ctx.config);
  return ctx.client.request({
    method: "POST",
    path: "/deliveries/bulk/begin",
    toolName: "blastengine_bulk_begin",
    mode: "bulk",
    body: buildDeliveryBody(input, false)
  });
}

export async function bulkUpdateRecipients(
  input: BulkUpdateRecipientsInput,
  ctx: OperationContext
): Promise<unknown> {
  requireBulkEnabled(ctx.config);
  if (input.to && input.to.length > ctx.config.bulkMaxRecipients) {
    throw new ToolError(
      "too_many_recipients",
      `bulk recipients must be ${ctx.config.bulkMaxRecipients} or fewer`
    );
  }

  const body = omitUndefined({
    from: input.from_email
      ? omitUndefined({ email: input.from_email, name: input.from_name })
      : undefined,
    reply_to: input.reply_to_email
      ? omitUndefined({ email: input.reply_to_email, name: input.reply_to_name })
      : undefined,
    subject: input.subject,
    list_unsubscribe: input.list_unsubscribe,
    text_part: input.text_part,
    html_part: input.html_part,
    to: input.to
  });

  const result = await ctx.client.request({
    method: "PUT",
    path: `/deliveries/bulk/update/${input.delivery_id}`,
    toolName: "blastengine_bulk_update_recipients",
    mode: "bulk",
    body
  });

  return {
    ...asRecord(result),
    warning: input.to
      ? "Existing bulk recipients are replaced by the supplied recipients."
      : "Delivery fields were updated; recipients were left unchanged because 'to' was omitted."
  };
}

export async function bulkImportRecipientsCsv(
  input: BulkImportCsvInput,
  ctx: OperationContext
): Promise<unknown> {
  requireBulkEnabled(ctx.config);
  requireEnabled(
    ctx.config.enableCsvImport,
    "csv_import_disabled",
    "BLASTENGINE_ENABLE_CSV_IMPORT=true is required to import recipients from CSV"
  );
  await validateLocalCsv(input.csv_path);

  const immediate = input.immediate ?? false;

  const result = await ctx.client.multipart({
    path: `/deliveries/${input.delivery_id}/emails/import`,
    toolName: "blastengine_bulk_import_recipients_csv",
    mode: immediate ? "bulk_immediate" : "bulk",
    filePath: input.csv_path,
    data: {
      ignore_errors: String(input.ignore_errors ?? false),
      immediate: String(immediate)
    }
  });

  return {
    ...asRecord(result),
    immediate,
    warning:
      immediate === true
        ? "CSV import will trigger immediate delivery after import. This has misdelivery risk."
        : "CSV import will not trigger immediate delivery."
  };
}

export async function bulkImportStatus(
  input: BulkImportStatusInput,
  ctx: OperationContext
): Promise<unknown> {
  return ctx.client.request({
    method: "GET",
    path: `/deliveries/-/emails/import/${input.job_id}`,
    toolName: "blastengine_bulk_import_status"
  });
}

export async function bulkImportErrorDownload(
  input: BulkImportErrorDownloadInput,
  ctx: OperationContext
): Promise<unknown> {
  const outputPath = await validateOutputZipPath(input.output_path);
  const data = await ctx.client.download({
    path: `/deliveries/-/emails/import/${input.job_id}/errorinfo/download`,
    toolName: "blastengine_bulk_import_error_download"
  });
  try {
    await writeFile(outputPath, data, { flag: "wx" });
  } catch (error) {
    if (getErrorCode(error) === "EEXIST") {
      throw new ToolError("invalid_output_path", "output_path already exists and will not be overwritten");
    }
    throw error;
  }
  return {
    output_path: outputPath,
    bytes_written: data.byteLength,
    note: "Error CSV zip was saved to output_path. File contents are not returned by MCP."
  };
}

export async function bulkPreview(input: BulkPreviewInput, ctx: OperationContext): Promise<unknown> {
  requireBulkEnabled(ctx.config);
  const detail = await ctx.client.request<DeliveryDetail>({
    method: "GET",
    path: `/deliveries/${input.delivery_id}`,
    toolName: "blastengine_bulk_preview",
    mode: "bulk"
  });
  const preview = createBulkPreview(detail, input.reservation_time);
  return {
    delivery_id: preview.deliveryId,
    subject: preview.subject,
    from: preview.from,
    recipient_count: preview.recipientCount,
    reservation_time: preview.reservationTime,
    body_summary: preview.bodySummary,
    note:
      "This preview is informational only. It does not authorize or block commit. Bulk commit tools execute directly when BLASTENGINE_ENABLE_BULK=true."
  };
}

export async function bulkCommitImmediate(
  input: BulkCommitImmediateInput,
  ctx: OperationContext
): Promise<unknown> {
  requireBulkEnabled(ctx.config);

  return ctx.client.request({
    method: "PATCH",
    path: `/deliveries/bulk/commit/${input.delivery_id}/immediate`,
    toolName: "blastengine_bulk_commit_immediate",
    mode: "bulk"
  });
}

export async function bulkCommitScheduled(
  input: BulkCommitScheduledInput,
  ctx: OperationContext
): Promise<unknown> {
  requireBulkEnabled(ctx.config);

  return ctx.client.request({
    method: "PATCH",
    path: `/deliveries/bulk/commit/${input.delivery_id}`,
    toolName: "blastengine_bulk_commit_scheduled",
    mode: "bulk",
    body: {
      reservation_time: input.reservation_time
    }
  });
}

export async function deliveriesList(input: DeliveriesListInput, ctx: OperationContext): Promise<unknown> {
  return ctx.client.request({
    method: "GET",
    path: "/deliveries",
    toolName: "blastengine_deliveries_list",
    query: arrayQuery(input, {
      status: "status[]",
      delivery_type: "delivery_type[]"
    })
  });
}

export async function deliveryGet(input: DeliveryGetInput, ctx: OperationContext): Promise<unknown> {
  return ctx.client.request({
    method: "GET",
    path: `/deliveries/${input.delivery_id}`,
    toolName: "blastengine_delivery_get"
  });
}

export async function mailResultsList(input: MailResultsListInput, ctx: OperationContext): Promise<unknown> {
  return ctx.client.request({
    method: "GET",
    path: "/logs/mails/results",
    toolName: "blastengine_mail_results_list",
    query: arrayQuery(input, {
      delivery_type: "delivery_type[]",
      status: "status[]",
      response_code: "response_code[]"
    })
  });
}

export async function mailLogGet(input: MailLogGetInput, ctx: OperationContext): Promise<unknown> {
  return ctx.client.request({
    method: "GET",
    path: `/logs/mails/${input.maillog_id}`,
    toolName: "blastengine_mail_log_get"
  });
}

export async function usageLatestGet(ctx: OperationContext): Promise<unknown> {
  return ctx.client.request({
    method: "GET",
    path: "/usages/latest",
    toolName: "blastengine_usage_latest_get"
  });
}

export async function usageMonthGet(input: UsageMonthInput, ctx: OperationContext): Promise<unknown> {
  return ctx.client.request({
    method: "GET",
    path: `/usages/${input.month}`,
    toolName: "blastengine_usage_month_get"
  });
}

function requireBulkEnabled(config: Config): void {
  requireEnabled(
    config.enableBulk,
    "bulk_disabled",
    "BLASTENGINE_ENABLE_BULK=true is required for bulk delivery tools"
  );
}

function buildDeliveryBody(
  input: SendTransactionInput | BulkBeginInput,
  includeTo: boolean
): Record<string, unknown> {
  return omitUndefined({
    from: omitUndefined({
      email: input.from_email,
      name: input.from_name
    }),
    reply_to: input.reply_to_email
      ? omitUndefined({
          email: input.reply_to_email,
          name: input.reply_to_name
        })
      : undefined,
    to: includeTo && "to" in input ? input.to : undefined,
    cc: includeTo && "cc" in input ? input.cc : undefined,
    bcc: includeTo && "bcc" in input ? input.bcc : undefined,
    insert_code: includeTo && "insert_code" in input ? input.insert_code : undefined,
    subject: input.subject,
    list_unsubscribe: input.list_unsubscribe,
    encode: input.encode,
    text_part: input.text_part,
    html_part: input.html_part
  });
}

function omitUndefined<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : { result: value };
}

async function validateLocalCsv(csvPath: string): Promise<void> {
  if (/^https?:\/\//i.test(csvPath)) {
    throw new ToolError("invalid_csv_path", "csv_path must be a local file path, not a URL");
  }
  if (!csvPath.toLowerCase().endsWith(".csv")) {
    throw new ToolError("invalid_csv_path", "csv_path must point to a .csv file");
  }
  let fileStat;
  try {
    fileStat = await stat(csvPath);
  } catch {
    throw new ToolError("invalid_csv_path", "csv_path does not exist or is not readable");
  }
  if (!fileStat.isFile()) {
    throw new ToolError("invalid_csv_path", "csv_path must point to a file");
  }
  if (fileStat.size <= 0) {
    throw new ToolError("invalid_csv_path", "CSV file must not be empty");
  }
  if (fileStat.size > 256 * 1024 * 1024) {
    throw new ToolError("invalid_csv_path", "CSV file must be 256MB or smaller");
  }
}

async function validateOutputZipPath(outputPath: string): Promise<string> {
  if (/^https?:\/\//i.test(outputPath)) {
    throw new ToolError("invalid_output_path", "output_path must be a local file path, not a URL");
  }
  if (outputPath.includes("\0")) {
    throw new ToolError("invalid_output_path", "output_path must not contain null bytes");
  }
  if (extname(outputPath).toLowerCase() !== ".zip") {
    throw new ToolError("invalid_output_path", "output_path must point to a .zip file");
  }

  const resolvedPath = resolve(outputPath);
  if (!isAbsolute(outputPath)) {
    const relativeToCwd = relative(process.cwd(), resolvedPath);
    if (
      relativeToCwd === ".." ||
      relativeToCwd.startsWith(`..${sep}`) ||
      isAbsolute(relativeToCwd)
    ) {
      throw new ToolError(
        "invalid_output_path",
        "relative output_path must stay within the current working directory"
      );
    }
  }

  let parentStat;
  try {
    parentStat = await stat(dirname(resolvedPath));
  } catch {
    throw new ToolError("invalid_output_path", "output_path parent directory does not exist");
  }
  if (!parentStat.isDirectory()) {
    throw new ToolError("invalid_output_path", "output_path parent must be a directory");
  }

  try {
    await stat(resolvedPath);
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return resolvedPath;
    }
    throw new ToolError("invalid_output_path", "output_path is not writable");
  }

  throw new ToolError("invalid_output_path", "output_path already exists and will not be overwritten");
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code);
  }
  return undefined;
}

function arrayQuery<T extends Record<string, unknown>>(
  input: T,
  keyMap: Record<string, string>
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const mapped = keyMap[key] ?? key;
    output[mapped] = value;
  }
  return output;
}
