import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/services/firebase";
import { PricingType } from "@/utils/pricing";

export type OrderServiceType = "tailoring" | "fabric" | "dupatta";
export type OrderStatus = "pending" | "in progress" | "done" | "in_progress";
export type OrderApprovalStatus = "pending" | "accepted" | "rejected";
export type PaymentStatus = "pending" | "partial" | "paid";
export type PaymentType = "advance" | "full";

export type OrderPricingSnapshot = {
  pricingType: PricingType;
  quantityOrMeter: number;
  marketPrice: number;
  totalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  finalPrice: number;
  finalPayable?: number;
  advancePercentage: number;
  advanceAmount: number;
  remainingAmount: number;
};

export type OrderHistoryItem = {
  status: OrderStatus;
  updatedAt: Timestamp | null;
  note?: string;
  updatedBy?: string;
};

export interface OrderDetails {
  [key: string]: string | number | boolean | null | OrderDetails;
}

export type UserOrder = {
  id: string;
  userId: string;
  phone?: string | null;
  items?: string[];
  total?: number | null;
  service: OrderServiceType;
  productId?: string | null;
  orderDetails: OrderDetails;
  paymentStatus: PaymentStatus;
  paymentType?: PaymentType | null;
  amountPaid?: number | null;
  advanceAmount?: number | null;
  remainingAmount?: number | null;
  finalPrice?: number | null;
  finalPayable?: number | null;
  totalPrice?: number | null;
  marketPrice?: number | null;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  pricingType?: PricingType | null;
  quantityOrMeter?: number | null;
  paymentId?: string | null;
  status: OrderStatus;
  approvalStatus?: OrderApprovalStatus;
  statusHistory: OrderHistoryItem[];
  assignedTo?: string | null;
  createdAt: Timestamp | null;
};

type SaveOrderInput = {
  userId: string;
  service: OrderServiceType;
  orderDetails: OrderDetails;
  productId?: string;
  paymentStatus?: PaymentStatus;
  paymentType?: PaymentType;
  amountPaid?: number;
  pricingSnapshot?: OrderPricingSnapshot;
  paymentId?: string;
  assignedTo?: string;
};

export const saveOrderToFirestore = async ({
  userId,
  service,
  orderDetails,
  productId,
  paymentStatus,
  paymentType,
  amountPaid,
  pricingSnapshot,
  paymentId,
  assignedTo,
}: SaveOrderInput) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const orderRef = doc(collection(db, "orders"));

  const orderPayload = {
    id: orderRef.id,
    userId,
    service,
    productId: productId || null,
    orderDetails,
    paymentStatus: paymentStatus || "pending",
    paymentType: paymentType || null,
    amountPaid: typeof amountPaid === "number" ? amountPaid : null,
    advanceAmount: pricingSnapshot?.advanceAmount ?? null,
    remainingAmount: pricingSnapshot?.remainingAmount ?? null,
    finalPrice: pricingSnapshot?.finalPrice ?? null,
    finalPayable: pricingSnapshot?.finalPayable ?? pricingSnapshot?.finalPrice ?? null,
    totalPrice: pricingSnapshot?.totalPrice ?? null,
    marketPrice: pricingSnapshot?.marketPrice ?? null,
    discountPercentage: pricingSnapshot?.discountPercentage ?? null,
    discountAmount: pricingSnapshot?.discountAmount ?? null,
    pricingType: pricingSnapshot?.pricingType ?? null,
    quantityOrMeter: pricingSnapshot?.quantityOrMeter ?? null,
    paymentId: paymentId || null,
    status: "pending",
    approvalStatus: "pending",
    statusHistory: [
      {
        status: "pending",
        updatedAt: serverTimestamp(),
        note: "Order created",
      },
    ],
    assignedTo: assignedTo || null,
    createdAt: serverTimestamp(),
  };

  if (!paymentId) {
    await setDoc(orderRef, orderPayload);
    return;
  }

  const paymentRef = doc(db, "payment_records", paymentId);

  await runTransaction(db, async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);

    if (paymentSnapshot.exists()) {
      throw new Error("This payment has already been processed.");
    }

    transaction.set(paymentRef, {
      paymentId,
      service,
      orderId: orderRef.id,
      amountPaid: typeof amountPaid === "number" ? amountPaid : null,
      paymentType: paymentType || null,
      createdAt: serverTimestamp(),
    });

    transaction.set(orderRef, orderPayload);
  });
};

