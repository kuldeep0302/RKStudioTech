import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/utils/server/authUtils";
import { getEnvBool } from "@/utils/env";

type CheckResult = {
  key: string;
  label: string;
  ok: boolean;
  help: string;
};

const isTruthy = (value: string | undefined): boolean => {
  return Boolean(value && value.trim().length > 0);
};

const buildChecks = () => {
  const firebaseClientChecks: CheckResult[] = [
    {
      key: "NEXT_PUBLIC_FIREBASE_API_KEY",
      label: "Firebase web app connected",
      ok: isTruthy(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
      help: "Add Firebase web API key.",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      label: "Firebase auth domain set",
      ok: isTruthy(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
      help: "Set Firebase auth domain.",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      label: "Firebase project selected",
      ok: isTruthy(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      help: "Set Firebase project ID.",
    },
    {
      key: "NEXT_PUBLIC_FIREBASE_APP_ID",
      label: "Firebase app configured",
      ok: isTruthy(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
      help: "Set Firebase app ID.",
    },
  ];

  const firebaseAdminChecks: CheckResult[] = [
    {
      key: "FIREBASE_ADMIN_EMAIL",
      label: "Server auth account linked",
      ok: isTruthy(process.env.FIREBASE_ADMIN_EMAIL),
      help: "Add server admin email.",
    },
    {
      key: "FIREBASE_ADMIN_PRIVATE_KEY",
      label: "Server auth private key available",
      ok: isTruthy(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
      help: "Add server private key.",
    },
  ];

  const razorpayEnabled = process.env.RAZORPAY_ENABLED === "true";

  const razorpayChecks: CheckResult[] = [
    {
      key: "RAZORPAY_ENABLED",
      label: razorpayEnabled ? "Online payment enabled" : "Online payment intentionally disabled",
      ok: true,
      help: "Enable Razorpay if you want live payments.",
    },
    {
      key: "RAZORPAY_KEY_ID",
      label: "Payment key configured",
      ok: razorpayEnabled ? isTruthy(process.env.RAZORPAY_KEY_ID) : true,
      help: "Add Razorpay key ID.",
    },
    {
      key: "RAZORPAY_KEY_SECRET",
      label: "Payment secret configured",
      ok: razorpayEnabled ? isTruthy(process.env.RAZORPAY_KEY_SECRET) : true,
      help: "Add Razorpay key secret.",
    },
    {
      key: "RAZORPAY_WEBHOOK_SECRET",
      label: "Payment webhook secured",
      ok: razorpayEnabled ? isTruthy(process.env.RAZORPAY_WEBHOOK_SECRET) : true,
      help: "Add Razorpay webhook secret.",
    },
  ];

  const mockOtpEnabled = getEnvBool(process.env.NEXT_PUBLIC_USE_MOCK_OTP);

  console.log("ENV CHECK:", {
    USE_MOCK_OTP: mockOtpEnabled,
    RAW: process.env.NEXT_PUBLIC_USE_MOCK_OTP,
    PROJECT: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

  const otpChecks: CheckResult[] = [
    {
      key: "NEXT_PUBLIC_USE_MOCK_OTP",
      label: mockOtpEnabled
        ? "OTP test mode active (development)"
        : "Real OTP mode active",
      ok: true,
      help: "Keep mock OTP off in production.",
    },
  ];

  return {
    firebaseClientChecks,
    firebaseAdminChecks,
    razorpayChecks,
    otpChecks,
    razorpayEnabled,
    mockOtpEnabled,
  };
};

const summarize = (checks: CheckResult[]) => {
  const failed = checks.filter((item) => !item.ok);

  if (failed.length === 0) {
    return {
      ok: true,
      message: "System looks launch-ready.",
    };
  }

  return {
    ok: false,
    message: "Some settings are missing. Complete them before launch.",
  };
};

export async function GET(request: NextRequest) {
  // Keep this endpoint open in development for easy setup checks.
  // In production, only admin should be able to access readiness state.
  if (process.env.NODE_ENV === "production") {
    const admin = await verifyAdminToken(request);

    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const {
    firebaseClientChecks,
    firebaseAdminChecks,
    razorpayChecks,
    otpChecks,
    razorpayEnabled,
    mockOtpEnabled,
  } = buildChecks();

  const allChecks = [
    ...firebaseClientChecks,
    ...firebaseAdminChecks,
    ...razorpayChecks,
    ...otpChecks,
  ];

  const summary = summarize(allChecks);

  return NextResponse.json(
    {
      success: true,
      readiness: {
        ok: summary.ok,
        message: summary.message,
        environment: process.env.NODE_ENV || "development",
        razorpayEnabled,
        mockOtpEnabled,
      },
      sections: {
        firebaseClient: firebaseClientChecks,
        firebaseAdmin: firebaseAdminChecks,
        payments: razorpayChecks,
        otpMode: otpChecks,
      },
      nextAction: summary.ok
        ? "You can proceed with deployment."
        : "Complete missing settings and run readiness check again.",
    },
    { status: 200 },
  );
}
