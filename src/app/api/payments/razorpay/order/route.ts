import { NextResponse } from "next/server";
import { RK_STUDIO } from "@/utils/constants";
import { checkRateLimit } from "@/utils/server/rateLimit";
import { createRazorpayOrderSchema, getZodErrorMessage } from "@/utils/server/paymentValidation";

export async function POST(request: Request) {
  try {
    if (process.env.RAZORPAY_ENABLED !== "true") {
      return NextResponse.json({ error: "Razorpay is disabled." }, { status: 503 });
    }

    const rateLimitResponse = checkRateLimit({
      request,
      key: "razorpay_order",
      maxRequests: 20,
      windowMs: 60_000,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay configuration missing on server." },
        { status: 500 },
      );
    }

    const rawBody = (await request.json()) as unknown;
    const parsed = createRazorpayOrderSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }

    const { amount, receipt } = parsed.data;

    const payload = {
      amount: Math.round(amount * 100),
      currency: RK_STUDIO.payment.currency,
      receipt: receipt ?? `rkstudio_${Date.now()}`,
      payment_capture: 1,
    };

    const authToken = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responseBody = (await response.json()) as { id?: string; error?: { description?: string } };

    if (!response.ok || !responseBody.id) {
      return NextResponse.json(
        { error: responseBody.error?.description || "Unable to create Razorpay order." },
        { status: 400 },
      );
    }

    return NextResponse.json({ orderId: responseBody.id });
  } catch {
    return NextResponse.json({ error: "Unable to create Razorpay order." }, { status: 500 });
  }
}
