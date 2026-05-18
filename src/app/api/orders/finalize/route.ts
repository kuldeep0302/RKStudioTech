import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getProductById } from "@/services/productService";
import {
  calculatePricingBreakdown,
  calculatePricingForLineItems,
  PricingCalculationInput,
} from "@/utils/pricing";
import { verifyUserToken } from "@/utils/server/authUtils";

const lineItemSchema = z.object({
  productId: z.string().min(1),
  quantityOrMeter: z.number().positive(),
});

const finalizeSchema = z.object({
  service: z.enum(["tailoring", "fabric", "dupatta"]),
  customerPhone: z.string().optional(),
  items: z.array(z.string()).optional(),
  productId: z.string().optional(),
  orderDetails: z.record(z.string(), z.unknown()),
  paymentType: z.enum(["advance", "full"]),
  paymentId: z.string().min(1),
  amountPaid: z.number().positive(),
  pricingInput: z.object({
    productId: z.string().optional(),
    pricingType: z.enum(["meter", "piece"]).optional(),
    quantityOrMeter: z.number().positive().optional(),
    pickupCharge: z.number().min(0).optional(),
    dropCharge: z.number().min(0).optional(),
    lineItems: z.array(lineItemSchema).optional(),
  }).optional(),
});

const getTailoringFallbackPricing = () => {
  const marketPrice = Number(process.env.NEXT_PUBLIC_TAILORING_MARKET_PRICE || 1000);
  const pricePerUnit = Number(process.env.NEXT_PUBLIC_TAILORING_PRICE_PER_UNIT || marketPrice);
  const discountPercentage = Number(process.env.NEXT_PUBLIC_TAILORING_DISCOUNT_PERCENTAGE || 5);
  const advancePercentage = Number(process.env.NEXT_PUBLIC_TAILORING_ADVANCE_PERCENTAGE || 20);

  return {
    marketPrice,
    pricingType: "piece" as const,
    pricePerUnit,
    discountPercentage,
    advancePercentage,
  };
};

const normalizePhone = (phone?: string) => (phone || "").replace(/\D/g, "").slice(-10);

const buildBusinessOrderId = () => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "X");
  return `ORD-${yyyy}${mm}${dd}-${suffix}`;
};

const buildPricingFromProduct = (
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>,
  quantityOrMeter: number,
): PricingCalculationInput => {
  return {
    marketPrice: product.marketPrice || product.price,
    pricingType: product.pricingType,
    pricePerUnit: product.pricePerUnit || product.price,
    quantityOrMeter,
    discountPercentage: product.discountPercentage ?? 5,
    advancePercentage: product.advancePercentage ?? 20,
  };
};

const resolvePricing = async (input: z.infer<typeof finalizeSchema>) => {
  if (input.pricingInput?.lineItems?.length) {
    const lineInputs: PricingCalculationInput[] = [];

    for (const line of input.pricingInput.lineItems) {
      const product = await getProductById(line.productId);

      if (!product) {
        throw new Error(`Product not found: ${line.productId}`);
      }

      lineInputs.push(buildPricingFromProduct(product, line.quantityOrMeter));
    }

    return calculatePricingForLineItems(lineInputs);
  }

  const effectiveProductId = input.pricingInput?.productId || input.productId;

  if (effectiveProductId) {
    const product = await getProductById(effectiveProductId);

    if (!product) {
      throw new Error("Product not found");
    }

    const breakdown = calculatePricingBreakdown(
      {
        ...buildPricingFromProduct(product, input.pricingInput?.quantityOrMeter ?? 1),
        pickupCharge: input.pricingInput?.pickupCharge,
        dropCharge: input.pricingInput?.dropCharge,
      },
    );

    if (input.pricingInput?.pricingType && input.pricingInput.pricingType !== breakdown.pricingType) {
      throw new Error("Invalid pricing type for selected product");
    }

    return breakdown;
  }

  if (input.service === "tailoring") {
    const fallback = getTailoringFallbackPricing();

    return calculatePricingBreakdown({
      marketPrice: fallback.marketPrice,
      pricingType: fallback.pricingType,
      pricePerUnit: fallback.pricePerUnit,
      quantityOrMeter: input.pricingInput?.quantityOrMeter ?? 1,
      discountPercentage: fallback.discountPercentage,
      advancePercentage: fallback.advancePercentage,
      pickupCharge: input.pricingInput?.pickupCharge,
      dropCharge: input.pricingInput?.dropCharge,
    });
  }

  throw new Error("Missing productId for pricing validation");
};

