import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/payments/razorpay/verify/route";

const originalSecret = process.env.RAZORPAY_KEY_SECRET;
const originalEnabled = process.env.RAZORPAY_ENABLED;

afterEach(() => {
  process.env.RAZORPAY_KEY_SECRET = originalSecret;
  process.env.RAZORPAY_ENABLED = originalEnabled;
});

describe("POST /api/payments/razorpay/verify", () => {
  it("returns 503 when Razorpay is disabled", async () => {
    process.env.RAZORPAY_ENABLED = "false";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";

    const request = new Request("http://localhost/api/payments/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: "order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "sig",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = (await response.json()) as { verified: boolean; error: string };

    expect(response.status).toBe(503);
    expect(payload.verified).toBe(false);
    expect(payload.error).toBe("Razorpay is disabled.");
  });

  it("returns 400 for missing verification fields", async () => {
    process.env.RAZORPAY_ENABLED = "true";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";

    const request = new Request("http://localhost/api/payments/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({ razorpay_order_id: "", razorpay_payment_id: "", razorpay_signature: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = (await response.json()) as { verified: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.verified).toBe(false);
    expect(payload.error).toContain("Missing razorpay_order_id");
  });

  it("returns 400 for invalid signature", async () => {
    process.env.RAZORPAY_ENABLED = "true";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";

    const request = new Request("http://localhost/api/payments/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: "order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "invalid_signature",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = (await response.json()) as { verified: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.verified).toBe(false);
    expect(payload.error).toBe("Invalid payment signature.");
  });

  it("returns verified true for valid signature", async () => {
    process.env.RAZORPAY_ENABLED = "true";
    process.env.RAZORPAY_KEY_SECRET = "test_secret";

    const razorpay_order_id = "order_123";
    const razorpay_payment_id = "pay_123";
    const razorpay_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const request = new Request("http://localhost/api/payments/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      }),
      headers: { "Content-Type": "application/json" },
    });

    const response = await POST(request);
    const payload = (await response.json()) as { verified: boolean };

    expect(response.status).toBe(200);
    expect(payload.verified).toBe(true);
  });
});
