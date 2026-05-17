#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, ".env.local");

const requiredEnvKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const optionalProdWarnings = [
  "NEXT_PUBLIC_USE_MOCK_OTP",
  "NEXT_PUBLIC_MOCK_OTP",
  "NEXT_PUBLIC_ANALYTICS_DEBUG",
];

const parseEnv = (fileText) => {
  const result = {};

  for (const line of fileText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    result[key] = value;
  }

  return result;
};

const fail = (message) => {
  console.error(`❌ ${message}`);
};

const warn = (message) => {
  console.warn(`⚠️  ${message}`);
};

const pass = (message) => {
  console.log(`✅ ${message}`);
};

if (!fs.existsSync(envPath)) {
  fail(".env.local not found. Create it before deploying.");
  process.exit(1);
}

const envRaw = fs.readFileSync(envPath, "utf8");
const env = parseEnv(envRaw);

let hasBlockingErrors = false;

for (const key of requiredEnvKeys) {
  if (!env[key]) {
    fail(`Missing required env var: ${key}`);
    hasBlockingErrors = true;
  }
}

const razorpayEnabled = env.RAZORPAY_ENABLED === "true";

if (razorpayEnabled) {
  for (const key of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"]) {
    if (!env[key]) {
      fail(`Missing required env var: ${key}`);
      hasBlockingErrors = true;
    }
  }
} else {
  pass("Razorpay is disabled (RAZORPAY_ENABLED=false). Razorpay keys are not required.");
}

if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
  warn("RAZORPAY_KEY_ID is using test key. Use live key for production deployment.");
}

if (env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
  warn("NEXT_PUBLIC_RAZORPAY_KEY_ID is set. Prefer server-only RAZORPAY_KEY_ID with /api/payments/razorpay/config.");
}

if (env.NEXT_PUBLIC_USE_MOCK_OTP === "true") {
  warn("Mock OTP is enabled. Turn it off before production deployment.");
}

if (env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
  warn("Analytics debug is enabled. Turn it off for production.");
}

for (const key of optionalProdWarnings) {
  if (!env[key]) {
    pass(`${key} not set (ok unless intentionally needed).`);
  }
}

if (hasBlockingErrors) {
  console.error("\nPre-deploy security check failed.");
  process.exit(1);
}

console.log("\nPre-deploy security check completed.");
process.exit(0);
