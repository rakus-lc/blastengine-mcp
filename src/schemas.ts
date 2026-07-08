import * as z from "zod/v4";

const email = z.string().email().min(6).max(254);
const optionalName = z.string().max(50).optional();
const insertCodeKey = z
  .string()
  .regex(/^(__|%%)[0-9a-zA-Z]+\1$/)
  .describe("Insert code key. Must be __abc__ or %%abc%% (ASCII letters/digits only).");
const insertCode = z
  .object({
    key: insertCodeKey,
    value: z.string()
  })
  .describe(
    "Personalization variable. The key is substituted wherever it appears verbatim in the body."
  );

const textPart = z
  .string()
  .min(1)
  .max(30 * 1024)
  .describe(
    'Plain-text email body. Insert personalization with codes in the form __key__ or %%key%% (e.g. "__name__ 様"). Each code must match an insert_code key; do not hard-code per-recipient values.'
  );
const htmlPart = z
  .string()
  .max(70 * 1024)
  .optional()
  .describe(
    "Optional HTML email body. Use the same __key__ / %%key%% insert codes as text_part. Provide standard HTML only; do not wrap content in CDATA sections or add XML/XHTML declarations."
  );
const insertCodeArray = z
  .array(insertCode)
  .max(50)
  .optional()
  .describe(
    "Up to 50 personalization variables. Define a key here for every __key__/%%key%% placeholder used in the body."
  );
const listUnsubscribe = z
  .object({
    mailto: z
      .string()
      .max(450)
      .optional()
      .describe(
        'List-Unsubscribe mailto target as a mailto: URI, e.g. "mailto:unsubscribe@example.com" (optionally "mailto:unsubscribe@example.com?subject=unsubscribe"). Include the mailto: scheme; a bare email address is not valid.'
      ),
    url: z
      .string()
      .url()
      .max(450)
      .optional()
      .describe(
        'List-Unsubscribe URL as a full http(s) URL including the scheme, e.g. "https://example.com/unsubscribe?u=123". Not a bare domain or path.'
      )
  })
  .refine((value) => value.mailto || value.url, "mailto or url is required")
  .optional();

const encode = z.enum(["UTF-8", "ISO-2022-JP"]).optional();
const id = z.number().int().positive();
const ISO_OFFSET_HINT =
  'ISO 8601 date-time with timezone offset, e.g. "2026-06-10T00:00:00+09:00" or "2026-06-10T00:00:00Z". Date-only ("2026-06-10"), relative ("last week"), or slash-separated values are not accepted.';
const isoOffsetDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/)
  .describe(ISO_OFFSET_HINT);
const searchRangeStart = isoOffsetDateTime
  .describe(
    `Search range start, inclusive. ${ISO_OFFSET_HINT} Resolve relative ranges such as "last week" to explicit start/end timestamps before calling.`
  )
  .optional();
const searchRangeEnd = isoOffsetDateTime
  .describe(`Search range end, inclusive. ${ISO_OFFSET_HINT}`)
  .optional();

export const sendTransactionShape = {
  from_email: email,
  from_name: optionalName,
  reply_to_email: email.optional(),
  reply_to_name: optionalName,
  to: email,
  cc: z.array(email).max(10).optional(),
  bcc: z.array(email).max(10).optional(),
  subject: z.string().min(1).max(256),
  text_part: textPart,
  html_part: htmlPart,
  insert_code: insertCodeArray,
  list_unsubscribe: listUnsubscribe,
  encode
};
export const sendTransactionSchema = z.object(sendTransactionShape);

export const bulkBeginShape = {
  from_email: email,
  from_name: optionalName,
  reply_to_email: email.optional(),
  reply_to_name: optionalName,
  subject: z.string().min(1).max(256),
  text_part: textPart,
  html_part: htmlPart,
  list_unsubscribe: listUnsubscribe,
  encode
};
export const bulkBeginSchema = z.object(bulkBeginShape);

export const recipientShape = {
  email,
  insert_code: insertCodeArray
};
export const recipientSchema = z.object(recipientShape);

export const bulkUpdateRecipientsShape = {
  delivery_id: id,
  from_email: email.optional(),
  from_name: optionalName,
  reply_to_email: email.optional(),
  reply_to_name: optionalName,
  subject: z.string().min(1).max(256).optional(),
  text_part: z.string().min(1).max(30 * 1024).optional(),
  html_part: z.string().max(70 * 1024).optional(),
  list_unsubscribe: listUnsubscribe,
  to: z.array(recipientSchema).min(1).optional()
};
export const bulkUpdateRecipientsSchema = z.object(bulkUpdateRecipientsShape);

