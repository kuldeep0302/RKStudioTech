"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { getAuth } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth } from "@/services/firebase";
import { createMockAccessToken } from "@/services/authService";
import { OrderDetails } from "@/services/orderService";
import { AppUser, subscribeToUser } from "@/services/userService";
import { readFabricCart, removeFabricCartItem, removeFabricCartItems } from "@/utils/fabricCart";
import { clearPendingPaymentOrder, readPendingPaymentOrder } from "@/utils/paymentSession";
import { PricingBreakdown, calculatePricingBreakdown } from "@/utils/pricing";
import { saveMockOrderFromCheckout } from "@/utils/mockOrderStore";
import { buildWhatsAppChatUrl, formatPhone } from "@/utils/whatsapp";

type FinalizeResponse = {
  success?: boolean;
  orderId?: string;
  businessOrderId?: string;
  error?: string;
};

type PricingApiResponse = {
  success?: boolean;
  total?: number;
  breakdown?: {
    basePrice: number;
    pickupCharge: number;
    dropCharge: number;
    finalPayable: number;
  };
  pricingBreakdown?: PricingBreakdown;
  error?: string;
  fallback?: boolean;
};

const PAYMENT_STORAGE_PREFIX = "rkstudio_pending_payment_";

const cleanupStalePaymentStorage = (currentToken: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem("payment-session");

  const activeStorageKeys: string[] = [];

  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);

    if (key) {
      activeStorageKeys.push(key);
    }
  }

  for (const key of activeStorageKeys) {
    if (!key.startsWith(PAYMENT_STORAGE_PREFIX)) {
      continue;
    }

    if (key === `${PAYMENT_STORAGE_PREFIX}${currentToken}`) {
      continue;
    }

    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  }
};

const resolveCheckoutProduct = (
  pendingOrder: NonNullable<ReturnType<typeof readPendingPaymentOrder>>,
) => {
  const cartItems = readFabricCart();
  const cartItemId = typeof pendingOrder.orderDetails?.cart_item_id === "string"
    ? pendingOrder.orderDetails.cart_item_id
    : "";

  const selectedFromCartId = cartItemId
    ? cartItems.find((item) => item.id === cartItemId)
    : undefined;
  const selectedFromPendingProductId = cartItems.find((item) =>
    item.productId === pendingOrder.pricingInput?.productId
    || item.productId === pendingOrder.productId,
  );

  const selectedProduct = selectedFromCartId || selectedFromPendingProductId || cartItems[0] || null;

  return {
    selectedProduct,
    cartItems,
  };
};

const resolveCheckoutLineItems = (
  pendingOrder: NonNullable<ReturnType<typeof readPendingPaymentOrder>>,
  cartItems: ReturnType<typeof readFabricCart>,
) => {
  const cartItemIds = Array.isArray(pendingOrder.orderDetails?.cart_item_ids)
    ? pendingOrder.orderDetails.cart_item_ids.filter((value): value is string => typeof value === "string")
    : [];

  if (!cartItemIds.length) {
    return pendingOrder.pricingInput?.lineItems;
  }

  const lineItems = cartItemIds
    .map((cartItemId) => cartItems.find((cartItem) => cartItem.id === cartItemId))
    .filter((cartItem): cartItem is NonNullable<typeof cartItem> => Boolean(cartItem))
    .map((cartItem) => ({
      productId: cartItem.productId,
      quantityOrMeter: cartItem.selected_quantity,
    }));

  return lineItems.length ? lineItems : pendingOrder.pricingInput?.lineItems;
};

const toSafePricingBreakdown = (
  pendingOrder: NonNullable<ReturnType<typeof readPendingPaymentOrder>>,
  total: number,
): PricingBreakdown => {
  const normalizedTotal = Math.max(0, Number(total) || 0);
  const pricingType = pendingOrder.pricingInput?.pricingType
    || (pendingOrder.service === "fabric" ? "meter" : "piece");
  const quantityOrMeter = pendingOrder.pricingInput?.quantityOrMeter ?? 1;
  const pickupCharge = typeof pendingOrder.orderDetails?.pickup_charge === "number"
    ? Math.max(0, pendingOrder.orderDetails.pickup_charge)
    : 0;
  const dropCharge = typeof pendingOrder.orderDetails?.drop_charge === "number"
    ? Math.max(0, pendingOrder.orderDetails.drop_charge)
    : 0;

  return calculatePricingBreakdown({
    marketPrice: normalizedTotal,
    pricingType,
    pricePerUnit: normalizedTotal,
    quantityOrMeter,
    discountPercentage: 0,
    advancePercentage: pendingOrder.paymentType === "advance" ? 20 : 100,
    pickupCharge: pendingOrder.pricingInput?.pickupCharge ?? pickupCharge,
    dropCharge: pendingOrder.pricingInput?.dropCharge ?? dropCharge,
  });
};