export const subscribeToAllOrders = (
  onOrders: (orders: UserOrder[]) => void,
  onError?: (error: Error) => void,
) => {
  const db = getFirebaseDb();

  if (!db) {
    onOrders([]);
    return () => undefined;
  }

  const ordersQuery = query(collection(db, "orders"), orderBy("createdAt", "desc"));

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders: UserOrder[] = snapshot.docs.map((orderDoc) => {
        const data = orderDoc.data() as Omit<UserOrder, "id">;

        return {
          id: orderDoc.id,
          userId: data.userId,
          service: data.service,
          productId: data.productId || null,
          orderDetails: data.orderDetails || {},
          paymentStatus: (data.paymentStatus || "pending") as PaymentStatus,
          paymentType: (data.paymentType || null) as PaymentType | null,
          amountPaid: typeof data.amountPaid === "number" ? data.amountPaid : null,
          advanceAmount: typeof data.advanceAmount === "number" ? data.advanceAmount : null,
          remainingAmount: typeof data.remainingAmount === "number" ? data.remainingAmount : null,
          finalPrice: typeof data.finalPrice === "number" ? data.finalPrice : null,
          finalPayable: typeof data.finalPayable === "number" ? data.finalPayable : null,
          totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : null,
          marketPrice: typeof data.marketPrice === "number" ? data.marketPrice : null,
          discountPercentage: typeof data.discountPercentage === "number" ? data.discountPercentage : null,
          discountAmount: typeof data.discountAmount === "number" ? data.discountAmount : null,
          pricingType: (data.pricingType || null) as PricingType | null,
          quantityOrMeter: typeof data.quantityOrMeter === "number" ? data.quantityOrMeter : null,
          paymentId: data.paymentId || null,
          status: (data.status || "pending") as OrderStatus,
          approvalStatus: (data.approvalStatus || "pending") as OrderApprovalStatus,
          phone: data.phone || null,
          items: Array.isArray(data.items) ? data.items as string[] : [],
          total: typeof data.total === "number" ? data.total : null,
          statusHistory: (data.statusHistory || []) as OrderHistoryItem[],
          assignedTo: data.assignedTo || null,
          createdAt: data.createdAt || null,
        };
      });

      onOrders(orders);
    },
    (error) => {
      onError?.(error as Error);
    },
  );
};

export const fetchAllOrders = async (): Promise<UserOrder[]> => {
  const db = getFirebaseDb();

  if (!db) {
    return [];
  }

  try {
    const snapshot = await getDocs(collection(db, "orders"));
    const orders = snapshot.docs.map((orderDoc) => {
      const data = orderDoc.data() as Omit<UserOrder, "id">;

      return {
        id: orderDoc.id,
        userId: data.userId,
        service: data.service,
        productId: data.productId || null,
        orderDetails: data.orderDetails || {},
        paymentStatus: (data.paymentStatus || "pending") as PaymentStatus,
        paymentType: (data.paymentType || null) as PaymentType | null,
        amountPaid: typeof data.amountPaid === "number" ? data.amountPaid : null,
        advanceAmount: typeof data.advanceAmount === "number" ? data.advanceAmount : null,
        remainingAmount: typeof data.remainingAmount === "number" ? data.remainingAmount : null,
        finalPrice: typeof data.finalPrice === "number" ? data.finalPrice : null,
        finalPayable: typeof data.finalPayable === "number" ? data.finalPayable : null,
        totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : null,
        marketPrice: typeof data.marketPrice === "number" ? data.marketPrice : null,
        discountPercentage: typeof data.discountPercentage === "number" ? data.discountPercentage : null,
        discountAmount: typeof data.discountAmount === "number" ? data.discountAmount : null,
        pricingType: (data.pricingType || null) as PricingType | null,
        quantityOrMeter: typeof data.quantityOrMeter === "number" ? data.quantityOrMeter : null,
        paymentId: data.paymentId || null,
        status: (data.status || "pending") as OrderStatus,
        approvalStatus: (data.approvalStatus || "pending") as OrderApprovalStatus,
        phone: data.phone || null,
        items: Array.isArray(data.items) ? data.items as string[] : [],
        total: typeof data.total === "number" ? data.total : null,
        statusHistory: (data.statusHistory || []) as OrderHistoryItem[],
        assignedTo: data.assignedTo || null,
        createdAt: data.createdAt || null,
      };
    });

    orders.sort((a, b) => {
      const aMillis = a.createdAt?.toMillis?.() ?? 0;
      const bMillis = b.createdAt?.toMillis?.() ?? 0;
      return bMillis - aMillis;
    });

    console.log("Orders fetched:", orders.length);

    return orders;
  } catch (err) {
    console.error("Orders fetch error:", err);
    return [];
  }
};

