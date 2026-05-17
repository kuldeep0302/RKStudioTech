"use client";

import { Alert, Box, Button, Card, CardContent, CircularProgress, Divider, FormControl, FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { OrderDetails } from "@/services/orderService";
import { saveOrderToFirestore } from "@/services/orderService";
import { trackAnalyticsEvent } from "@/utils/analytics";
import { RK_STUDIO } from "@/utils/constants";
import { removeFabricCartItem, removeFabricCartItems } from "@/utils/fabricCart";
import { startRazorpayPayment, buildUpiPaymentLink } from "@/utils/payment";
import { clearPendingPaymentOrder, readPendingPaymentOrder } from "@/utils/paymentSession";
import { buildWhatsAppUrl } from "@/utils/whatsapp";

type PaymentMethod = "razorpay" | "upi";

const amountOptions = [100, 200, 300];

export default function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("razorpay");
  const [selectedAdvanceAmount, setSelectedAdvanceAmount] = useState(RK_STUDIO.payment.tailoringAdvanceDefault);
  const [upiReference, setUpiReference] = useState("");
  const [upiStarted, setUpiStarted] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<ReturnType<typeof readPendingPaymentOrder>>(null);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(true);
  const allowUpiFallback = Boolean(RK_STUDIO.payment.upiId);

  useEffect(() => {
    if (!token) {
      setError("Payment session nahi mili. Dobara order shuru karein.");
      setLoading(false);
      return;
    }

    const pending = readPendingPaymentOrder(token);

    if (!pending) {
      setError("Payment session expire ho gayi. Dobara order shuru karein.");
      setLoading(false);
      return;
    }

    setPendingOrder(pending);
    if (pending.service === "tailoring") {
      const withinRange = Math.min(
        RK_STUDIO.payment.tailoringAdvanceMax,
        Math.max(RK_STUDIO.payment.tailoringAdvanceMin, pending.amount),
      );
      setSelectedAdvanceAmount(withinRange);
    }
    setLoading(false);
  }, [token]);

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
    if (!pendingOrder) {
      return 0;
    }

    if (pendingOrder.service === "tailoring") {
      return selectedAdvanceAmount;
    }

    return pendingOrder.amount;
  }, [pendingOrder, selectedAdvanceAmount]);

  const paymentLabel = useMemo(() => {
    if (!pendingOrder) {
      return "";
    }

    return pendingOrder.paymentType === "advance" ? "Advance De Diya" : "Pura De Diya";
  }, [pendingOrder]);

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
      return "Payment session missing hai.";
    }

    if (pendingOrder.service === "tailoring") {
      if (
        selectedAdvanceAmount < RK_STUDIO.payment.tailoringAdvanceMin ||
        selectedAdvanceAmount > RK_STUDIO.payment.tailoringAdvanceMax
      ) {
        return `Advance ₹${RK_STUDIO.payment.tailoringAdvanceMin} se ₹${RK_STUDIO.payment.tailoringAdvanceMax} ke beech hona chahiye.`;
      }
    }

    if (pendingOrder.service === "fabric" && finalAmount !== pendingOrder.amount) {
      return "Kapda ke daam galat hain.";
    }

    return "";
  };

  const handleFinalizeOrder = async (paymentId: string) => {
    if (!pendingOrder || orderConfirmed) {
      return;
    }

    await saveOrderToFirestore({
      userId: pendingOrder.userId,
      service: pendingOrder.service,
      productId: pendingOrder.productId,
      orderDetails: pendingOrder.orderDetails as OrderDetails,
      paymentStatus: "paid",
      paymentType: pendingOrder.paymentType,
      amountPaid: finalAmount,
      paymentId,
    });

    void trackAnalyticsEvent("payment_success", {
      service: pendingOrder.service,
      payment_method: paymentMethod,
      payment_type: pendingOrder.paymentType || "full",
      value: finalAmount,
    });

    const whatsappDetails = [...pendingOrder.whatsappDetails, `Payment: ${paymentLabel} (INR ${finalAmount})`];

    setSuccess("Payment safal ho gayi. Hum WhatsApp par contact karenge.");
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

    setWhatsappUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handlePayAndConfirm = async () => {
    setError("");
    setSuccess("");

    const validationError = validateAmount();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!pendingOrder) {
      setError("Payment session missing hai.");
      return;
    }

    try {
      setSubmitting(true);

      if (paymentMethod === "razorpay") {
        const razorpayPayment = await startRazorpayPayment({
          amount: finalAmount,
          description: `${pendingOrder.service === "tailoring" ? "Silai advance" : "Kapda full payment"} - RK Studio`,
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
          throw new Error(verifyPayload.error || "Payment verify nahi ho payi. Dobara payment karein.");
        }

        await handleFinalizeOrder(razorpayPayment.razorpay_payment_id);
        return;
      }

      if (!allowUpiFallback) {
        setError("UPI fallback production me disabled hai. Razorpay use karein.");
        return;
      }

      if (!upiStarted) {
        const upiLink = buildUpiPaymentLink({
          amount: finalAmount,
          note: `${pendingOrder.service} payment`,
        });
        window.location.href = upiLink;
        setUpiStarted(true);
        setError("UPI payment ke baad UTR/reference dalein aur fir se Confirm karein.");
        return;
      }

      if (!upiReference.trim()) {
        setError("Payment confirm karne ke liye UPI UTR/reference dalein.");
        return;
      }

      await handleFinalizeOrder(`upi-${upiReference.trim()}`);
    } catch (paymentError) {
      const message = paymentError instanceof Error ? paymentError.message : "Payment fail ho gayi. Dobara koshish karein.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderTitle = () => {
    if (!pendingOrder) {
      return "Payment";
    }

    if (pendingOrder.service === "tailoring") {
      return "Silai order confirm karne ke liye advance de";
    }

    return "Order confirm karne ke liye full payment de";
  };

  if (loading) {
    return (
      <Layout>
        <Stack alignItems="center" py={10} spacing={1.5}>
          <CircularProgress />
          <Typography color="text.secondary">Payment taiyar ho rahi hai...</Typography>
        </Stack>
      </Layout>
    );
  }

  return (
    <Layout>
      <Stack spacing={3}>
        <Typography variant="h3">Payment karein</Typography>

        <Card>
          <CardContent>
            <Stack spacing={2.5}>
              <Typography variant="h5">{renderTitle()}</Typography>

              {!paymentConfigLoading && !razorpayEnabled ? (
                <Alert severity="warning">
                  Online card payment is temporarily unavailable. Please continue with UPI payment.
                </Alert>
              ) : null}

              {pendingOrder?.service === "tailoring" ? (
                <FormControl>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    Advance amount chune:
                  </Typography>
                  <RadioGroup
                    value={selectedAdvanceAmount}
                    onChange={(event) => setSelectedAdvanceAmount(Number(event.target.value))}
                  >
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                      {amountOptions.map((amount) => (
                        <FormControlLabel
                          key={amount}
                          value={amount}
                          control={<Radio />}
                          label={`INR ${amount}`}
                        />
                      ))}
                    </Stack>
                  </RadioGroup>
                </FormControl>
              ) : null}

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle1">Order ki jankari</Typography>
                <Typography variant="body2" color="text.secondary">
                  Service: {pendingOrder?.service === "tailoring" ? "Silai" : pendingOrder?.service === "dupatta" ? "Suit" : "Kapda"}
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
                <Typography variant="body2" color="text.secondary">
                  Dene wali rakam: INR {finalAmount}
                </Typography>
              </Stack>

              <Divider />

              <FormControl>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  Payment ka tareeka
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
                    ? "Razorpay abhi setup nahi hai. Filhal UPI mode chalu hai."
                    : "Razorpay setup missing hai. Production payment ke liye Razorpay configure karein."}
                </Alert>
              ) : null}

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
                Koi dikkat ho to WhatsApp karein. Hum madad ke liye yahan hain.
              </Typography>

              {success ? <Alert severity="success">{success}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button variant="outlined" onClick={() => router.back()} disabled={submitting}>
                  Peeche
                </Button>
                <Button variant="contained" onClick={handlePayAndConfirm} disabled={submitting || orderConfirmed}>
                  {submitting ? "Process ho raha hai..." : "Pay aur Confirm karein"}
                </Button>
                {success && whatsappUrl ? (
                  <Button
                    variant="outlined"
                    color="success"
                    onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
                  >
                    WhatsApp dobara kholein
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
