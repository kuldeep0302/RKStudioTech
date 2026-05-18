import { PricingBreakdown } from "@/utils/pricing";
import { PendingPaymentOrder } from "@/utils/paymentSession";
import { UserOrder } from "@/services/orderService";

const MOCK_ORDER_STORAGE_KEY = "rkstudio_mock_orders_v1";

type StoredMockOrder = {
  id: string;
  orderCode: string;
  userId: string;
  phone: string;
  normalizedPhone: string;
  items: string[];
  total: number;
  service: "tailoring" | "fabric" | "dupatta";
  productId: string | null;
  orderDetails: Record<string, unknown>;
  paymentStatus: "pending" | "partial" | "paid";
  paymentType: "advance" | "full";
  amountPaid: number;
  advanceAmount: number;
  remainingAmount: number;
  finalPrice: number;
  finalPayable: number;
  totalPrice: number;
  marketPrice: number;
  discountPercentage: number;
  discountAmount: number;
  pricingType: "meter" | "piece";
  quantityOrMeter: number;
  paymentId: string;
  status: "pending";
  approvalStatus: "pending";
  assignedTo: null;
  createdAtIso: string;
};

const normalizePhone = (phone?: string) => (phone || "").replace(/\D/g, "").slice(-10);

const readStoredOrders = (): StoredMockOrder[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(MOCK_ORDER_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed as StoredMockOrder[] : [];
  } catch {
    return [];
  }
};

const writeStoredOrders = (orders: StoredMockOrder[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MOCK_ORDER_STORAGE_KEY, JSON.stringify(orders));
};

const toTimestampLike = (iso: string) => {
  const parsedDate = new Date(iso);

  return {
    toDate: () => parsedDate,
    toMillis: () => parsedDate.getTime(),
  };
};

const toUserOrder = (order: StoredMockOrder): UserOrder => {
  return {
    id: order.id,
    orderCode: order.orderCode,
    userId: order.userId,
    phone: order.phone,
    normalizedPhone: order.normalizedPhone,
    items: order.items,
    total: order.total,
    service: order.service,
    productId: order.productId,
    orderDetails: order.orderDetails as UserOrder["orderDetails"],
    paymentStatus: order.paymentStatus,
    paymentType: order.paymentType,
    amountPaid: order.amountPaid,
    advanceAmount: order.advanceAmount,
    remainingAmount: order.remainingAmount,
    finalPrice: order.finalPrice,
    finalPayable: order.finalPayable,
    totalPrice: order.totalPrice,
    marketPrice: order.marketPrice,
    discountPercentage: order.discountPercentage,
    discountAmount: order.discountAmount,
    pricingType: order.pricingType,
    quantityOrMeter: order.quantityOrMeter,
    paymentId: order.paymentId,
    status: order.status,
    approvalStatus: order.approvalStatus,
    statusHistory: [
      {
        status: "pending",
        updatedAt: null,
        note: "Order created",
      },
    ],
    assignedTo: order.assignedTo,
    createdAt: toTimestampLike(order.createdAtIso) as UserOrder["createdAt"],
  };
};

export const readMockOrdersForUser = (userId: string): UserOrder[] => {
  return readStoredOrders()
    .filter((order) => order.userId === userId)
    .sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime())
    .map(toUserOrder);
};

export const saveMockOrderFromCheckout = (params: {
  userId: string;
  phone: string;
  paymentId: string;
  orderId: string;
  orderCode: string;
  pendingOrder: PendingPaymentOrder;
  pricingBreakdown: PricingBreakdown;
  amountPaid: number;
}) => {
  const { pendingOrder, pricingBreakdown } = params;
  const createdAtIso = new Date().toISOString();
  const normalizedPhone = normalizePhone(params.phone);
  const productId = pendingOrder.productId || pendingOrder.pricingInput?.productId || null;

  const items = pendingOrder.whatsappDetails
    .filter((line) => /product|item|fabric|dupatta|design|type/i.test(line))
    .slice(0, 5);

  const storedOrder: StoredMockOrder = {
    id: params.orderId,
    orderCode: params.orderCode,
    userId: params.userId,
    phone: params.phone,
    normalizedPhone,
    items,
    total: pricingBreakdown.finalPayable,
    service: pendingOrder.service,
    productId,
    orderDetails: pendingOrder.orderDetails,
    paymentStatus: "pending",
    paymentType: pendingOrder.paymentType,
    amountPaid: params.amountPaid,
    advanceAmount: pricingBreakdown.advanceAmount,
    remainingAmount: pricingBreakdown.remainingAmount,
    finalPrice: pricingBreakdown.finalPrice,
    finalPayable: pricingBreakdown.finalPayable,
    totalPrice: pricingBreakdown.totalPrice,
    marketPrice: pricingBreakdown.marketPrice,
    discountPercentage: pricingBreakdown.discountPercentage,
    discountAmount: pricingBreakdown.discountAmount,
    pricingType: pricingBreakdown.pricingType,
    quantityOrMeter: pricingBreakdown.quantityOrMeter,
    paymentId: params.paymentId,
    status: "pending",
    approvalStatus: "pending",
    assignedTo: null,
    createdAtIso,
  };

  const existingOrders = readStoredOrders();
  const withoutDuplicate = existingOrders.filter((order) => order.id !== storedOrder.id);

  writeStoredOrders([storedOrder, ...withoutDuplicate]);

  return toUserOrder(storedOrder);
};