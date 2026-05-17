export type PendingPaymentService = "tailoring" | "fabric" | "dupatta";

export type PendingPaymentOrder = {
  service: PendingPaymentService;
  userId: string;
  customerName: string;
  customerPhone: string;
  orderDetails: Record<string, unknown>;
  productId?: string;
  amount: number;
  paymentType: "advance" | "full";
  whatsappDetails: string[];
};

const PAYMENT_STORAGE_PREFIX = "rkstudio_pending_payment_";

export const createPendingPaymentToken = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const savePendingPaymentOrder = (token: string, payload: PendingPaymentOrder) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(`${PAYMENT_STORAGE_PREFIX}${token}`, JSON.stringify(payload));
};

export const readPendingPaymentOrder = (token: string) => {
  if (typeof window === "undefined") {
    return null as PendingPaymentOrder | null;
  }

  try {
    const raw = window.sessionStorage.getItem(`${PAYMENT_STORAGE_PREFIX}${token}`);

    if (!raw) {
      return null as PendingPaymentOrder | null;
    }

    return JSON.parse(raw) as PendingPaymentOrder;
  } catch {
    return null as PendingPaymentOrder | null;
  }
};

export const clearPendingPaymentOrder = (token: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(`${PAYMENT_STORAGE_PREFIX}${token}`);
};
