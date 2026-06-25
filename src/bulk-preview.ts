import { ToolError } from "./errors.js";
import type { DeliveryDetail } from "./types.js";

export interface BulkPreview {
  deliveryId: number;
  recipientCount: number;
  reservationTime?: string;
  subject?: string;
  from?: {
    email?: string;
    name?: string;
  };
  bodySummary: string;
}

export function createBulkPreview(
  detail: DeliveryDetail,
  reservationTime?: string
): BulkPreview {
  const recipientCount = detail.total_count;
  if (typeof recipientCount !== "number" || !Number.isInteger(recipientCount) || recipientCount < 1) {
    throw new ToolError(
      "invalid_recipient_count",
      "bulk preview requires delivery detail total_count to be a positive recipient count"
    );
  }

  return {
    deliveryId: detail.delivery_id,
    recipientCount,
    reservationTime: reservationTime ?? detail.reservation_time ?? undefined,
    subject: detail.subject,
    from: detail.from,
    bodySummary: summarizeBody(detail.text_part, detail.html_part)
  };
}

function summarizeBody(textPart?: string, htmlPart?: string): string {
  const source = textPart && textPart.trim().length > 0 ? textPart : htmlToText(htmlPart ?? "");
  const normalized = source.replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 120)}...`;
}

function htmlToText(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}
