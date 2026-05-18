export type PendingPaymentService = "tailoring" | "fabric" | "dupatta";

export type PendingPaymentPricingInput = {
  productId?: string;
  pricingType?: "meter" | "piece";
  quantityOrMeter?: number;
  pickupCharge?: number;
  dropCharge?: number;
  lineItems?: Array<{
    productId: string;
    quantityOrMeter: number;
  }>;
};

export type PendingPaymentPricingBreakdown = {
  marketPrice: number;
  pricingType: "meter" | "piece";
  pricePerUnit: number;
  quantityOrMeter: number;
  totalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  pickupCharge: number;
  dropCharge: number;
  pickupDropCharge: number;
  finalPayable: number;
  advancePercentage: number;
  advanceAmount: number;
  remainingAmount: number;
};

export type PendingPaymentOrder = {
  service: PendingPaymentService;
  userId: string;
  customerName: string;
  customerPhone: string;
  orderDetails: Record<string, unknown>;
  productId?: string;
  amount: number;
  paymentType: "advance" | "full";
  pricingInput?: PendingPaymentPricingInput;
  pricingBreakdown?: PendingPaymentPricingBreakdown;
  whatsappDetails: string[];
};

const PAYMENT_STORAGE_PREFIX = "rkstudio_pending_payment_";

const getPaymentStorageKey = (token: string) => `${PAYMENT_STORAGE_PREFIX}${token}`;

const writeToStorage = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
    return;
  } catch (error) {
    console.warn("[payment-session] sessionStorage write failed, falling back to localStorage", {
      key,
      error,
    });
  }

  window.localStorage.setItem(key, value);
};

const readFromStorage = (key: string) => {
  if (typeof window === "undefined") {
    return null as string | null;
  }

  try {
    const fromSession = window.sessionStorage.getItem(key);

    if (fromSession) {
      return fromSession;
    }
  } catch (error) {
    console.warn("[payment-session] sessionStorage read failed", { key, error });
  }

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn("[payment-session] localStorage read failed", { key, error });
    return null as string | null;
  }
};

const removeFromStorage = (key: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch (error) {
    console.warn("[payment-session] sessionStorage remove failed", { key, error });
  }

  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("[payment-session] localStorage remove failed", { key, error });
  }
};

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

  const key = getPaymentStorageKey(token);

  try {
    writeToStorage(key, JSON.stringify(payload));
    console.info("[payment-session] saved", { token });
  } catch (error) {
    console.error("[payment-session] failed to save", { token, error });
    throw new Error("Could not save payment session.");
  }
};

export const readPendingPaymentOrder = (token: string) => {
  if (typeof window === "undefined") {
    return null as PendingPaymentOrder | null;
  }

  try {
    const raw = readFromStorage(getPaymentStorageKey(token));

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

  removeFromStorage(getPaymentStorageKey(token));
};
