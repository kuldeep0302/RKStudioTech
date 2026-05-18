"use client";

import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, FormControl, FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { OrderDetails } from "@/services/orderService";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth } from "@/services/firebase";
import { trackAnalyticsEvent } from "@/utils/analytics";
import { RK_STUDIO } from "@/utils/constants";
import { removeFabricCartItem, removeFabricCartItems } from "@/utils/fabricCart";
import { startRazorpayPayment, buildUpiPaymentLink } from "@/utils/payment";
import { clearPendingPaymentOrder, readPendingPaymentOrder } from "@/utils/paymentSession";
import { calculatePricingBreakdown, PricingBreakdown } from "@/utils/pricing";
import { buildWhatsAppUrl } from "@/utils/whatsapp";

type PaymentMethod = "razorpay" | "upi";

export default function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingNotice, setPricingNotice] = useState("");
  const [upiReference, setUpiReference] = useState("");
  const [upiStarted, setUpiStarted] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<ReturnType<typeof readPendingPaymentOrder>>(null);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(true);
  const allowUpiFallback = Boolean(RK_STUDIO.payment.upiId);
  const actionButtonDisabledSx = {
    "&.Mui-disabled": {
      opacity: 0.55,
      cursor: "not-allowed",
      pointerEvents: "auto",
    },
  };

  const openExternalLink = (url: string, source: string) => {
    if (typeof window === "undefined") {
      return;
    }

    console.info("[checkout] opening external link", { source, url });

    const popup = window.open(url, "_blank", "noopener,noreferrer");

    if (!popup) {
      window.location.href = url;
    }
  };

    useEffect(() => {
    if (!token) {
      setError("Payment session not found. Please start your order again.");
      setLoading(false);
      return;
    }

    const pending = readPendingPaymentOrder(token);

    if (!pending) {
      setError("Payment session expired. Please start your order again.");
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

        const response = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            service: pendingOrder.service,
            paymentType: pendingOrder.paymentType,
            productId: pendingOrder.pricingInput?.productId || pendingOrder.productId,
            pricingType: pendingOrder.pricingInput?.pricingType,
            pickupCharge: pendingOrder.pricingInput?.pickupCharge ?? pickupCharge,
            dropCharge: pendingOrder.pricingInput?.dropCharge ?? dropCharge,
            lineItems: pendingOrder.pricingInput?.lineItems,
          }),
        });

        const payload = (await response.json()) as {
          breakdown?: PricingBreakdown;
          error?: string;
          fallbackUsed?: boolean;
        };

        if (!response.ok || !payload.breakdown) {
          throw new Error(payload.error || "Unable to calculate pricing.");
        }

        if (!ignore) {
          setPricingBreakdown(payload.breakdown);
          setPricingNotice(payload.fallbackUsed
            ? "Pricing service was temporarily unavailable. Estimated tailoring quote is shown."
            : "");
        }
      } catch (pricingError) {
        if (!ignore) {
          if (pendingOrder.service === "tailoring") {
            const fallbackPickupCharge = typeof pendingOrder.orderDetails?.pickup_charge === "number"
              ? Math.max(0, pendingOrder.orderDetails.pickup_charge)
              : 0;
            const fallbackDropCharge = typeof pendingOrder.orderDetails?.drop_charge === "number"
              ? Math.max(0, pendingOrder.orderDetails.drop_charge)
              : 0;
            const fallbackBreakdown = calculatePricingBreakdown({
              marketPrice: 1000,
              pricingType: "piece",
              pricePerUnit: 1000,
              quantityOrMeter: 1,
              discountPercentage: 5,
              advancePercentage: 20,
              pickupCharge: pendingOrder.pricingInput?.pickupCharge ?? fallbackPickupCharge,
              dropCharge: pendingOrder.pricingInput?.dropCharge ?? fallbackDropCharge,
            });

            setPricingBreakdown(fallbackBreakdown);
            setPricingNotice("Pricing service was temporarily unavailable. Estimated tailoring quote is shown.");
          } else {
            const message = pricingError instanceof Error
              ? pricingError.message
              : "Unable to calculate pricing.";
            setError(message);
          }
        }
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
    let ignore = false;

    const loadRazorpayConfig = async () => {
      try {
        const response = await fetch("/api/payments/razorpay/config", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as { enabled?: boolean };

        if (ignore) {
          return;
        }

        const enabled = Boolean(response.ok && payload.enabled);
        setRazorpayEnabled(enabled);

        if (!enabled && allowUpiFallback) {
          setPaymentMethod("upi");
        }
      } catch {
        if (ignore) {
          return;
        }

        setRazorpayEnabled(false);
        if (allowUpiFallback) {
          setPaymentMethod("upi");
        }
      } finally {
        if (!ignore) {
          setPaymentConfigLoading(false);
        }
      }
    };

    void loadRazorpayConfig();

    return () => {
      ignore = true;
    };
  }, [allowUpiFallback]);

  const finalAmount = useMemo(() => {
    if (!pendingOrder || !pricingBreakdown) {
      return 0;
    }

    if (pendingOrder.paymentType === "advance") {
      return pricingBreakdown.advanceAmount;
    }

    return pricingBreakdown.finalPayable;
  }, [pendingOrder, pricingBreakdown]);

  const pickupChargeFromOrder = useMemo(() => {
    if (!pendingOrder || typeof pendingOrder.orderDetails?.pickup_charge !== "number") {
      return 0;
    }

    return Math.max(0, pendingOrder.orderDetails.pickup_charge);
  }, [pendingOrder]);

  const dropChargeFromOrder = useMemo(() => {
    if (!pendingOrder || typeof pendingOrder.orderDetails?.drop_charge !== "number") {
      return 0;
    }

    return Math.max(0, pendingOrder.orderDetails.drop_charge);
  }, [pendingOrder]);

  const paymentLabel = useMemo(() => {
    if (!pendingOrder) {
      return "";
    }

    return pendingOrder.paymentType === "advance" ? "Advance Paid" : "Paid in Full";
  }, [pendingOrder]);

  const hasValidPaymentSession = useMemo(() => {
    return Boolean(token && pendingOrder);
  }, [pendingOrder, token]);

  const fabricPricePerMeter =
    (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
      && typeof pendingOrder.orderDetails?.price_per_unit === "number"
      ? pendingOrder.orderDetails.price_per_unit
      : (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
        && typeof pendingOrder.orderDetails?.price_per_meter === "number"
        ? pendingOrder.orderDetails.price_per_meter
      : null;
  const fabricSelectedMeter =
    (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
      && typeof pendingOrder.orderDetails?.selected_quantity === "number"
      ? pendingOrder.orderDetails.selected_quantity
      : (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
        && typeof pendingOrder.orderDetails?.selected_meter === "number"
        ? pendingOrder.orderDetails.selected_meter
      : null;
  const fabricTotalPrice =
    (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
      && typeof pendingOrder.orderDetails?.total_price === "number"
      ? pendingOrder.orderDetails.total_price
      : null;
  const unitLabel =
    (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
      && typeof pendingOrder.orderDetails?.unit_label === "string"
      ? pendingOrder.orderDetails.unit_label
      : "unit";
  const fabricCheckoutMode =
    (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
      && typeof pendingOrder.orderDetails?.checkout_mode === "string"
      ? pendingOrder.orderDetails.checkout_mode
      : null;
  const fabricItemCount =
    (pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta")
      && typeof pendingOrder.orderDetails?.item_count === "number"
      ? pendingOrder.orderDetails.item_count
      : null;

  const validateAmount = () => {
    if (!pendingOrder) {
      return "Payment session is missing.";
    }

    if (!pricingBreakdown) {
      return "Pricing summary is not available. Please try again.";
    }

    if (pricingBreakdown.totalPrice <= 0 || pricingBreakdown.finalPayable <= 0) {
      return "Invalid pricing detected. Please review product details and try again.";
    }

    if (finalAmount <= 0) {
      return "Invalid payable amount.";
    }

    return "";
  };

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (user?.provider === "mock") {
      return {
        Authorization: `Bearer mock:${user.uid}:${user.role || "user"}`,
      };
    }

    const auth = getFirebaseAuth();
    const tokenValue = await auth?.currentUser?.getIdToken();

    if (!tokenValue) {
      return {};
    }

    return {
      Authorization: `Bearer ${tokenValue}`,
    };
  };

  const handleFinalizeOrder = async (paymentId: string) => {
    if (!pendingOrder || !pricingBreakdown || orderConfirmed) {
      return;
    }

    const enrichedOrderDetails: OrderDetails = {
      ...(pendingOrder.orderDetails as OrderDetails),
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

    const finalizeResponse = await fetch("/api/orders/finalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({
        userId: pendingOrder.userId,
        service: pendingOrder.service,
        productId: pendingOrder.productId,
        orderDetails: enrichedOrderDetails,
        paymentType: pendingOrder.paymentType,
        amountPaid: finalAmount,
        paymentId,
        pricingInput: {
          ...pendingOrder.pricingInput,
          pickupCharge: pendingOrder.pricingInput?.pickupCharge ?? pickupChargeFromOrder,
          dropCharge: pendingOrder.pricingInput?.dropCharge ?? dropChargeFromOrder,
        },
      }),
    });

    const finalizePayload = (await finalizeResponse.json()) as { error?: string };

    if (!finalizeResponse.ok) {
      throw new Error(finalizePayload.error || "Could not finalize order.");
    }

    void trackAnalyticsEvent("payment_success", {
      service: pendingOrder.service,
      payment_method: paymentMethod,
      payment_type: pendingOrder.paymentType || "full",
      value: finalAmount,
    });

    const whatsappDetails = [
      ...pendingOrder.whatsappDetails,
      `Market Price: INR ${pricingBreakdown.marketPrice}`,
      `Discount: INR ${pricingBreakdown.discountAmount} (${pricingBreakdown.discountPercentage}%)`,
      `Final Price: INR ${pricingBreakdown.finalPrice}`,
      `Pickup Charge: INR ${pricingBreakdown.pickupCharge}`,
      `Drop Charge: INR ${pricingBreakdown.dropCharge}`,
      `Total Payable: INR ${pricingBreakdown.finalPayable}`,
      `Advance: INR ${pricingBreakdown.advanceAmount}`,
      `Remaining: INR ${pricingBreakdown.remainingAmount}`,
      `Payment: ${paymentLabel} (INR ${finalAmount})`,
    ];

    setSuccess("Payment successful. We will contact you on WhatsApp.");
    setOrderConfirmed(true);

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

    const url = buildWhatsAppUrl({
      name: pendingOrder.customerName,
      phone: pendingOrder.customerPhone,
      service: pendingOrder.service,
      details: whatsappDetails,
    });

    if (!url) {
      setError("Service temporarily unavailable");
      return;
    }

    setWhatsappUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handlePayAndConfirm = async () => {
    console.info("[checkout] pay and confirm clicked", {
      method: paymentMethod,
      token,
      hasPendingOrder: Boolean(pendingOrder),
      hasPricingBreakdown: Boolean(pricingBreakdown),
    });

    setError("");
    setSuccess("");

    const validationError = validateAmount();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!pendingOrder) {
      setError("Payment session is missing.");
      return;
    }

    try {
      setSubmitting(true);

      if (paymentMethod === "razorpay") {
        const razorpayPayment = await startRazorpayPayment({
          amount: finalAmount,
          description: `${pendingOrder.service === "tailoring" ? "Tailoring advance" : "Fabric full payment"} - RK Studio`,
          customerName: pendingOrder.customerName,
          customerPhone: pendingOrder.customerPhone,
        });

        const verifyResponse = await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            razorpay_order_id: razorpayPayment.razorpay_order_id,
            razorpay_payment_id: razorpayPayment.razorpay_payment_id,
            razorpay_signature: razorpayPayment.razorpay_signature,
          }),
        });

        const verifyPayload = (await verifyResponse.json()) as {
          verified?: boolean;
          error?: string;
        };

        if (!verifyResponse.ok || !verifyPayload.verified) {
          throw new Error(verifyPayload.error || "Payment verification failed. Please try payment again.");
        }

        await handleFinalizeOrder(razorpayPayment.razorpay_payment_id);
        return;
      }

      if (!allowUpiFallback) {
        setError("UPI fallback is disabled in this environment. Please use Razorpay.");
        return;
      }

      if (!upiStarted) {
        const upiLink = buildUpiPaymentLink({
          amount: finalAmount,
          note: `${pendingOrder.service} payment`,
        });
        openExternalLink(upiLink, "upi");
        setUpiStarted(true);
        setError("After UPI payment, enter the UTR/reference and confirm again.");
        return;
      }

      if (!upiReference.trim()) {
        setError("Please enter UPI UTR/reference to confirm payment.");
        return;
      }

      await handleFinalizeOrder(`upi-${upiReference.trim()}`);
    } catch (paymentError) {
      const message = paymentError instanceof Error ? paymentError.message : "Payment failed. Please try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueWithWhatsAppPayment = () => {
    console.info("[checkout] whatsapp manual payment clicked", {
      token,
      hasPendingOrder: Boolean(pendingOrder),
      hasPricingBreakdown: Boolean(pricingBreakdown),
    });

    setError("");
    setSuccess("");

    if (!pendingOrder) {
      setError("Payment details are not ready yet. Please try again.");
      return;
    }

    const fallbackBreakdown = pricingBreakdown || {
      marketPrice: finalAmount,
      discountAmount: 0,
      discountPercentage: 0,
      finalPrice: finalAmount,
      pickupCharge: pickupChargeFromOrder,
      dropCharge: dropChargeFromOrder,
      finalPayable: finalAmount,
      advanceAmount: finalAmount,
      remainingAmount: 0,
    };

    const manualPaymentDetails = [
      ...pendingOrder.whatsappDetails,
      `Market Price: INR ${fallbackBreakdown.marketPrice}`,
      `Discount: INR ${fallbackBreakdown.discountAmount} (${fallbackBreakdown.discountPercentage}%)`,
      `Final Price: INR ${fallbackBreakdown.finalPrice}`,
      `Pickup Charge: INR ${fallbackBreakdown.pickupCharge}`,
      `Drop Charge: INR ${fallbackBreakdown.dropCharge}`,
      `Total Payable: INR ${fallbackBreakdown.finalPayable}`,
      `Advance: INR ${fallbackBreakdown.advanceAmount}`,
      `Remaining: INR ${fallbackBreakdown.remainingAmount}`,
      `Requested Payment: ${paymentLabel} (INR ${finalAmount})`,
      "Payment Mode: Manual via WhatsApp (online payment not working)",
      "Please share payment scanner / QR and next steps.",
    ];

    const phone = RK_STUDIO.whatsappNumber || "918901501572";
    const directMessage = encodeURIComponent(`Order ID: ${token}\nAmount: ₹${fallbackBreakdown.finalPayable || 0}\n\nHi, I want to confirm my order via WhatsApp.`);
    const directUrl = `https://wa.me/${phone}?text=${directMessage}`;
    console.info("[checkout] whatsapp manual payment url", { directUrl, phone });

    const url = buildWhatsAppUrl({
      name: pendingOrder.customerName,
      phone: pendingOrder.customerPhone,
      service: pendingOrder.service,
      details: manualPaymentDetails,
    });

    void trackAnalyticsEvent("payment_fallback_whatsapp", {
      service: pendingOrder.service,
      payment_type: pendingOrder.paymentType || "full",
      value: finalAmount,
    });

    setSuccess("Online payment is not working right now. Continue payment on WhatsApp with scanner/QR support.");
    openExternalLink(url || directUrl, "manual-whatsapp");
  };

  const renderTitle = () => {
    if (!pendingOrder) {
      return "Payment";
    }

    if (pendingOrder.service === "tailoring") {
      return "Pay advance to confirm your tailoring order";
    }

    return "Pay full amount to confirm your order";
  };

  if (loading) {
    return (
      <Layout>
        <Stack alignItems="center" py={10} spacing={1.5}>
          <CircularProgress />
          <Typography color="text.secondary">Preparing payment...</Typography>
        </Stack>
      </Layout>
    );
  }

  return (
    <Layout>
      <Stack spacing={3}>
        <Typography variant="h3">Complete Payment</Typography>

        <Card>
          <CardContent>
            <Stack spacing={2.5} sx={{ textAlign: "left" }}>
              <Typography variant="h5">{renderTitle()}</Typography>

              {!paymentConfigLoading && !razorpayEnabled ? (
                <Alert severity="warning">
                  {allowUpiFallback
                    ? "Online card payment is temporarily unavailable. Please continue with UPI payment."
                    : "Online card payment is temporarily unavailable. Please try again later."}
                </Alert>
              ) : null}

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle1">Order Summary</Typography>
                <Typography variant="body2" color="text.secondary">
                  Service: {pendingOrder?.service === "tailoring" ? "Tailoring" : pendingOrder?.service === "dupatta" ? "Suit" : "Fabric"}
                </Typography>
                {(pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta") && fabricPricePerMeter !== null && fabricSelectedMeter !== null ? (
                  <Typography variant="body2" color="text.secondary">
                    Price formula: INR {fabricPricePerMeter} x {fabricSelectedMeter} {unitLabel} = INR {fabricTotalPrice ?? finalAmount}
                  </Typography>
                ) : null}
                {(pendingOrder?.service === "fabric" || pendingOrder?.service === "dupatta") && fabricCheckoutMode === "cart_all" && fabricItemCount !== null ? (
                  <Typography variant="body2" color="text.secondary">
                    Combined cart checkout: {fabricItemCount} items | Total INR {fabricTotalPrice ?? finalAmount}
                  </Typography>
                ) : null}
                <Typography variant="body2" color="text.secondary">
                  Payment Type: {pendingOrder?.paymentType === "advance" ? "Advance" : "Full"}
                </Typography>
                {pricingLoading ? <Typography variant="body2" color="text.secondary">Calculating pricing...</Typography> : null}

                {pricingBreakdown ? (
                  <Card variant="outlined" sx={{ mt: 1, borderColor: "success.light", bgcolor: "#F8FFFB" }}>
                    <CardContent>
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                          <Typography variant="body2" color="text.secondary">Market Price:</Typography>
                          <Typography variant="body2" sx={{ textDecoration: pricingBreakdown.discountAmount > 0 ? "line-through" : "none", color: "text.disabled" }}>
                            INR {pricingBreakdown.marketPrice}
                          </Typography>
                          {pricingBreakdown.discountAmount > 0 ? (
                            <Chip label={`${pricingBreakdown.discountPercentage}% OFF`} size="small" color="success" />
                          ) : null}
                        </Stack>

                        <Typography variant="body2" color="success.main">
                          Discount: -INR {pricingBreakdown.discountAmount} ({pricingBreakdown.discountPercentage}% OFF)
                        </Typography>

                        <Typography variant="h6" sx={{ fontWeight: 800, color: "primary.main" }}>
                          Final Price: INR {pricingBreakdown.finalPrice}
                        </Typography>

                        {(pricingBreakdown.pickupCharge > 0 || pricingBreakdown.dropCharge > 0) ? (
                          <Typography variant="body2" color="text.secondary">
                            Pickup/Drop Charges: INR {pricingBreakdown.pickupDropCharge}
                          </Typography>
                        ) : null}

                        <Typography variant="h6" sx={{ fontWeight: 800, color: "success.main" }}>
                          Total Payable: INR {pricingBreakdown.finalPayable}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                          Pay Now: INR {pricingBreakdown.advanceAmount}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Pay after delivery: INR {pricingBreakdown.remainingAmount}
                        </Typography>
                        <Typography variant="caption" color="success.main">
                          You saved INR {pricingBreakdown.discountAmount}
                        </Typography>

                        {pricingBreakdown.pickupDropCharge > 0 ? (
                          <Typography variant="caption" color="info.main">
                            Pickup/Drop charge included
                          </Typography>
                        ) : null}

                        <Typography variant="body2" color="text.secondary">
                          Amount to pay now: INR {finalAmount}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                ) : null}
              </Stack>

              <Divider />

              <FormControl>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Payment Method
                </Typography>
                <RadioGroup
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                >
                  <FormControlLabel
                    value="razorpay"
                    control={<Radio />}
                    label="Razorpay (best)"
                    disabled={!razorpayEnabled || paymentConfigLoading}
                  />
                  <FormControlLabel
                    value="upi"
                    control={<Radio />}
                    label={allowUpiFallback ? "UPI" : "UPI (dev only)"}
                    disabled={!allowUpiFallback || paymentConfigLoading}
                  />
                </RadioGroup>
              </FormControl>

              {!razorpayEnabled ? (
                <Alert severity="info">
                  {allowUpiFallback
                    ? "Razorpay is not configured right now. UPI mode is active."
                    : "Razorpay setup is missing. Configure Razorpay for production payments."}
                </Alert>
              ) : null}

              <Alert severity="info">
                If online payment is not working, you can continue manually on WhatsApp and complete payment with scanner/QR support.
              </Alert>

              {paymentMethod === "upi" ? (
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    UPI ID: {RK_STUDIO.payment.upiId}
                  </Typography>
                  <TextField
                    fullWidth
                    label="UPI UTR / Reference"
                    value={upiReference}
                    onChange={(event) => setUpiReference(event.target.value)}
                  />
                </Box>
              ) : null}

              <Typography variant="caption" color="text.secondary">
                Need help? Contact us on WhatsApp.
              </Typography>

              {success ? <Alert severity="success">{success}</Alert> : null}
              {pricingNotice ? <Alert severity="warning">{pricingNotice}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="outlined" onClick={() => router.back()} disabled={submitting}>
                  Back
                </Button>
                <Button
                  variant="contained"
                  onClick={handlePayAndConfirm}
                  disabled={submitting || orderConfirmed || !hasValidPaymentSession}
                  sx={actionButtonDisabledSx}
                >
                  {submitting ? "Processing..." : "Pay and Confirm"}
                </Button>
                <Button
                  variant="outlined"
                  color="success"
                  onClick={handleContinueWithWhatsAppPayment}
                  disabled={submitting || orderConfirmed || !hasValidPaymentSession}
                  sx={actionButtonDisabledSx}
                >
                  Continue via WhatsApp Payment
                </Button>
                {success && whatsappUrl ? (
                  <Button
                    variant="outlined"
                    color="success"
                    onClick={() => openExternalLink(whatsappUrl, "open-whatsapp-again")}
                  >
                    Open WhatsApp Again
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Layout>
  );
}