export const getNextOrderStatus = (status: OrderStatus): OrderStatus | null => {
  if (status === "pending") {
    return "in progress";
  }

  if (status === "in_progress" || status === "in progress") {
    return "done";
  }

  return null;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  updatedBy?: string,
  note?: string,
) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await updateDoc(doc(db, "orders", orderId), {
    status,
    statusHistory: arrayUnion({
      status,
      updatedAt: Timestamp.now(),
      note: note || "Status updated",
      updatedBy: updatedBy || "admin",
    }),
  });
};

export const updateOrderApprovalStatus = async (
  orderId: string,
  approvalStatus: OrderApprovalStatus,
  updatedBy?: string,
) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await updateDoc(doc(db, "orders", orderId), {
    approvalStatus,
    approvalUpdatedAt: Timestamp.now(),
    statusHistory: arrayUnion({
      status: "pending",
      updatedAt: Timestamp.now(),
      note: `Approval ${approvalStatus}`,
      updatedBy: updatedBy || "admin",
    }),
  });
};

export const markOrderPaymentAsPaid = async (
  order: Pick<UserOrder, "id" | "amountPaid" | "finalPrice" | "advanceAmount" | "remainingAmount">,
) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const remainingAmount = typeof order.remainingAmount === "number" ? order.remainingAmount : 0;
  const existingPaid = typeof order.amountPaid === "number"
    ? order.amountPaid
    : typeof order.advanceAmount === "number"
      ? order.advanceAmount
      : 0;
  const expectedFinal = typeof order.finalPrice === "number" ? order.finalPrice : existingPaid + remainingAmount;
  const normalizedAmountPaid = Math.max(existingPaid + remainingAmount, expectedFinal);

  await updateDoc(doc(db, "orders", order.id), {
    paymentStatus: "paid",
    paymentType: "full",
    amountPaid: normalizedAmountPaid,
    remainingAmount: 0,
    finalPrice: expectedFinal,
    paymentUpdatedAt: Timestamp.now(),
  });
};

export const subscribeToUserOrders = (
  userId: string,
  onOrders: (orders: UserOrder[]) => void,
  onError?: (error: Error) => void,
) => {
  const db = getFirebaseDb();

  if (!db) {
    onOrders([]);
    return () => undefined;
  }

  const ordersQuery = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders: UserOrder[] = snapshot.docs.map((doc) => {
        const data = doc.data() as Omit<UserOrder, "id">;

        return {
          id: doc.id,
          userId: data.userId,
          service: data.service,
          productId: data.productId || null,
          orderDetails: data.orderDetails || {},
          paymentStatus: (data.paymentStatus || "pending") as PaymentStatus,
          paymentType: (data.paymentType || null) as PaymentType | null,
          amountPaid: typeof data.amountPaid === "number" ? data.amountPaid : null,
          advanceAmount: typeof data.advanceAmount === "number" ? data.advanceAmount : null,
          remainingAmount: typeof data.remainingAmount === "number" ? data.remainingAmount : null,
          finalPrice: typeof data.finalPrice === "number" ? data.finalPrice : null,
          finalPayable: typeof data.finalPayable === "number" ? data.finalPayable : null,
          totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : null,
          marketPrice: typeof data.marketPrice === "number" ? data.marketPrice : null,
          discountPercentage: typeof data.discountPercentage === "number" ? data.discountPercentage : null,
          discountAmount: typeof data.discountAmount === "number" ? data.discountAmount : null,
          pricingType: (data.pricingType || null) as PricingType | null,
          quantityOrMeter: typeof data.quantityOrMeter === "number" ? data.quantityOrMeter : null,
          paymentId: data.paymentId || null,
          status: (data.status || "pending") as OrderStatus,
          approvalStatus: (data.approvalStatus || "pending") as OrderApprovalStatus,
          phone: data.phone || null,
          items: Array.isArray(data.items) ? data.items as string[] : [],
          total: typeof data.total === "number" ? data.total : null,
          statusHistory: (data.statusHistory || []) as OrderHistoryItem[],
          assignedTo: data.assignedTo || null,
          createdAt: data.createdAt || null,
        };
      });

      onOrders(orders);
    },
    (error) => {
      onError?.(error as Error);
    },
  );
};
