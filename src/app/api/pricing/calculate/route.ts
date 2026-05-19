import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getProductById } from "@/services/productService";
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
  fallbackPricing?: {
    marketPrice?: number;
    pricePerUnit?: number;
    pricingType?: "meter" | "piece";
    discountPercentage?: number;
    advancePercentage?: number;
  };
  lineItems?: Array<{
    productId: string;
    quantityOrMeter: number;
    fallbackPricing?: {
      marketPrice?: number;
      pricePerUnit?: number;
      pricingType?: "meter" | "piece";
      discountPercentage?: number;
      advancePercentage?: number;
    };
  }>;
  paymentType?: "advance" | "full";
};

type PricingApiResponse = {
  success: boolean;
  total?: number;
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
  error?: string;
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
  // Fallback: return zeroed values, no hardcoded 100
  const basePrice = 0;
  const quantity = 0;
  const total = 0;
  const pricingBreakdown = calculatePricingBreakdown({
    marketPrice: 0,
    pricingType: "piece",
    pricePerUnit: 0,
    quantityOrMeter: 0,
    discountPercentage: 0,
    advancePercentage: 20,
  });

  return {
    success: true,
    total,
    breakdown: {
      basePrice,
      pickupCharge: 0,
      dropCharge: 0,
      finalPayable: 0,
    },
    fallback: true,
    reason,
    pricingBreakdown,
  };
};

