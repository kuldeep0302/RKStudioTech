import { NextResponse } from "next/server";
import { checkRateLimit } from "@/utils/server/rateLimit";

export async function GET(request: Request) {
  const rateLimitResponse = checkRateLimit({
    request,
    key: "razorpay_config",
    maxRequests: 60,
    windowMs: 60_000,
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const razorpayEnabled = process.env.RAZORPAY_ENABLED === "true";

  if (!razorpayEnabled) {
    return NextResponse.json({ enabled: false });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;

  if (!keyId) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({ enabled: true, keyId });
}
