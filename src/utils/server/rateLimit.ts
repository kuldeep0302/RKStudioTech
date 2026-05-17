import { NextResponse } from "next/server";

// Simple in-memory rate limiter.
// Works well on a single runtime instance and provides a useful baseline.
// For multi-region/distributed production, move this to Redis/Upstash.
type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const now = () => Date.now();

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp || "unknown";
};

const cleanupExpiredBuckets = () => {
  const current = now();

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= current) {
      buckets.delete(key);
    }
  }
};

export const checkRateLimit = ({
  request,
  key,
  maxRequests,
  windowMs,
}: {
  request: Request;
  key: string;
  maxRequests: number;
  windowMs: number;
}) => {
  cleanupExpiredBuckets();

  const ip = getClientIp(request);
  const bucketKey = `${key}:${ip}`;
  const current = now();
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= current) {
    buckets.set(bucketKey, {
      count: 1,
      resetAt: current + windowMs,
    });

    return null;
  }

  if (existing.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - current) / 1000));

    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  existing.count += 1;
  buckets.set(bucketKey, existing);

  return null;
};