export default function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pricingNotice, setPricingNotice] = useState("");
  const [pendingOrder, setPendingOrder] = useState<ReturnType<typeof readPendingPaymentOrder>>(null);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [orderFailed, setOrderFailed] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<"success" | "error">("success");
  const submitLockRef = useRef(false);
  const supportPhone = formatPhone("9198901501572");
  const supportUrl = buildWhatsAppChatUrl(supportPhone, "Hi, I need help with my order");

  useEffect(() => {
    if (!user) {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(currentUrl)}`);
    }
  }, [user, router]);

  useEffect(() => {
    cleanupStalePaymentStorage(token);

    if (!token) {
      setError("Order session not found. Please start your order again.");
      setLoading(false);
      return;
    }

    const pending = readPendingPaymentOrder(token);

    if (!pending) {
      setError("Order session expired. Please start your order again.");
      setLoading(false);
      return;
    }

    setPendingOrder(pending);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    let ignore = false;

    const recalculatePricing = async () => {
      if (!pendingOrder) {
        setPricingBreakdown(null);
        setPricingNotice("");
        return;
      }

      try {
        setPricingLoading(true);

        const pickupCharge = typeof pendingOrder.orderDetails?.pickup_charge === "number"
          ? Math.max(0, pendingOrder.orderDetails.pickup_charge)
          : 0;
        const dropCharge = typeof pendingOrder.orderDetails?.drop_charge === "number"
          ? Math.max(0, pendingOrder.orderDetails.drop_charge)
          : 0;
        const { selectedProduct, cartItems } = resolveCheckoutProduct(pendingOrder);
        const selectedProductId = pendingOrder.service === "tailoring"
          ? pendingOrder.pricingInput?.productId || pendingOrder.productId || ""
          : selectedProduct?.productId || "";
        const selectedProductPayload = selectedProductId
          ? {
            id: selectedProductId,
            pricingType: pendingOrder.pricingInput?.pricingType
              || selectedProduct?.pricing_type
              || (pendingOrder.service === "fabric" ? "meter" : "piece"),
            name: selectedProduct?.name,
            category: selectedProduct?.category,
            cartItemId: selectedProduct?.id,
          }
          : null;

        console.log("CHECKOUT PRODUCT FULL:", selectedProductPayload);
        console.log("CHECKOUT PRODUCT ID:", selectedProductPayload?.id);

        if ((pendingOrder.service === "fabric" || pendingOrder.service === "dupatta") && !selectedProductPayload?.id) {
          clearPendingPaymentOrder(token);
          throw new Error("Product ID missing in checkout");
        }

        const lineItems = resolveCheckoutLineItems(pendingOrder, cartItems);

        const response = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: selectedProductPayload?.id,
            paymentType: pendingOrder.paymentType,
            pricingType: selectedProductPayload?.pricingType,
            quantityOrMeter: selectedProduct?.selected_quantity ?? pendingOrder.pricingInput?.quantityOrMeter,
            pickupCharge: pendingOrder.pricingInput?.pickupCharge ?? pickupCharge,
            dropCharge: pendingOrder.pricingInput?.dropCharge ?? dropCharge,
            lineItems,
          }),
        });

        const payload = (await response.json()) as PricingApiResponse;
        const resolvedBreakdown = payload.pricingBreakdown
          || (typeof payload.total === "number" ? toSafePricingBreakdown(pendingOrder, payload.total) : null);

        if (!response.ok || !resolvedBreakdown) {
          throw new Error(payload.error || "Unable to calculate pricing.");
        }

        if (!ignore) {
          setPricingBreakdown(resolvedBreakdown);
          setPricingNotice(payload.fallback
            ? "Pricing service was temporarily unavailable. Estimated quote is shown."
            : "");
          setError("");
        }
      } catch (pricingError) {
        if (ignore) {
          return;
        }

        if (pendingOrder.pricingBreakdown) {
          const savedPricing = pendingOrder.pricingBreakdown;
          const safeDiscountAmount = Math.max(0, Number(savedPricing.discountAmount || 0));

          const fallbackFromSession: PricingBreakdown = {
            marketPrice: Number(savedPricing.marketPrice || 0),
            pricingType: savedPricing.pricingType,
            pricePerUnit: Number(savedPricing.pricePerUnit || 0),
            quantityOrMeter: Number(savedPricing.quantityOrMeter || 1),
            totalPrice: Number(savedPricing.totalPrice || 0),
            discountPercentage: Number(savedPricing.discountPercentage || 0),
            discountAmount: safeDiscountAmount,
            finalPrice: Number(savedPricing.finalPrice || 0),
            pickupCharge: Number(savedPricing.pickupCharge || 0),
            dropCharge: Number(savedPricing.dropCharge || 0),
            pickupDropCharge: Number(savedPricing.pickupDropCharge || 0),
            finalPayable: Number(savedPricing.finalPayable || 0),
            advancePercentage: Number(savedPricing.advancePercentage || 20),
            advanceAmount: Number(savedPricing.advanceAmount || 0),
            remainingAmount: Number(savedPricing.remainingAmount || 0),
            savingsText: `You saved INR ${safeDiscountAmount}`,
          };

          setPricingBreakdown(fallbackFromSession);
          setPricingNotice("Live pricing is temporarily unavailable. Using saved checkout pricing.");
          return;
        }

        if (pendingOrder.service === "tailoring") {
          const fallbackBreakdown = calculatePricingBreakdown({
            marketPrice: 1000,
            pricingType: "piece",
            pricePerUnit: 1000,
            quantityOrMeter: 1,
            discountPercentage: 5,
            advancePercentage: 20,
          });
          setPricingBreakdown(fallbackBreakdown);
          setPricingNotice("Pricing service was temporarily unavailable. Estimated quote is shown.");
          return;
        }

        const message = pricingError instanceof Error
          ? pricingError.message
          : "Unable to calculate pricing.";
        setError(message);
      } finally {
        if (!ignore) {
          setPricingLoading(false);
        }
      }
    };

    void recalculatePricing();

    return () => {
      ignore = true;
    };
  }, [pendingOrder]);

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      return;
    }

    const unsubscribe = subscribeToUser(
      user.uid,
      (nextProfile) => {
        setProfile(nextProfile);
      },
      () => {
        setProfile(null);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const payableNow = useMemo(() => {
    if (!pendingOrder || !pricingBreakdown) {
      return 0;
    }

    return pendingOrder.paymentType === "advance"
      ? pricingBreakdown.advanceAmount
      : pricingBreakdown.finalPayable;
  }, [pendingOrder, pricingBreakdown]);

  const getAuthContext = async (): Promise<{ headers: Record<string, string>; uid: string; phone: string }> => {
    if (user?.provider === "mock") {
      const mockPhone = (user.phoneNumber || "").trim();

      if (!mockPhone) {
        throw new Error("Phone number missing from user");
      }

      return {
        headers: {
          Authorization: `Bearer ${createMockAccessToken(user)}`,
        },
        uid: user.uid,
        phone: mockPhone,
      };
    }

    const auth = getFirebaseAuth() || getAuth();
    const currentUser = auth?.currentUser;

    if (!currentUser) {
      throw new Error("User not logged in");
    }

    const tokenValue = await currentUser.getIdToken();
    const phoneValue = (currentUser.phoneNumber || "").trim();

    if (!tokenValue) {
      throw new Error("User token unavailable");
    }

    if (!phoneValue) {
      throw new Error("Phone number missing from user");
    }

    return {
      headers: {
        Authorization: `Bearer ${tokenValue}`,
      },
      uid: currentUser.uid,
      phone: phoneValue,
    };
  };

  const handlePlaceOrder = async () => {
    if (submitting || submitLockRef.current) {
      return;
    }

    if (!user) {
      setError("Please login to place order");
      return;
    }

    setError("");
    setOrderFailed(false);

    if (!pendingOrder || !pricingBreakdown) {
      setError("Order details are missing. Please try again.");
      setOrderFailed(true);
      return;
    }

    if (!pendingOrder.customerName?.trim()) {
      setError("Customer name is required.");
      setOrderFailed(true);
      return;
    }

    if (payableNow <= 0) {
      setError("Invalid payable amount. Please try again.");
      setOrderFailed(true);
      return;
    }

    try {
      setSubmitting(true);
      submitLockRef.current = true;
      const authContext = await getAuthContext();
      const resolvedPhone = authContext.phone;

      const enrichedOrderDetails: OrderDetails = {
        ...(pendingOrder.orderDetails as OrderDetails),
        customer_name: pendingOrder.customerName,
        customer_phone: resolvedPhone,
        customer_address: profile?.address || "",
        customer_measurements: profile?.measurements || {},
        pricing_type: pricingBreakdown.pricingType,
        quantity_or_meter: pricingBreakdown.quantityOrMeter,
        market_price: pricingBreakdown.marketPrice,
        total_price: pricingBreakdown.totalPrice,
        discount_percentage: pricingBreakdown.discountPercentage,
        discount_amount: pricingBreakdown.discountAmount,
        final_price: pricingBreakdown.finalPrice,
        pickup_charge: pricingBreakdown.pickupCharge,
        drop_charge: pricingBreakdown.dropCharge,
        pickup_drop_charge: pricingBreakdown.pickupDropCharge,
        final_payable: pricingBreakdown.finalPayable,
        advance_amount: pricingBreakdown.advanceAmount,
        remaining_amount: pricingBreakdown.remainingAmount,
      };

      const lineItems = pendingOrder.whatsappDetails
        .filter((line) => /fabric|dupatta|item|design|type/i.test(line))
        .slice(0, 5);

      const { selectedProduct } = resolveCheckoutProduct(pendingOrder);
      const product = (pendingOrder.service === "tailoring"
        ? (pendingOrder.pricingInput?.productId || pendingOrder.productId)
        : selectedProduct?.productId)
        ? {
          id: pendingOrder.service === "tailoring"
            ? (pendingOrder.pricingInput?.productId || pendingOrder.productId)
            : selectedProduct?.productId,
          pricingType: pendingOrder.pricingInput?.pricingType
            || selectedProduct?.pricing_type
            || (pendingOrder.service === "fabric" ? "meter" : "piece"),
          name: selectedProduct?.name,
          category: selectedProduct?.category,
          cartItemId: selectedProduct?.id,
        }
        : null;

      console.log("CHECKOUT PRODUCT FULL:", product);
      console.log("CHECKOUT PRODUCT ID:", product?.id);

      if ((pendingOrder.service === "fabric" || pendingOrder.service === "dupatta") && !product?.id) {
        throw new Error("Product ID missing in checkout");
      }

      const paymentId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch("/api/orders/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authContext.headers,
        },
        body: JSON.stringify({
          userId: authContext.uid,
          service: pendingOrder.service,
          phone: resolvedPhone,
          customerPhone: resolvedPhone,
          items: lineItems,
          productId: product?.id,
          total: pricingBreakdown.finalPayable,
          orderDetails: enrichedOrderDetails,
          paymentType: pendingOrder.paymentType,
          amountPaid: payableNow,
          paymentId,
          pricingInput: pendingOrder.pricingInput,
        }),
      });

      const payload = (await response.json()) as FinalizeResponse;

      if (!response.ok || !payload.orderId) {
        throw new Error(payload.error || "Could not create order.");
      }

      if (user.provider === "mock") {
        saveMockOrderFromCheckout({
          userId: authContext.uid,
          phone: resolvedPhone,
          paymentId,
          orderId: payload.orderId,
          orderCode: payload.businessOrderId || payload.orderId,
          pendingOrder,
          pricingBreakdown,
          amountPaid: payableNow,
        });
      }

      if (pendingOrder.service === "fabric" || pendingOrder.service === "dupatta") {
        const cartItemId = pendingOrder.orderDetails?.cart_item_id;
        const cartItemIds = pendingOrder.orderDetails?.cart_item_ids;

        if (typeof cartItemId === "string" && cartItemId.trim()) {
          removeFabricCartItem(cartItemId);
        }

        if (Array.isArray(cartItemIds)) {
          const safeIds = cartItemIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
          removeFabricCartItems(safeIds);
        }
      }

      clearPendingPaymentOrder(token);
      setToastSeverity("success");
      setToastMessage("Order created successfully.");
      router.replace(`/order-success?orderId=${encodeURIComponent(payload.orderId)}&orderCode=${encodeURIComponent(payload.businessOrderId || payload.orderId)}`);
    } catch (placeError) {
      submitLockRef.current = false;
      setOrderFailed(true);
      const message = placeError instanceof Error ? placeError.message : "Could not place order.";
      setError(message);
      setToastSeverity("error");
      setToastMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Stack alignItems="center" py={10} spacing={1.5}>
          <CircularProgress />
          <Typography color="text.secondary">Preparing checkout...</Typography>
        </Stack>
      </Layout>
    );
  }

  if (!user) {
    return <div>Please login to place order</div>;
  }

  return (
    <Layout>
      <Stack spacing={3}>
        <Typography variant="h3">Review & Place Order</Typography>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h5">Order Summary</Typography>

              {pendingOrder ? (
                <Stack spacing={0.8}>
                  <Typography variant="body2" color="text.secondary">
                    Service: {pendingOrder.service}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Customer: {pendingOrder.customerName} ({pendingOrder.customerPhone})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Payment Type: {pendingOrder.paymentType === "advance" ? "Advance" : "Full"}
                  </Typography>
                  {pendingOrder.orderDetails?.measurements ? (
                    <Typography variant="body2" color="text.secondary">
                      Measurements: {JSON.stringify(pendingOrder.orderDetails.measurements)}
                    </Typography>
                  ) : null}
                  {typeof pendingOrder.orderDetails?.fabricDetails === "object" && pendingOrder.orderDetails?.fabricDetails ? (
                    <Typography variant="body2" color="text.secondary">
                      Fabric: {String((pendingOrder.orderDetails.fabricDetails as Record<string, unknown>).fabricType || (pendingOrder.orderDetails.fabricDetails as Record<string, unknown>).productName || "-")}
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}

              <Divider />

              {pricingLoading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">Calculating pricing...</Typography>
                </Stack>
              ) : null}

              {pricingBreakdown ? (
                <Box>
                  <Typography variant="body2" color="text.secondary">Final Price: INR {pricingBreakdown.finalPrice}</Typography>
                  <Typography variant="body2" color="text.secondary">Advance Amount: INR {pricingBreakdown.advanceAmount}</Typography>
                  <Typography variant="body2" color="text.secondary">Remaining Amount: INR {pricingBreakdown.remainingAmount}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
                    Amount processed now: INR {payableNow}
                  </Typography>
                </Box>
              ) : null}

              {pricingNotice ? <Alert severity="warning">{pricingNotice}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              <Alert severity="info">Estimated delivery timeline: 3-5 working days after order confirmation.</Alert>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="outlined" onClick={() => router.back()} disabled={submitting} fullWidth sx={{ minHeight: 44 }}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handlePlaceOrder}
                  disabled={!user || submitting || submitLockRef.current || !pendingOrder || !pricingBreakdown}
                  fullWidth
                  sx={{ minHeight: 44 }}
                >
                  {submitting ? "Placing..." : "Place Order"}
                </Button>
                <Button
                  component="a"
                  href={supportUrl || undefined}
                  target="_self"
                  variant="outlined"
                  color="success"
                  disabled={!supportUrl}
                  fullWidth
                  sx={{ minHeight: 44 }}
                >
                  {supportUrl ? "Need Help?" : "Support number unavailable"}
                </Button>
                {orderFailed ? (
                  <Button variant="outlined" color="warning" onClick={handlePlaceOrder} disabled={submitting} fullWidth sx={{ minHeight: 44 }}>
                    Retry Order
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Snackbar
          open={Boolean(toastMessage)}
          autoHideDuration={2500}
          onClose={() => setToastMessage("")}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert severity={toastSeverity} onClose={() => setToastMessage("")} sx={{ width: "100%" }}>
            {toastMessage}
          </Alert>
        </Snackbar>
      </Stack>
    </Layout>
  );
}
