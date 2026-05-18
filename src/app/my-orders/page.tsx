"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import OrderTimeline from "@/components/orders/OrderTimeline";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth, getFirebaseDb } from "@/services/firebase";
import { getOrderStatusMessage, OrderStatus, UserOrder, normalizeOrderStatus } from "@/services/orderService";
import { readMockOrdersForUser } from "@/utils/mockOrderStore";
import { buildWhatsAppChatUrl, formatPhone } from "@/utils/whatsapp";

const getStatusColor = (status: OrderStatus) => {
  if (status === "pending") return "warning" as const;
  if (status === "accepted") return "success" as const;
  if (status === "rejected") return "error" as const;
  if (status === "stitching" || status === "in progress" || status === "in_progress") return "info" as const;
  if (status === "ready") return "secondary" as const;
  if (status === "delivered" || status === "done") return "default" as const;
  return "default" as const;
};

const getStatusLabel = (status: OrderStatus) => {
  if (status === "in_progress" || status === "in progress") return "Stitching";
  if (status === "done") return "Delivered";
  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "stitching") return "Stitching";
  if (status === "ready") return "Ready";
  if (status === "delivered") return "Delivered";
  return status;
};

const formatOrderDate = (date?: { toDate?: () => Date } | null) => {
  if (!date || typeof date.toDate !== "function") {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date.toDate());
};

export default function MyOrdersPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      if (authLoading) {
        return;
      }

      const auth = getFirebaseAuth();
      const firebaseUser = auth?.currentUser;
      const user = authUser?.provider === "mock" ? authUser : firebaseUser;

      if (!user?.uid) {
        if (!cancelled) {
          setOrders([]);
          setError("");
          setLoading(false);
        }
        return;
      }

      const db = getFirebaseDb();

      if (!db) {
        if (!cancelled) {
          setOrders([]);
          setError("Could not fetch orders.");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
        setError("");
      }

      try {
        if (authUser?.provider === "mock") {
          if (!cancelled) {
            setOrders(readMockOrdersForUser(user.uid));
            setError("");
            setLoading(false);
          }

          return;
        }

        const ordersQuery = query(
          collection(db, "orders"),
          where("userId", "==", user.uid),
        );

        const snapshot = await getDocs(ordersQuery);

        const nextOrders = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        })) as UserOrder[];

        nextOrders.sort((a, b) => {
          const aMillis = a.createdAt?.toMillis?.() ?? 0;
          const bMillis = b.createdAt?.toMillis?.() ?? 0;
          return bMillis - aMillis;
        });

        if (!cancelled) {
          setOrders(nextOrders);
        }
      } catch (fetchError: unknown) {
        const errorCode = typeof fetchError === "object" && fetchError !== null && "code" in fetchError
          ? String((fetchError as { code?: unknown }).code || "")
          : "";

        if (errorCode === "permission-denied") {
          console.error("My Orders permission error: query must filter by authenticated userId.", fetchError);
          if (!cancelled) {
            setError("Could not load your orders due to a permissions issue. Please sign in again.");
          }
        } else {
          console.error("My Orders fetch error:", fetchError);
          if (!cancelled) {
            setError("Could not fetch orders.");
          }
        }

        if (!cancelled) {
          setOrders([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [authLoading, authUser?.uid]);

  const latestOrder = orders[0];
  const supportPhone = formatPhone("9198901501572");
  const readyOrderHelpUrl = buildWhatsAppChatUrl(supportPhone, "My order is ready. Please share delivery details");
  const genericHelpUrl = buildWhatsAppChatUrl(supportPhone, "Hi, I need help with my order");

  return (
    <Layout>
      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography variant="h4">My Orders</Typography>
            <Typography color="text.secondary">Track your latest order status in real-time.</Typography>

            {latestOrder ? (
              <Alert severity="info">
                Latest update: {latestOrder.orderCode || latestOrder.id.slice(0, 8)} - {getOrderStatusMessage(latestOrder.status)}.
              </Alert>
            ) : null}

            {error ? <Alert severity="error">{error}</Alert> : null}

            {loading ? (
              <Stack alignItems="center" py={6}>
                <CircularProgress />
              </Stack>
            ) : null}

            {!loading && orders.length === 0 ? (
              <Alert severity="info">No orders yet — place your first order</Alert>
            ) : null}

            {!loading && orders.length > 0 ? (
              <Stack spacing={2.5}>
                {latestOrder ? <OrderTimeline status={latestOrder.status} /> : null}

                <Alert severity="success">Estimated delivery: 3-5 working days after order confirmation.</Alert>

                <Divider />

                <Box sx={{ overflowX: "auto" }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Order ID</TableCell>
                        <TableCell>Items</TableCell>
                        <TableCell>Total</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((order) => {
                        const productLabel = order.items?.[0]
                          || order.orderDetails?.product_name
                          || order.orderDetails?.productType
                          || order.service;
                        const total = order.total || order.finalPayable || order.finalPrice || order.totalPrice || 0;

                        return (
                          <TableRow key={order.id}>
                            <TableCell>{(order.orderCode || order.id).slice(0, 16)}</TableCell>
                            <TableCell sx={{ textTransform: "capitalize" }}>{String(productLabel || "-")}</TableCell>
                            <TableCell>INR {Number(total || 0)}</TableCell>
                            <TableCell>
                              <Chip label={getStatusLabel(order.status)} size="small" color={getStatusColor(order.status)} />
                            </TableCell>
                            <TableCell>{formatOrderDate(order.createdAt)}</TableCell>
                            <TableCell>
                              <Button component={Link} href={`/my-orders/${order.id}`} variant="outlined" size="small" fullWidth>
                                View Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Stack>
            ) : null}

            {!loading ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                {latestOrder && normalizeOrderStatus(latestOrder.status) === "ready" ? (
                  <Button
                    component="a"
                    href={readyOrderHelpUrl || undefined}
                    target="_self"
                    variant="contained"
                    color="success"
                    disabled={!readyOrderHelpUrl}
                    fullWidth
                    sx={{ minHeight: 44 }}
                  >
                    {readyOrderHelpUrl ? "Contact Tailor on WhatsApp" : "Support number unavailable"}
                  </Button>
                ) : null}
                <Button
                  component="a"
                  href={genericHelpUrl || undefined}
                  target="_self"
                  variant="outlined"
                  color="success"
                  disabled={!genericHelpUrl}
                  fullWidth
                  sx={{ minHeight: 44 }}
                >
                  {genericHelpUrl ? "Need Help?" : "Support number unavailable"}
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Layout>
  );
}