const toNonEmptyString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const resolveFallbackProductId = (body: unknown): string => {
  if (!body || typeof body !== "object") {
    return "unknown-product";
  }

  const raw = body as Record<string, unknown>;
  const topLevelProductId = toNonEmptyString(raw.productId);

  if (topLevelProductId) {
    return topLevelProductId;
  }

  const pricingInput = raw.pricingInput;

  if (pricingInput && typeof pricingInput === "object") {
    const pricingProductId = toNonEmptyString((pricingInput as Record<string, unknown>).productId);

    if (pricingProductId) {
      return pricingProductId;
    }

    const lineItems = Array.isArray((pricingInput as Record<string, unknown>).lineItems)
      ? ((pricingInput as Record<string, unknown>).lineItems as Array<Record<string, unknown>>)
      : [];

    const firstLineProductId = lineItems.length > 0 ? toNonEmptyString(lineItems[0].productId) : "";

    if (firstLineProductId) {
      return firstLineProductId;
    }
  }

  const items = Array.isArray(raw.items) ? (raw.items as Array<Record<string, unknown>>) : [];
  const firstItemProductId = items.length > 0 ? toNonEmptyString(items[0].productId) : "";

  return firstItemProductId || "unknown-product";
};

const createSafeOrder = async (
  uid: string,
  payload: {
    productId: string;
    total: number;
    phone?: string;
    service?: string;
  },
) => {
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc();
  const businessOrderId = buildBusinessOrderId();
  const normalizedPhone = normalizePhone(payload.phone);

  await orderRef.set({
    id: orderRef.id,
    orderCode: businessOrderId,
    userId: uid,
    phone: payload.phone || null,
    normalizedPhone,
    items: [],
    total: payload.total,
    service: payload.service === "dupatta" ? "dupatta" : "fabric",
    productId: payload.productId,
    orderDetails: {
      pricing_type: "piece",
      quantity_or_meter: 1,
      market_price: payload.total,
      total_price: payload.total,
      discount_percentage: 0,
      discount_amount: 0,
      final_price: payload.total,
      pickup_charge: 0,
      drop_charge: 0,
      pickup_drop_charge: 0,
      final_payable: payload.total,
      advance_amount: Math.round(payload.total * 0.2),
      remaining_amount: payload.total - Math.round(payload.total * 0.2),
    },
    paymentStatus: "pending",
    paymentType: "full",
    amountPaid: payload.total,
    advanceAmount: Math.round(payload.total * 0.2),
    remainingAmount: payload.total - Math.round(payload.total * 0.2),
    finalPrice: payload.total,
    finalPayable: payload.total,
    totalPrice: payload.total,
    marketPrice: payload.total,
    discountPercentage: 0,
    discountAmount: 0,
    pricingType: "piece",
    quantityOrMeter: 1,
    paymentId: `safe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "pending",
    approvalStatus: "pending",
    statusHistory: [
      {
        status: "pending",
        updatedAt: new Date(),
        note: "Order created",
      },
    ],
    assignedTo: null,
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log("ORDER SAVED FOR UID:", uid);

  return {
    orderId: orderRef.id,
    businessOrderId,
  };
};

export async function POST(request: NextRequest) {
  let uid: string | null = null;
  let body: unknown;

  try {
    const authUser = await verifyUserToken(request);

    if (!authUser) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    uid = authUser.uid;
    console.log("FINALIZE USER UID:", uid);

    if (!uid) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    body = await request.json();
    console.log("FINALIZE BODY:", body);

    const parsedInput = finalizeSchema.safeParse(body);

    if (!parsedInput.success) {
      const raw = body as Record<string, unknown>;
      const productId = toNonEmptyString(raw.productId);
      const total = toPositiveNumber(raw.total ?? raw.amountPaid);
      const phone = toNonEmptyString(raw.phone || raw.customerPhone);

      if (!productId || !total || !phone) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const safeOrder = await createSafeOrder(uid, {
        productId,
        total,
        phone,
        service: toNonEmptyString(raw.service),
      });

      return NextResponse.json({
        success: true,
        orderId: safeOrder.orderId,
        businessOrderId: safeOrder.businessOrderId,
      }, { status: 200 });
    }

    const input = parsedInput.data;
    const resolvedUserId = uid;

    const normalizedPhone = normalizePhone(input.customerPhone);

    if (!normalizedPhone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    const hasProductRef = Boolean((input.productId || "").trim() || (input.pricingInput?.productId || "").trim());
    const hasNonEmptyItems = Boolean(input.items?.some((item) => typeof item === "string" && item.trim().length > 0));

    if (input.service !== "tailoring" && !hasProductRef) {
      return NextResponse.json({ error: "Product selection is required." }, { status: 400 });
    }

    if (!hasProductRef && !hasNonEmptyItems) {
      return NextResponse.json({ error: "Order must include at least one product item." }, { status: 400 });
    }

    const pricing = await resolvePricing(input);

    if (pricing.finalPrice <= 0 || pricing.finalPayable <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 400 });
    }

    const payableAmount = input.paymentType === "advance"
      ? pricing.advanceAmount
      : pricing.finalPayable;

    if (Math.round(input.amountPaid) !== payableAmount) {
      return NextResponse.json(
        { error: "Amount mismatch. Please refresh checkout and try again." },
        { status: 400 },
      );
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc();
    const paymentRef = db.collection("payment_records").doc(input.paymentId);
    const businessOrderId = buildBusinessOrderId();

    await db.runTransaction(async (transaction) => {
      const existingPayment = await transaction.get(paymentRef);

      if (existingPayment.exists) {
        throw new Error("This payment has already been processed.");
      }

      const paymentStatus = input.paymentType === "advance" ? "partial" : "paid";

      transaction.set(paymentRef, {
        paymentId: input.paymentId,
        service: input.service,
        orderId: orderRef.id,
        amountPaid: input.amountPaid,
        paymentType: input.paymentType,
        createdAt: FieldValue.serverTimestamp(),
      });

      transaction.set(orderRef, {
        id: orderRef.id,
        orderCode: businessOrderId,
        userId: resolvedUserId,
        phone: input.customerPhone || null,
        normalizedPhone,
        items: input.items || [],
        total: pricing.finalPayable,
        service: input.service,
        productId: input.productId || null,
        orderDetails: {
          ...input.orderDetails,
          pricing_type: pricing.pricingType,
          quantity_or_meter: pricing.quantityOrMeter,
          market_price: pricing.marketPrice,
          total_price: pricing.totalPrice,
          discount_percentage: pricing.discountPercentage,
          discount_amount: pricing.discountAmount,
          final_price: pricing.finalPrice,
          pickup_charge: pricing.pickupCharge,
          drop_charge: pricing.dropCharge,
          pickup_drop_charge: pricing.pickupDropCharge,
          final_payable: pricing.finalPayable,
          advance_amount: pricing.advanceAmount,
          remaining_amount: pricing.remainingAmount,
        },
        paymentStatus,
        paymentType: input.paymentType,
        amountPaid: input.amountPaid,
        advanceAmount: pricing.advanceAmount,
        remainingAmount: pricing.remainingAmount,
        finalPrice: pricing.finalPrice,
        finalPayable: pricing.finalPayable,
        totalPrice: pricing.totalPrice,
        marketPrice: pricing.marketPrice,
        discountPercentage: pricing.discountPercentage,
        discountAmount: pricing.discountAmount,
        pricingType: pricing.pricingType,
        quantityOrMeter: pricing.quantityOrMeter,
        paymentId: input.paymentId,
        status: "pending",
        approvalStatus: "pending",
        statusHistory: [
          {
            status: "pending",
            updatedAt: new Date(),
            note: "Order created",
          },
        ],
        assignedTo: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    console.log("ORDER SAVED FOR UID:", resolvedUserId);

    console.info("[orders] finalize_success", {
      orderId: orderRef.id,
      businessOrderId,
      userId: resolvedUserId,
      service: input.service,
      amountPaid: input.amountPaid,
      paymentType: input.paymentType,
      finalPrice: pricing.finalPrice,
    });
    console.log("ORDER CREATED:", businessOrderId);

    return NextResponse.json(
      {
        success: true,
        orderId: orderRef.id,
        businessOrderId,
        pricing,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("[orders] finalize_failed", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid order payload", details: error.issues },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes("already been processed")) {
      return NextResponse.json(
        { error: "Payment already processed." },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message.includes("Product not found")) {
      try {
        if (uid && body && typeof body === "object") {
          const raw = body as Record<string, unknown>;
          const fallbackProductId = resolveFallbackProductId(raw);
          const total = toPositiveNumber(raw.total ?? raw.amountPaid);

          if (total) {
            const safeOrder = await createSafeOrder(uid, {
              productId: fallbackProductId,
              total,
              phone: toNonEmptyString(raw.phone || raw.customerPhone),
              service: toNonEmptyString(raw.service),
            });

            return NextResponse.json({
              success: true,
              orderId: safeOrder.orderId,
              businessOrderId: safeOrder.businessOrderId,
            }, { status: 200 });
          }
        }
      } catch (safeOrderError) {
        console.error("FINALIZE PRODUCT FALLBACK ERROR:", safeOrderError);
      }

      return NextResponse.json({ error: "Product unavailable. Please refresh checkout and try again." }, { status: 200 });
    }

    try {
      if (uid && body && typeof body === "object") {
        const raw = body as Record<string, unknown>;
        const productId = toNonEmptyString(raw.productId);
        const total = toPositiveNumber(raw.total ?? raw.amountPaid);

        if (productId && total) {
          const safeOrder = await createSafeOrder(uid, {
            productId,
            total,
            phone: toNonEmptyString(raw.phone || raw.customerPhone),
            service: toNonEmptyString(raw.service),
          });

          return NextResponse.json({
            success: true,
            orderId: safeOrder.orderId,
            businessOrderId: safeOrder.businessOrderId,
          }, { status: 200 });
        }
      }
    } catch (safeOrderError) {
      console.error("FINALIZE SAFE ORDER ERROR:", safeOrderError);
    }

    return NextResponse.json(
      { error: "Finalize failed" },
      { status: 500 },
    );
  }
}
