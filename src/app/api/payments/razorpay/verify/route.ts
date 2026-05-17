import crypto from "crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/server/rateLimit";
import {
  getZodErrorMessage,
  verifyRazorpayPaymentSchema,
} from "@/utils/server/paymentValidation";

export async function POST(request: Request) {
  try {
    if (process.env.RAZORPAY_ENABLED !== "true") {
      return NextResponse.json({ verified: false, error: "Razorpay is disabled." }, { status: 503 });
    }

    const rateLimitResponse = checkRateLimit({
      request,
      key: "razorpay_verify",
      maxRequests: 30,
      windowMs: 60_000,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return NextResponse.json(
        { verified: false, error: "Razorpay secret missing on server." },
        { status: 500 },
      );
    }

    const rawBody = (await request.json()) as unknown;
    const parsed = verifyRazorpayPaymentSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          verified: false,
          error: getZodErrorMessage(parsed.error),
        },
        { status: 400 },
      );
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = parsed.data;

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");

    const expected = Buffer.from(expectedSignature);
    const actual = Buffer.from(razorpay_signature);

    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      return NextResponse.json(
        { verified: false, error: "Invalid payment signature." },
        { status: 400 },
      );
    }

    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json(
      { verified: false, error: "Payment verification failed." },
      { status: 500 },
    );
  }
}
