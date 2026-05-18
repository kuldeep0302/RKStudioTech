"use client";

import { useEffect, useState } from "react";
import {
  fetchAllOrders,
  subscribeToAllOrders,
  subscribeToOrdersByPhone,
  subscribeToUserOrders,
  UserOrder,
} from "@/services/orderService";

type UseOrdersParams = {
  mode: "user" | "all" | "phone";
  userId?: string;
  phone?: string;
  mockMode?: boolean;
};

export const useOrders = ({ mode, userId, phone, mockMode = false }: UseOrdersParams) => {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");

    if (mode === "user" && !userId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (mode === "phone" && !phone) {
      setOrders([]);
      setLoading(false);
      return;
    }

    if (mockMode || userId?.startsWith("mock-")) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe =
      mode === "user"
        ? subscribeToUserOrders(
            userId as string,
            (nextOrders) => {
              setOrders(nextOrders);
              setLoading(false);
            },
            () => {
              setError("Could not fetch orders.");
              setLoading(false);
            },
          )
        : mode === "phone"
          ? subscribeToOrdersByPhone(
              phone as string,
              (nextOrders) => {
                setError("");
                setOrders(nextOrders);
                setLoading(false);
              },
              () => {
                setError("Could not fetch orders.");
                setLoading(false);
              },
            )
        : subscribeToAllOrders(
            (nextOrders) => {
              setError("");
              setOrders(nextOrders);
              setLoading(false);
            },
            () => {
              setError("Could not fetch orders.");
              void (async () => {
                const fallbackOrders = await fetchAllOrders();
                setOrders(fallbackOrders);
                if (fallbackOrders.length > 0) {
                  setError("");
                }
                setLoading(false);
              })();
            },
          );

    return () => unsubscribe();
  }, [mode, userId, phone]);

  return {
    orders,
    loading,
    error,
  };
};
