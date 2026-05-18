import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let paymentAlreadyProcessed = false;

const transactionSet = vi.fn();

vi.mock("firebase-admin/app", () => {
  return {
    cert: vi.fn(() => ({})),
    getApps: vi.fn(() => []),
    initializeApp: vi.fn(() => ({})),
  };
});

vi.mock("firebase-admin/auth", () => {
  return {
    getAuth: vi.fn(() => ({
      verifyIdToken: vi.fn(async () => ({ uid: "user-1", role: "user" })),
    })),
  };
});

vi.mock("firebase-admin/firestore", () => {
  const makeRef = (collection: string, id?: string) => {
    const resolvedId = id || `${collection}-generated`;
    return {
      id: resolvedId,
      path: `${collection}/${resolvedId}`,
    };
  };

  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => makeRef(name, id),
    }),
    runTransaction: async (callback: (transaction: { get: (ref: unknown) => Promise<{ exists: boolean }>; set: (...args: unknown[]) => void }) => Promise<void>) => {
      await callback({
        get: async () => ({ exists: paymentAlreadyProcessed }),
        set: transactionSet,
      });
    },
  };

  return {
    FieldValue: {
      serverTimestamp: vi.fn(() => "mock-server-timestamp"),
    },
    getFirestore: vi.fn(() => db),
  };
});

vi.mock("@/services/productService", () => {
  return {
    getProductById: vi.fn(async (id: string) => ({
      id,
      name: "Test Product",
      category: "fabric",
      image: "",
      productType: "fabric",
      pricingType: "piece",
      price: 1000,
      pricePerUnit: 1000,
      marketPrice: 1200,
      discountPercentage: 10,
      advancePercentage: 20,
      discountPercent: 10,
      type: "cotton",
      description: "",
      inStock: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
});

import { POST } from "@/app/api/orders/finalize/route";

const buildRequest = (overrides?: Partial<Record<string, unknown>>) => {
  const body = {
    userId: "user-1",
    service: "fabric",
    productId: "prod-1",
    orderDetails: { color: "red" },
    paymentType: "full",
    paymentId: "pay-1",
    amountPaid: 900,
    pricingInput: {
      productId: "prod-1",
      pricingType: "piece",
      quantityOrMeter: 1,
    },
    ...overrides,
  };

  return new Request("http://localhost/api/orders/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer mock:user-1:user",
    },
    body: JSON.stringify(body),
  }) as NextRequest;
};

describe("POST /api/orders/finalize", () => {
  beforeEach(() => {
    paymentAlreadyProcessed = false;
    transactionSet.mockClear();
  });

  it("returns 400 when amount does not match server pricing", async () => {
    const request = buildRequest({ amountPaid: 1000 });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("Amount mismatch");
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it("returns 409 when payment id was already processed", async () => {
    paymentAlreadyProcessed = true;
    const request = buildRequest();

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Payment already processed.");
  });
});
