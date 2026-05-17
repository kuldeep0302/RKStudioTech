import crypto from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/server/rateLimit";
import {
  getZodErrorMessage,
  razorpayWebhookEnvelopeSchema,
} from "@/utils/server/paymentValidation";

// ──────────────────────────────────────────────────────────────────────────────
// Razorpay Webhook Handler
//
// Setup in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://yourdomain.com/api/payments/razorpay/webhook
//   Secret: same value as RAZORPAY_WEBHOOK_SECRET env var
//   Events: payment.captured, payment.failed, order.paid
//
// This route verifies the webhook signature using HMAC-SHA256, then you can
// trigger any server-side side effects (e.g. update order status in Firestore).
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (process.env.RAZORPAY_ENABLED !== "true") {
    return NextResponse.json({ error: "Razorpay is disabled." }, { status: 503 });
  }

  const rateLimitResponse = checkRateLimit({
    request,
    key: "razorpay_webhook",
    maxRequests: 120,
    windowMs: 60_000,
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  // Read the raw body as text for signature verification.
  // Do NOT parse as JSON first – that changes the byte representation.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  // ── Verify signature ────────────────────────────────────────────────────────
  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expectedSig, "hex");
  const actualBuf   = Buffer.from(signature,    "hex");

  const isValid =
    expectedBuf.length === actualBuf.length &&
    crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!isValid) {
    console.warn("[webhook] Invalid Razorpay signature – request rejected.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // ── Parse and handle events ─────────────────────────────────────────────────
  let event: Record<string, unknown>;

  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const envelope = razorpayWebhookEnvelopeSchema.safeParse(event);

  if (!envelope.success) {
    return NextResponse.json({ error: getZodErrorMessage(envelope.error) }, { status: 400 });
  }

  const eventType = envelope.data.event;

  switch (eventType) {
    case "payment.captured":
    case "order.paid": {
      // Payment succeeded.
      // TODO: update order paymentStatus to "paid" in Firestore using Admin SDK
      // if you need server-side Firestore writes without a logged-in user.
      // Example (requires firebase-admin package):
      //   const payload = event.payload as { payment: { entity: { notes: { orderId: string } } } };
      //   const orderId = payload.payment.entity.notes.orderId;
      //   await adminDb.collection("orders").doc(orderId).update({ paymentStatus: "paid" });
      console.info("[webhook] Payment captured:", eventType);
      break;
    }

    case "payment.failed": {
      // Payment failed – log for investigation.
      console.warn("[webhook] Payment failed event received.");
      break;
    }

    default:
      // Ignore unrecognised events gracefully.
      break;
  }

  // Always return 200 quickly so Razorpay doesn't retry unnecessarily.
  return NextResponse.json({ received: true });
}