export const bulkImportCsvShape = {
  delivery_id: id,
  csv_path: z.string().min(1),
  ignore_errors: z.boolean().default(false),
  immediate: z.boolean().default(false)
};
export const bulkImportCsvSchema = z.object(bulkImportCsvShape);

export const bulkImportStatusShape = {
  job_id: id
};
export const bulkImportStatusSchema = z.object(bulkImportStatusShape);

export const bulkImportErrorDownloadShape = {
  job_id: id,
  output_path: z.string().min(1)
};
export const bulkImportErrorDownloadSchema = z.object(bulkImportErrorDownloadShape);

export const bulkPreviewShape = {
  delivery_id: id,
  reservation_time: isoOffsetDateTime.optional()
};
export const bulkPreviewSchema = z.object(bulkPreviewShape);

export const bulkCommitImmediateShape = {
  delivery_id: id
};
export const bulkCommitImmediateSchema = z.object(bulkCommitImmediateShape);

export const bulkCommitScheduledShape = {
  delivery_id: id,
  reservation_time: isoOffsetDateTime
};
export const bulkCommitScheduledSchema = z.object(bulkCommitScheduledShape);

export const deliveriesListShape = {
  text_part: z.string().max(300).optional(),
  html_part: z.string().max(300).optional(),
  subject: z.string().max(30).optional(),
  from: z.string().max(254).optional(),
  list_unsubscribe_url: z.string().max(450).optional(),
  list_unsubscribe_mailto: z.string().max(450).optional(),
  status: z.array(z.string()).max(10).optional(),
  delivery_type: z.array(z.enum(["TRANSACTION", "BULK", "ALL"])).max(10).optional(),
  delivery_start: searchRangeStart,
  delivery_end: searchRangeEnd,
  size: z.number().int().min(1).max(1000).default(100),
  page: z.number().int().min(1).max(1000).default(1),
  sort: z.string().optional()
};
export const deliveriesListSchema = z.object(deliveriesListShape);

export const deliveryGetShape = {
  delivery_id: id
};
export const deliveryGetSchema = z.object(deliveryGetShape);

export const mailResultsListShape = {
  anchor: z.number().int().positive().optional(),
  count: z.number().int().min(1).max(1000).default(100),
  email: z.string().max(254).optional(),
  delivery_type: z.array(z.enum(["TRANSACTION", "BULK", "SMTP"])).max(10).optional(),
  delivery_id: id.optional(),
  status: z.array(z.enum(["SENT", "RETRY", "HARDERROR", "SOFTERROR", "DROP", "ALL"])).max(10).optional(),
  response_code: z.array(z.string()).max(30).optional(),
  delivery_start: searchRangeStart,
  delivery_end: searchRangeEnd
};
export const mailResultsListSchema = z.object(mailResultsListShape);

export const mailLogGetShape = {
  maillog_id: id
};
export const mailLogGetSchema = z.object(mailLogGetShape);

export const usageMonthShape = {
  month: z.string().regex(/^\d{6}$/)
};
export const usageMonthSchema = z.object(usageMonthShape);

export type SendTransactionInput = z.infer<typeof sendTransactionSchema>;
export type BulkBeginInput = z.infer<typeof bulkBeginSchema>;
export type BulkUpdateRecipientsInput = z.infer<typeof bulkUpdateRecipientsSchema>;
export type BulkImportCsvInput = z.infer<typeof bulkImportCsvSchema>;
export type BulkImportStatusInput = z.infer<typeof bulkImportStatusSchema>;
export type BulkImportErrorDownloadInput = z.infer<typeof bulkImportErrorDownloadSchema>;
export type BulkPreviewInput = z.infer<typeof bulkPreviewSchema>;
export type BulkCommitImmediateInput = z.infer<typeof bulkCommitImmediateSchema>;
export type BulkCommitScheduledInput = z.infer<typeof bulkCommitScheduledSchema>;
export type DeliveriesListInput = z.infer<typeof deliveriesListSchema>;
export type DeliveryGetInput = z.infer<typeof deliveryGetSchema>;
export type MailResultsListInput = z.infer<typeof mailResultsListSchema>;
export type MailLogGetInput = z.infer<typeof mailLogGetSchema>;
export type UsageMonthInput = z.infer<typeof usageMonthSchema>;
