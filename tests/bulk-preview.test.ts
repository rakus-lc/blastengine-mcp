import { describe, expect, it } from "vitest";
import { createBulkPreview } from "../src/bulk-preview.js";

describe("bulk preview", () => {
  it("creates informational preview summary without authorization token", () => {
    const preview = createBulkPreview({
      delivery_id: 123,
      subject: "subject",
      total_count: 2,
      text_part: "hello world"
    });

    expect(preview).toMatchObject({
      deliveryId: 123,
      recipientCount: 2,
      bodySummary: "hello world"
    });
    expect(preview).not.toHaveProperty("token");
  });

  it("rejects preview without a recipient count", () => {
    expect(() =>
      createBulkPreview({
        delivery_id: 123,
        text_part: "hello"
      })
    ).toThrow(/recipient count/);
  });

  it("uses API total_count as the recipient count", () => {
    const preview = createBulkPreview({
      delivery_id: 123,
      total_count: 2,
      text_part: "hello"
    });

    expect(preview.recipientCount).toBe(2);
  });
});
