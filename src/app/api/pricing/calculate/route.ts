import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/services/firebase";
import {
  calculatePricingBreakdown,
  calculatePricingForLineItems,
  PricingBreakdown,
  PricingCalculationInput,
} from "@/utils/pricing";

type PricingRequestInput = {
  productId?: string;
  pricingType?: "meter" | "piece";
  quantityOrMeter?: number;
  pickupCharge?: number;
  dropCharge?: number;
  lineItems?: Array<{
    productId: string;
    quantityOrMeter: number;
  }>;
  paymentType?: "advance" | "full";
};

type PricingApiResponse = {
  success: true;
  total: number;
  breakdown?: {
    base?: number;
    basePrice?: number;
    pickupCharge?: number;
    dropCharge?: number;
    finalPayable?: number;
  };
  fallback: boolean;
  pricingBreakdown?: PricingBreakdown;
  reason?: "product_not_found" | "price_missing" | "invalid_payload" | "db_unavailable" | "unexpected_error";
};

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePricingType = (value: unknown, productType: unknown): "meter" | "piece" => {
  if (value === "meter" || value === "piece") {
    return value;
  }

  if (productType === "fabric") {
    return "meter";
  }

  return "piece";
};

const buildFallbackResponse = (
  reason: NonNullable<PricingApiResponse["reason"]>,
): PricingApiResponse => {
  const pricingBreakdown = calculatePricingBreakdown({
    marketPrice: 100,
    pricingType: "piece",
    pricePerUnit: 100,
    quantityOrMeter: 1,
    discountPercentage: 0,
    advancePercentage: 20,
  });

  return {
    success: true,
    total: 100,
    breakdown: {
      base: 100,
      basePrice: 100,
      pickupCharge: 0,
      dropCharge: 0,
      finalPayable: 100,
    },
    fallback: true,
    reason,
    pricingBreakdown,
  };
};

const extractStrictPrice = (product: Record<string, unknown>): number | null => {
  if (typeof product.price === "number" && Number.isFinite(product.price)) {
    return product.price;
  }

  if (typeof product.pricePerUnit === "number" && Number.isFinite(product.pricePerUnit)) {
    return product.pricePerUnit;
  }

  if (typeof product.marketPrice === "number" && Number.isFinite(product.marketPrice)) {
    return product.marketPrice;
  }

  return null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PricingRequestInput;
    console.log("PRICING BODY:", body);

    const db = getFirebaseDb();

    if (!db) {
      return NextResponse.json(buildFallbackResponse("db_unavailable"), { status: 200 });
    }

    const input: PricingRequestInput = {
      productId: typeof body.productId === "string" ? body.productId.trim() : undefined,
      pricingType: body.pricingType,
      quantityOrMeter: toFiniteNumber(body.quantityOrMeter, 1),
      pickupCharge: toFiniteNumber(body.pickupCharge, 0),
      dropCharge: toFiniteNumber(body.dropCharge, 0),
      lineItems: Array.isArray(body.lineItems) ? body.lineItems : undefined,
      paymentType: body.paymentType,
    };

    if (input.lineItems && input.lineItems.length > 0) {
      const linePricingInputs: PricingCalculationInput[] = [];

      for (const line of input.lineItems) {
        const lineProductId = line.productId.trim();
        const ref = doc(db, "products", lineProductId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          console.error("PRODUCT NOT FOUND:", lineProductId);
          return NextResponse.json(buildFallbackResponse("product_not_found"), { status: 200 });
        }

        const product = snap.data() as Record<string, unknown>;
        console.log("PRODUCT DATA:", product);

        const price = extractStrictPrice(product);

        if (price === null) {
          console.error("PRICE INVALID:", product);
          return NextResponse.json(buildFallbackResponse("price_missing"), { status: 200 });
        }

        const pricingType = normalizePricingType(product.pricingType, product.productType);

        linePricingInputs.push({
          marketPrice: typeof product.marketPrice === "number" ? product.marketPrice : price,
          pricingType,
          pricePerUnit: typeof product.pricePerUnit === "number" ? product.pricePerUnit : price,
          quantityOrMeter: Number.isFinite(line.quantityOrMeter) ? line.quantityOrMeter : 1,
          discountPercentage: typeof product.discountPercentage === "number" ? product.discountPercentage : 0,
          advancePercentage: typeof product.advancePercentage === "number" ? product.advancePercentage : 20,
        });
      }

      const pricingBreakdown = calculatePricingForLineItems(linePricingInputs);
      const total = input.paymentType === "advance"
        ? pricingBreakdown.advanceAmount
        : pricingBreakdown.finalPayable;

      const response: PricingApiResponse = {
        success: true,
        total,
        breakdown: {
          basePrice: pricingBreakdown.finalPrice,
          pickupCharge: pricingBreakdown.pickupCharge,
          dropCharge: pricingBreakdown.dropCharge,
          finalPayable: pricingBreakdown.finalPayable,
        },
        fallback: false,
        pricingBreakdown,
      };

      return NextResponse.json(response, { status: 200 });
    }

    if (!input.productId) {
      return NextResponse.json(buildFallbackResponse("invalid_payload"), { status: 200 });
    }

    const productId = input.productId.trim();
    const ref = doc(db, "products", productId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.error("PRODUCT NOT FOUND:", productId);
      return NextResponse.json(buildFallbackResponse("product_not_found"), { status: 200 });
    }

    const product = snap.data() as Record<string, unknown>;
    console.log("PRODUCT DATA:", product);

    const price = extractStrictPrice(product);

    if (price === null) {
      console.error("PRICE INVALID:", product);
      return NextResponse.json(buildFallbackResponse("price_missing"), { status: 200 });
    }

    const pricingType = normalizePricingType(input.pricingType, product.productType);
    const pricingBreakdown = calculatePricingBreakdown({
      marketPrice: typeof product.marketPrice === "number" ? product.marketPrice : price,
      pricingType,
      pricePerUnit: typeof product.pricePerUnit === "number" ? product.pricePerUnit : price,
      quantityOrMeter: input.quantityOrMeter ?? 1,
      discountPercentage: typeof product.discountPercentage === "number" ? product.discountPercentage : 0,
      advancePercentage: typeof product.advancePercentage === "number" ? product.advancePercentage : 20,
      pickupCharge: input.pickupCharge,
      dropCharge: input.dropCharge,
    });

    const total = price;

    const response: PricingApiResponse = {
      success: true,
      total,
      breakdown: {
        base: price,
        basePrice: pricingBreakdown.finalPrice,
        pickupCharge: pricingBreakdown.pickupCharge,
        dropCharge: pricingBreakdown.dropCharge,
        finalPayable: pricingBreakdown.finalPayable,
      },
      fallback: false,
      pricingBreakdown,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("PRICING ERROR:", error);
    return NextResponse.json(buildFallbackResponse("unexpected_error"), { status: 200 });
  }
}
