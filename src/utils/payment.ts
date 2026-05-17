import { RK_STUDIO } from "@/utils/constants";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, callback: (response: unknown) => void) => void;
    };
  }
}

type RazorpayPaymentSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayPaymentFailed = {
  error?: {
    description?: string;
  };
};

type RazorpayPrefill = {
  name?: string;
  contact?: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: RazorpayPrefill;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayPaymentSuccess) => void;
};

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let cachedRazorpayKey: string | null = null;

export const getRazorpayKeyId = async () => {
  if (cachedRazorpayKey) {
    return cachedRazorpayKey;
  }

  const response = await fetch("/api/payments/razorpay/config", {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json()) as { enabled?: boolean; keyId?: string };

  if (!response.ok || !payload.enabled || !payload.keyId) {
    throw new Error("Razorpay key is missing on server.");
  }

  cachedRazorpayKey = payload.keyId;
  return cachedRazorpayKey;
};

const loadRazorpayScript = async () => {
  if (typeof window === "undefined") {
    throw new Error("Payment is only available in browser.");
  }

  if (window.Razorpay) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src=\"${RAZORPAY_SCRIPT_URL}\"]`);

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load payment gateway.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load payment gateway."));
    document.body.appendChild(script);
  });

  if (!window.Razorpay) {
    throw new Error("Payment gateway is not available.");
  }
};

export const startRazorpayPayment = async ({
  amount,
  description,
  customerName,
  customerPhone,
}: {
  amount: number;
  description: string;
  customerName?: string;
  customerPhone?: string;
}) => {
  const key = await getRazorpayKeyId();

  await loadRazorpayScript();

  const orderResponse = await fetch("/api/payments/razorpay/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      receipt: `rkstudio_${Date.now()}`,
    }),
  });

  const orderPayload = (await orderResponse.json()) as { orderId?: string; error?: string };

  if (!orderResponse.ok || !orderPayload.orderId) {
    throw new Error(orderPayload.error || "Unable to create payment order.");
  }

  const orderId = orderPayload.orderId;

  return await new Promise<RazorpayPaymentSuccess>((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Payment gateway is not available."));
      return;
    }

    const options: RazorpayOptions = {
      key,
      amount: Math.round(amount * 100),
      currency: RK_STUDIO.payment.currency,
      order_id: orderId,
      name: RK_STUDIO.name,
      description,
      prefill: {
        name: customerName,
        contact: customerPhone,
      },
      theme: {
        color: "#1E3A8A",
      },
      handler: (response) => {
        resolve(response);
      },
    };

    const razorpay = new window.Razorpay(options);

    razorpay.on("payment.failed", (response: unknown) => {
      const payload = response as RazorpayPaymentFailed;
      reject(new Error(payload.error?.description || "Payment failed. Please try again."));
    });

    razorpay.open();
  });
};

export const buildUpiPaymentLink = ({
  amount,
  note,
}: {
  amount: number;
  note: string;
}) => {
  const params = new URLSearchParams({
    pa: RK_STUDIO.payment.upiId,
    pn: RK_STUDIO.payment.upiPayeeName,
    am: amount.toFixed(2),
    cu: RK_STUDIO.payment.currency,
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
};