const toFallbackPricingInput = (
  fallbackPricing: PricingRequestInput["fallbackPricing"] | undefined,
  quantityOrMeter: number,
): PricingCalculationInput | null => {
  if (!fallbackPricing) {
    return null;
  }

  const pricePerUnit = Number(fallbackPricing.pricePerUnit);
  const marketPrice = Number(fallbackPricing.marketPrice);

  if (!Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    return null;
  }

  return {
    marketPrice: Number.isFinite(marketPrice) && marketPrice > 0 ? marketPrice : pricePerUnit,
    pricingType: fallbackPricing.pricingType === "meter" || fallbackPricing.pricingType === "piece"
      ? fallbackPricing.pricingType
      : "piece",
    pricePerUnit,
    quantityOrMeter: Number.isFinite(quantityOrMeter) && quantityOrMeter > 0 ? quantityOrMeter : 1,
    discountPercentage: Number.isFinite(Number(fallbackPricing.discountPercentage))
      ? Number(fallbackPricing.discountPercentage)
      : 0,
    advancePercentage: Number.isFinite(Number(fallbackPricing.advancePercentage))
      ? Number(fallbackPricing.advancePercentage)
      : 20,
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

const toPricingProduct = (product: Record<string, unknown>) => {
  const price = extractStrictPrice(product);

  return {
    marketPrice: typeof product.marketPrice === "number" ? product.marketPrice : price ?? 0,
    pricingType: normalizePricingType(product.pricingType, product.productType),
    pricePerUnit: typeof product.pricePerUnit === "number" ? product.pricePerUnit : price ?? 0,
    discountPercentage: typeof product.discountPercentage === "number" ? product.discountPercentage : 0,
    advancePercentage: typeof product.advancePercentage === "number" ? product.advancePercentage : 20,
    price,
  };
};

const loadProductById = async (productId: string) => {
  try {
    const db = getAdminDb();
    const snap = await db.collection("products").doc(productId).get();

    if (snap.exists) {
      return snap.data() as Record<string, unknown>;
    }

    const publicProduct = await getProductById(productId);

    return publicProduct ? ({
      ...publicProduct,
      productType: publicProduct.productType,
      pricingType: publicProduct.pricingType,
      price: publicProduct.price,
      pricePerUnit: publicProduct.pricePerUnit,
      marketPrice: publicProduct.marketPrice,
      discountPercentage: publicProduct.discountPercentage,
      advancePercentage: publicProduct.advancePercentage,
    } as Record<string, unknown>) : null;
  } catch (error) {
    console.warn("PRICING ADMIN DB UNAVAILABLE, falling back to public product lookup:", error);

    const product = await getProductById(productId);

    return product ? ({
      ...product,
      productType: product.productType,
      pricingType: product.pricingType,
      price: product.price,
      pricePerUnit: product.pricePerUnit,
      marketPrice: product.marketPrice,
      discountPercentage: product.discountPercentage,
      advancePercentage: product.advancePercentage,
    } as Record<string, unknown>) : null;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PricingRequestInput;
    console.log("PRICING BODY:", body);

    const input: PricingRequestInput = {
      productId: typeof body.productId === "string" ? body.productId.trim() : undefined,
      pricingType: body.pricingType,
      quantityOrMeter: toFiniteNumber(body.quantityOrMeter, 1),
      pickupCharge: toFiniteNumber(body.pickupCharge, 0),
      dropCharge: toFiniteNumber(body.dropCharge, 0),
      fallbackPricing: body.fallbackPricing,
      lineItems: Array.isArray(body.lineItems) ? body.lineItems : undefined,
      paymentType: body.paymentType,
    };

    if (input.lineItems && input.lineItems.length > 0) {
      const linePricingInputs: PricingCalculationInput[] = [];

      for (const line of input.lineItems) {
        const lineProductId = line.productId.trim();
        const product = await loadProductById(lineProductId);

        console.log("DOC EXISTS:", Boolean(product));

        if (!product) {
          const fallbackInput = toFallbackPricingInput(line.fallbackPricing, line.quantityOrMeter);

          if (!fallbackInput) {
            console.error("PRODUCT NOT FOUND:", lineProductId);
            return NextResponse.json(buildFallbackResponse("product_not_found"), { status: 200 });
          }

          linePricingInputs.push(fallbackInput);
          continue;
        }

        console.log("PRODUCT DATA:", product);

        const pricingSource = toPricingProduct(product);
        const price = pricingSource.price;

        if (price === null) {
          console.error("PRICE INVALID:", product);
          return NextResponse.json(buildFallbackResponse("price_missing"), { status: 200 });
        }

        linePricingInputs.push({
          marketPrice: pricingSource.marketPrice,
          pricingType: pricingSource.pricingType,
          pricePerUnit: pricingSource.pricePerUnit,
          quantityOrMeter: Number.isFinite(line.quantityOrMeter) ? line.quantityOrMeter : 1,
          discountPercentage: pricingSource.discountPercentage,
          advancePercentage: pricingSource.advancePercentage,
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
      return NextResponse.json({
        success: false,
        fallback: true,
        reason: "invalid_payload",
        error: "productId or lineItems are required.",
      } satisfies PricingApiResponse, { status: 400 });
    }

    const productId = input.productId?.trim();
    if (!productId) {
      return NextResponse.json({ success: false, fallback: true, error: "Missing productId" }, { status: 400 });
    }

    // Fetch product from Firestore
    try {
      const db = getAdminDb();
      const snap = await db.collection("products").doc(productId).get();
      if (!snap.exists) {
        console.error("CHECKOUT PRICING: Product not found for id:", productId);
        return NextResponse.json({ success: false, fallback: true, error: "Product not found" }, { status: 404 });
      }
      const product = snap.data();
      if (!product || typeof product.price !== "number" || !Number.isFinite(product.price)) {
        console.error("CHECKOUT PRICING: Invalid price for product:", productId, product);
        return NextResponse.json({ success: false, fallback: true, error: "Invalid product price" }, { status: 400 });
      }
      return NextResponse.json({ success: true, total: product.price, fallback: false });
    } catch (err) {
      console.error("CHECKOUT PRICING: Error fetching product:", productId, err);
      return NextResponse.json({ success: false, fallback: true, error: "Server error" }, { status: 500 });
    }
  } catch (error) {
    console.error("PRICING ERROR:", error);
    return NextResponse.json(buildFallbackResponse("db_unavailable"), { status: 200 });
  }
}
