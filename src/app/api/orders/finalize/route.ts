import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getProductById } from "@/services/productService";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/utils/server/firebaseAdmin";
import {
  calculatePricingBreakdown,
  calculatePricingForLineItems,
  PricingCalculationInput,
} from "@/utils/pricing";

const lineItemSchema = z.object({
  productId: z.string().min(1),
  quantityOrMeter: z.number().positive(),
});

const finalizeSchema = z.object({
  userId: z.string().min(1),
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

const verifyRequestUser = async (request: NextRequest) => {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return null;
  }

  if (process.env.NODE_ENV !== "production" && token.startsWith("mock:")) {
    const [, uid, role] = token.split(":");

    if (!uid) {
      return null;
    }

    return {
      uid,
      role: role || "user",
    };
  }

  const decoded = await getFirebaseAdminAuth().verifyIdToken(token);

  return {
    uid: decoded.uid,
    role:
      decoded.admin === true || decoded.role === "admin" || decoded.custom_claim_role === "admin"
        ? "admin"
        : "user",
  };
};

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

export async function POST(request: NextRequest) {
  try {
    const requester = await verifyRequestUser(request);

    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const input = finalizeSchema.parse(body);

    if (requester.uid !== input.userId && requester.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pricing = await resolvePricing(input);

    const payableAmount = input.paymentType === "advance"
      ? pricing.advanceAmount
      : pricing.finalPayable;

    if (Math.round(input.amountPaid) !== payableAmount) {
      return NextResponse.json(
        { error: "Amount mismatch. Please refresh checkout and try again." },
        { status: 400 },
      );
    }

    const db = getFirebaseAdminDb();
    const orderRef = db.collection("orders").doc();
    const paymentRef = db.collection("payment_records").doc(input.paymentId);

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
        userId: input.userId,
        phone: input.customerPhone || null,
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
            updatedAt: FieldValue.serverTimestamp(),
            note: "Order created",
          },
        ],
        assignedTo: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    console.info("[orders] finalize_success", {
      orderId: orderRef.id,
      userId: input.userId,
      service: input.service,
      amountPaid: input.amountPaid,
      paymentType: input.paymentType,
      finalPrice: pricing.finalPrice,
    });

    return NextResponse.json(
      {
        success: true,
        orderId: orderRef.id,
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
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Unable to finalize order" },
      { status: 500 },
    );
  }
}
