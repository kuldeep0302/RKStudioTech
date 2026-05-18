"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid2,
  MenuItem,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import RKStudioLogo from "@/components/common/RKStudioLogo";
import Layout from "@/components/layout/Layout";
import { useGlobalLoading } from "@/context/LoadingContext";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth } from "@/services/firebase";
import { useOrders } from "@/hooks/useOrders";
import {
  getNextOrderStatus,
  markOrderPaymentAsPaid,
  OrderApprovalStatus,
  OrderDetails,
  OrderServiceType,
  OrderStatus,
  updateOrderApprovalStatus,
  updateOrderStatus,
  UserOrder,
} from "@/services/orderService";
import { AppUser, deleteUserById, subscribeToAllUsers, updateUserRole } from "@/services/userService";
import { clearDummyProducts, seedDummyProducts } from "@/services/productService";
import { useAutoSeed } from "@/hooks/useAutoSeed";
import PreLaunchFlow from "@/features/admin/PreLaunchFlow";
import { UserRole } from "@/types/auth";
import { buildUserOrderDecisionWhatsAppUrl, openWhatsAppInNewTab } from "@/utils/whatsapp";

const formatStatusLabel = (status: OrderStatus) => {
  if (status === "pending") return "Pending";
  if (status === "in_progress" || status === "in progress") return "In Progress";
  if (status === "done") return "Done";
  return status;
};

const formatDate = (createdAt: UserOrder["createdAt"] | AppUser["createdAt"]) => {
  if (!createdAt) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(createdAt.toDate());
};

const formatShortDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(date);
};

const formatINR = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatOrderDetailsLabel = (value: string) => {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const flattenOrderDetails = (details: OrderDetails, parentLabel?: string): string[] => {
  return Object.entries(details).flatMap(([key, value]) => {
    const label = parentLabel ? `${parentLabel} ${formatOrderDetailsLabel(key)}` : formatOrderDetailsLabel(key);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenOrderDetails(value as OrderDetails, label);
    }

    return `${label}: ${value ?? "-"}`;
  });
};

const createOrderDetailsText = (order: UserOrder) => {
  return flattenOrderDetails(order.orderDetails)
    .join(" | ");
};

const getOrderSizeSummary = (order: UserOrder) => {
  const sizeType = typeof order.orderDetails?.size_type === "string"
    ? order.orderDetails.size_type.trim().toLowerCase()
    : "";
  const sizeValue = typeof order.orderDetails?.size_value === "string"
    ? order.orderDetails.size_value.trim()
    : "";
  const customSizeNotes = typeof order.orderDetails?.custom_size_notes === "string"
    ? order.orderDetails.custom_size_notes.trim()
    : "";

  if (sizeType === "custom" && customSizeNotes) {
    return `Custom Size: ${customSizeNotes}`;
  }

  if (sizeType === "standard" && sizeValue) {
    return `Size: ${sizeValue}`;
  }

  return "";
};

const escapeCsvValue = (value: string | number) => {
  const text = String(value ?? "");

  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
  const content = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const getOrderAmount = (order: UserOrder) => {
  if (typeof order.amountPaid === "number") {
    return order.amountPaid;
  }

  if (typeof order.finalPrice === "number") {
    return order.finalPrice;
  }

  const totalPrice = order.orderDetails?.total_price;
  if (typeof totalPrice === "number") {
    return totalPrice;
  }

  const totalAmount = order.orderDetails?.totalAmount;
  if (typeof totalAmount === "number") {
    return totalAmount;
  }

  return 0;
};

const getPaymentChipColor = (status: UserOrder["paymentStatus"]) => {
  if (status === "paid") {
    return "success" as const;
  }

  if (status === "partial") {
    return "info" as const;
  }

  return "warning" as const;
};

const getApprovalChipColor = (status?: OrderApprovalStatus) => {
  if (status === "accepted") {
    return "success" as const;
  }

  if (status === "rejected") {
    return "error" as const;
  }

  return "warning" as const;
};

type SalesPoint = {
  key: string;
  label: string;
  amount: number;
};

type SalesRange = 7 | 15 | 30;
type PaymentFollowupFilter = "all" | "partial" | "pending";

type ReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  help: string;
};

type ReadinessResponse = {
  success: boolean;
  readiness: {
    ok: boolean;
    message: string;
    environment: string;
    razorpayEnabled: boolean;
    mockOtpEnabled: boolean;
  };
  sections: {
    firebaseClient: ReadinessCheck[];
    firebaseAdmin: ReadinessCheck[];
    payments: ReadinessCheck[];
    otpMode: ReadinessCheck[];
  };
  nextAction: string;
};

const buildSalesByDays = (orders: UserOrder[], days: SalesRange): SalesPoint[] => {
  const now = new Date();
  const dayKeys: string[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - i);
    dayKeys.push(date.toISOString().slice(0, 10));
  }

  const totals = dayKeys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  orders.forEach((order) => {
    if (!order.createdAt || order.paymentStatus !== "paid") {
      return;
    }

    const orderDate = order.createdAt.toDate();
    orderDate.setHours(0, 0, 0, 0);
    const key = orderDate.toISOString().slice(0, 10);

    if (!(key in totals)) {
      return;
    }

    totals[key] += getOrderAmount(order);
  });

  return dayKeys.map((key) => {
    const date = new Date(`${key}T00:00:00`);

    return {
      key,
      label: formatShortDate(date),
      amount: totals[key] || 0,
    };
  });
};

const SmallSalesChart = ({ data }: { data: SalesPoint[] }) => {
  const width = Math.max(340, data.length * 44);
  const height = 170;
  const left = 36;
  const right = 12;
  const top = 12;
  const bottom = 32;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...data.map((point) => point.amount), 0);
  const safeMax = maxValue > 0 ? maxValue : 1;

  const points = data.map((point, index) => {
    const x = left + (chartWidth * index) / Math.max(data.length - 1, 1);
    const y = top + chartHeight - (point.amount / safeMax) * chartHeight;
    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const labelInterval = data.length > 20 ? 4 : data.length > 12 ? 3 : data.length > 8 ? 2 : 1;

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: "100%", minWidth: `${width}px`, height: 190 }}>
        <line x1={left} y1={top} x2={left} y2={top + chartHeight} stroke="#CBD5E1" strokeWidth={1} />
        <line x1={left} y1={top + chartHeight} x2={left + chartWidth} y2={top + chartHeight} stroke="#CBD5E1" strokeWidth={1} />

        <text x={8} y={top + 6} fontSize="10" fill="#64748B">{formatINR(maxValue)}</text>
        <text x={8} y={top + chartHeight} fontSize="10" fill="#64748B">{formatINR(0)}</text>

        {linePath ? (
          <path d={linePath} fill="none" stroke="#0EA5E9" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}

        {points.map((point) => (
          <circle key={point.key} cx={point.x} cy={point.y} r={3.2} fill="#0EA5E9" />
        ))}

        {points.map((point, index) => {
          const isLast = index === points.length - 1;
          const shouldRenderLabel = index % labelInterval === 0 || isLast;

          if (!shouldRenderLabel) {
            return null;
          }

          return (
            <text key={`${point.key}-label`} x={point.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#475569">
              {point.label}
            </text>
          );
        })}
      </Box>
    </Box>
  );
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { trackAsync } = useGlobalLoading();
  const { orders, error: ordersError } = useOrders({ mode: "all" });
  const [users, setUsers] = useState<AppUser[]>([]);
  const [salesRange, setSalesRange] = useState<SalesRange>(7);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<"all" | OrderServiceType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [paymentFollowupFilter, setPaymentFollowupFilter] = useState<PaymentFollowupFilter>("all");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [updatingPaymentOrderId, setUpdatingPaymentOrderId] = useState("");
  const [updatingApprovalOrderId, setUpdatingApprovalOrderId] = useState("");
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState("");
  const [deletingUserId, setDeletingUserId] = useState("");
  const [launchFlowOpen, setLaunchFlowOpen] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessResponse | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<"idle" | "seeding" | "clearing" | "done">("idle");
  const [seedMessage, setSeedMessage] = useState("");

  useAutoSeed(true);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (user?.provider === "mock") {
      return {
        Authorization: `Bearer mock:${user.uid}:${user.role || "admin"}`,
      };
    }

    const auth = getFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();

    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const loadReadiness = useCallback(async () => {
    try {
      setReadinessLoading(true);

      const response = await fetch("/api/system/readiness", {
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Could not load readiness status.");
      }

      const data = (await response.json()) as ReadinessResponse;
      setReadiness(data);
    } catch {
      setError("Could not load readiness status.");
    } finally {
      setReadinessLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const unsubscribeUsers = subscribeToAllUsers(setUsers, () => {
      setError("Could not load users.");
    });

    return () => {
      unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    if (ordersError) {
      setError(ordersError);
    }
  }, [ordersError]);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  const readinessFailures = useMemo(() => {
    if (!readiness) {
      return [] as ReadinessCheck[];
    }

    return [
      ...readiness.sections.firebaseClient,
      ...readiness.sections.firebaseAdmin,
      ...readiness.sections.payments,
      ...readiness.sections.otpMode,
    ].filter((check) => !check.ok);
  }, [readiness]);

  const usersById = useMemo(() => {
    return users.reduce<Record<string, AppUser>>((acc, appUser) => {
      acc[appUser.id] = appUser;
      return acc;
    }, {});
  }, [users]);

  const orderCountByUserId = useMemo(() => {
    return orders.reduce<Record<string, number>>((acc, order) => {
      acc[order.userId] = (acc[order.userId] || 0) + 1;
      return acc;
    }, {});
  }, [orders]);

  const salesData = useMemo(() => buildSalesByDays(orders, salesRange), [orders, salesRange]);

  const totalSalesInRange = useMemo(
    () => salesData.reduce((sum, point) => sum + point.amount, 0),
    [salesData],
  );

  const totalRevenue = useMemo(() => {
    return orders
      .filter((order) => order.paymentStatus === "paid")
      .reduce((sum, order) => sum + (order.finalPrice || getOrderAmount(order)), 0);
  }, [orders]);

  const advanceCollected = useMemo(() => {
    return orders
      .filter((order) => order.paymentStatus === "partial")
      .reduce((sum, order) => sum + (order.advanceAmount || order.amountPaid || 0), 0);
  }, [orders]);

  const pendingPayments = useMemo(() => {
    return orders
      .filter((order) => order.paymentStatus !== "paid")
      .reduce((sum, order) => sum + (order.remainingAmount || 0), 0);
  }, [orders]);

  const paymentFollowupOrders = useMemo(() => {
    return orders
      .filter((order) => order.paymentStatus !== "paid")
      .filter((order) => {
        if (paymentFollowupFilter === "all") {
          return true;
        }

        return order.paymentStatus === paymentFollowupFilter;
      })
      .sort((a, b) => {
        const aAmount = a.remainingAmount || 0;
        const bAmount = b.remainingAmount || 0;
        return bAmount - aAmount;
      });
  }, [orders, paymentFollowupFilter]);

  const searchedUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return users;
    }

    return users.filter((appUser) => {
      return appUser.name.toLowerCase().includes(normalized)
        || appUser.phone.toLowerCase().includes(normalized);
    });
  }, [search, users]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const byService = serviceFilter === "all" || order.service === serviceFilter;
      const byStatus =
        statusFilter === "all" ||
        order.status === statusFilter ||
        (statusFilter === "in progress" && order.status === ("in_progress" as OrderStatus));

      return byService && byStatus;
    });
  }, [orders, serviceFilter, statusFilter]);

  const handleExportOrders = () => {
    const rows = orders.map((order) => {
      const linkedUser = usersById[order.userId];

      return [
        order.id,
        linkedUser?.name || "-",
        linkedUser?.phone || "-",
        order.service,
        order.status,
        order.paymentStatus,
        getOrderAmount(order),
        formatDate(order.createdAt),
        createOrderDetailsText(order) || "-",
      ];
    });

    downloadCsv(
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Order ID", "User Name", "Phone", "Service", "Status", "Payment Status", "Amount", "Created At", "Order Details"],
      rows,
    );
  };

  const handleExportUsers = () => {
    const rows = users.map((appUser) => {
      return [
        appUser.id,
        appUser.name || "-",
        appUser.phone || "-",
        orderCountByUserId[appUser.id] || 0,
        formatDate(appUser.createdAt),
      ];
    });

    downloadCsv(
      `users-${new Date().toISOString().slice(0, 10)}.csv`,
      ["User ID", "Name", "Phone", "Total Orders", "Created At"],
      rows,
    );
  };

  const handleAdvanceStatus = async (order: UserOrder) => {
    const nextStatus = getNextOrderStatus(order.status);

    if (!nextStatus) {
      return;
    }

    try {
      setUpdatingOrderId(order.id);
      await trackAsync(updateOrderStatus(order.id, nextStatus, user?.phoneNumber || "admin", "Updated by admin"));
    } catch {
      setError("Could not update order status.");
    } finally {
      setUpdatingOrderId("");
    }
  };

  const handleMarkPaymentPaid = async (order: UserOrder) => {
    const confirmed = window.confirm("Has the remaining payment been received for this order?");

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingPaymentOrderId(order.id);
      await trackAsync(markOrderPaymentAsPaid(order));
      setSuccessMessage("Payment status marked as paid.");
    } catch {
      setError("Could not mark payment as paid.");
    } finally {
      setUpdatingPaymentOrderId("");
    }
  };

  const handleApprovalStatus = async (order: UserOrder, approvalStatus: OrderApprovalStatus) => {
    if (approvalStatus === "pending") {
      return;
    }

    try {
      setUpdatingApprovalOrderId(order.id);
      await trackAsync(updateOrderApprovalStatus(order.id, approvalStatus, user?.phoneNumber || "admin"));

      const linkedUser = usersById[order.userId];
      const userPhone = (order.phone || linkedUser?.phone || "").replace(/\D/g, "");
      const waUrl = buildUserOrderDecisionWhatsAppUrl({
        phone: userPhone,
        status: approvalStatus,
      });

      if (waUrl) {
        openWhatsAppInNewTab(waUrl);
      }

      setSuccessMessage(`Order ${approvalStatus}. User notification prepared on WhatsApp.`);
    } catch {
      setError("Could not update order approval status.");
    } finally {
      setUpdatingApprovalOrderId("");
    }
  };

  const handleSetUserRole = async (appUser: AppUser, nextRole: UserRole) => {
    if (appUser.role === nextRole) {
      return;
    }

    try {
      setUpdatingUserRoleId(appUser.id);
      await trackAsync(updateUserRole(appUser.id, nextRole));
      setSuccessMessage(`${appUser.name || "User"} is now ${nextRole}.`);
    } catch {
      setError("Could not update user role.");
    } finally {
      setUpdatingUserRoleId("");
    }
  };

  const handleDeleteUser = async (appUser: AppUser) => {
    const myPhone = (user?.phoneNumber || "").replace(/\D/g, "").slice(-10);
    const targetPhone = (appUser.phone || "").replace(/\D/g, "").slice(-10);

    if (myPhone && myPhone === targetPhone) {
      setError("You cannot delete your own admin account.");
      return;
    }

    const confirmed = window.confirm(`Delete user ${appUser.name || appUser.phone || "this user"}?`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingUserId(appUser.id);
      await trackAsync(deleteUserById(appUser.id));
      setSuccessMessage("User deleted successfully.");
    } catch {
      setError("Could not delete user.");
    } finally {
      setDeletingUserId("");
    }
  };

  return (
    <Layout>
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
                <RKStudioLogo size={34} variant="full" />
                <Stack spacing={0.4}>
                  <Typography variant="h4">Admin Dashboard</Typography>
                  <Typography color="text.secondary">Manage sales, users, and orders in one place.</Typography>
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <Button onClick={handleExportOrders} variant="contained">Export Orders</Button>
                <Button onClick={handleExportUsers} variant="outlined">Export Users</Button>
                <Button component={Link} href="/admin/products" variant="outlined">Manage Products</Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => setLaunchFlowOpen(true)}
                >
                  Launch App
                </Button>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Sections: Users | Products | Orders | Analytics
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Snackbar
          open={Boolean(successMessage)}
          autoHideDuration={2500}
          onClose={() => setSuccessMessage("")}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert severity="success" onClose={() => setSuccessMessage("")} sx={{ width: "100%" }}>
            {successMessage}
          </Alert>
        </Snackbar>

        <PreLaunchFlow open={launchFlowOpen} onClose={() => setLaunchFlowOpen(false)} />

        <Grid2 container spacing={2}>
          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Sales (Last {salesRange} Days)</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatINR(totalSalesInRange)}</Typography>
              </CardContent>
            </Card>
          </Grid2>
          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total Orders</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{orders.length}</Typography>
              </CardContent>
            </Card>
          </Grid2>
          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total Users</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{users.length}</Typography>
              </CardContent>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatINR(totalRevenue)}</Typography>
              </CardContent>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Advance Collected</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatINR(advanceCollected)}</Typography>
              </CardContent>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Pending Payments</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatINR(pendingPayments)}</Typography>
              </CardContent>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Stack spacing={1.2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="space-between" alignItems={{ sm: "center" }}>
                    <Typography variant="h6">Launch Readiness</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {readiness ? (
                        <Chip
                          label={readiness.readiness.ok ? "Ready" : "Action Needed"}
                          color={readiness.readiness.ok ? "success" : "warning"}
                          size="small"
                        />
                      ) : null}
                      <Button variant="outlined" size="small" onClick={loadReadiness} disabled={readinessLoading}>
                        {readinessLoading ? "Checking..." : "Refresh"}
                      </Button>
                    </Stack>
                  </Stack>

                  {readiness ? (
                    <>
                      <Typography color="text.secondary">{readiness.readiness.message}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Environment: {readiness.readiness.environment} | Payment: {readiness.readiness.razorpayEnabled ? "Enabled" : "Disabled"} | OTP Mode: {readiness.readiness.mockOtpEnabled ? "Mock" : "Real"}
                      </Typography>

                      {readinessFailures.length > 0 ? (
                        <Alert severity="warning">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Pending Checks:</Typography>
                          {readinessFailures.slice(0, 4).map((failure) => (
                            <Typography key={failure.key} variant="body2">- {failure.label}: {failure.help}</Typography>
                          ))}
                        </Alert>
                      ) : (
                        <Alert severity="success">All critical launch checks passed.</Alert>
                      )}

                      <Typography variant="body2" color="text.secondary">{readiness.nextAction}</Typography>
                    </>
                  ) : (
                    <Typography color="text.secondary">Readiness data unavailable.</Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Stack spacing={1.2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between">
                    <Typography variant="h6">Sales Trend</Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {[7, 15, 30].map((range) => {
                        const isActive = salesRange === range;

                        return (
                          <Chip
                            key={range}
                            label={`${range}D`}
                            clickable
                            onClick={() => setSalesRange(range as SalesRange)}
                            color={isActive ? "primary" : "default"}
                            variant={isActive ? "filled" : "outlined"}
                            size="small"
                          />
                        );
                      })}
                    </Stack>
                  </Stack>
                  <SmallSalesChart data={salesData} />
                </Stack>
              </CardContent>
            </Card>
          </Grid2>
        </Grid2>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                <Typography variant="h5">Payment Follow-up</Typography>
                <TextField
                  select
                  label="Payment Status"
                  value={paymentFollowupFilter}
                  onChange={(event) => setPaymentFollowupFilter(event.target.value as PaymentFollowupFilter)}
                  size="small"
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="all">All unpaid</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </TextField>
              </Stack>

              <Box sx={{ overflowX: "auto" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Payment</TableCell>
                      <TableCell>Collected</TableCell>
                      <TableCell>Pending</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paymentFollowupOrders.map((order) => {
                      const linkedUser = usersById[order.userId];

                      return (
                        <TableRow key={`payment-${order.id}`}>
                          <TableCell>{linkedUser?.name || "User"}</TableCell>
                          <TableCell>{linkedUser?.phone || "-"}</TableCell>
                          <TableCell sx={{ textTransform: "capitalize" }}>{order.service}</TableCell>
                          <TableCell>
                            <Chip
                              label={order.paymentStatus === "partial" ? "Partial" : "Pending"}
                              size="small"
                              color={getPaymentChipColor(order.paymentStatus)}
                            />
                          </TableCell>
                          <TableCell>{formatINR(order.amountPaid || order.advanceAmount || 0)}</TableCell>
                          <TableCell>{formatINR(order.remainingAmount || 0)}</TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => handleMarkPaymentPaid(order)}
                              disabled={updatingPaymentOrderId === order.id}
                            >
                              Mark Paid
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {paymentFollowupOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>No unpaid orders for selected payment filter.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Orders</Typography>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  select
                  label="Service"
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value as "all" | OrderServiceType)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="all">All services</MenuItem>
                  <MenuItem value="tailoring">Tailoring</MenuItem>
                  <MenuItem value="fabric">Fabric</MenuItem>
                  <MenuItem value="dupatta">Dupatta</MenuItem>
                </TextField>

                <TextField
                  select
                  label="Status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value="all">All status</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="in progress">In Progress</MenuItem>
                  <MenuItem value="done">Done</MenuItem>
                </TextField>
              </Stack>

              <Box sx={{ overflowX: "auto" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Payment</TableCell>
                      <TableCell>Details</TableCell>
                      <TableCell>Approval</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const linkedUser = usersById[order.userId];
                      const userName = linkedUser?.name || "User";
                      const userPhone = linkedUser?.phone || "";
                      const nextStatus = getNextOrderStatus(order.status);
                      const currentApprovalStatus = order.approvalStatus || "pending";
                      const detailsText = createOrderDetailsText(order);
                      const sizeSummary = getOrderSizeSummary(order);

                      return (
                        <TableRow key={order.id}>
                          <TableCell>{userName}</TableCell>
                          <TableCell>{userPhone || "-"}</TableCell>
                          <TableCell sx={{ textTransform: "capitalize" }}>{order.service}</TableCell>
                          <TableCell>
                            <Stack spacing={0.6}>
                              <Chip
                                label={order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "partial" ? "Partial" : "Pending"}
                                size="small"
                                color={getPaymentChipColor(order.paymentStatus)}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {order.paymentType ? `Type: ${order.paymentType}` : "Type: -"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Amount: {formatINR(getOrderAmount(order))}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 260 }}>
                            <Stack spacing={0.3}>
                              {sizeSummary ? (
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                  {sizeSummary}
                                </Typography>
                              ) : null}
                              <Typography variant="body2">{detailsText || "-"}</Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={currentApprovalStatus.charAt(0).toUpperCase() + currentApprovalStatus.slice(1)}
                              size="small"
                              color={getApprovalChipColor(currentApprovalStatus)}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip label={formatStatusLabel(order.status)} size="small" color={order.status === "done" ? "success" : "warning"} />
                          </TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                onClick={() => handleApprovalStatus(order, "accepted")}
                                disabled={updatingApprovalOrderId === order.id || currentApprovalStatus === "accepted"}
                              >
                                Accept
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleApprovalStatus(order, "rejected")}
                                disabled={updatingApprovalOrderId === order.id || currentApprovalStatus === "rejected"}
                              >
                                Reject
                              </Button>

                              {nextStatus ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleAdvanceStatus(order)}
                                  disabled={updatingOrderId === order.id}
                                >
                                  Mark {formatStatusLabel(nextStatus)}
                                </Button>
                              ) : (
                                <Chip label="Done" size="small" color="success" />
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9}>No orders found for selected filters.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
                <Typography variant="h5">Users</Typography>
                <TextField
                  label="Search users"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or phone"
                  size="small"
                  sx={{ width: { xs: "100%", sm: 280 } }}
                />
              </Stack>

              <Box sx={{ overflowX: "auto" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Total Orders</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {searchedUsers.map((appUser) => {
                      const isWorking = updatingUserRoleId === appUser.id || deletingUserId === appUser.id;

                      return (
                        <TableRow key={appUser.id}>
                          <TableCell>{appUser.name || "-"}</TableCell>
                          <TableCell>{appUser.phone || "-"}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={appUser.role === "admin" ? "Admin" : "User"}
                              color={appUser.role === "admin" ? "success" : "default"}
                            />
                          </TableCell>
                          <TableCell>{orderCountByUserId[appUser.id] || 0}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1}>
                              {appUser.role === "admin" ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleSetUserRole(appUser, "user")}
                                  disabled={isWorking}
                                >
                                  Remove Admin
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="success"
                                  onClick={() => handleSetUserRole(appUser, "admin")}
                                  disabled={isWorking}
                                >
                                  Make Admin
                                </Button>
                              )}

                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => handleDeleteUser(appUser)}
                                disabled={isWorking}
                              >
                                Delete
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {searchedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>No users found.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6">Product Data Tools</Typography>
                <Chip label="Dev" size="small" color="warning" />
              </Stack>

              <Typography variant="body2" color="text.secondary">
                Use these tools to populate or reset the Firestore products collection during testing.
                Seeding is skipped automatically if the collection already has data.
              </Typography>

              {seedMessage ? (
                <Alert
                  severity={seedStatus === "done" ? "success" : "info"}
                  onClose={() => setSeedMessage("")}
                >
                  {seedMessage}
                </Alert>
              ) : null}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={seedStatus === "seeding" || seedStatus === "clearing"}
                  onClick={async () => {
                    setSeedStatus("seeding");
                    setSeedMessage("");
                    const added = await seedDummyProducts();
                    setSeedStatus("done");
                    setSeedMessage(
                      added > 0
                        ? `Seeded ${added} dummy products successfully.`
                        : "Collection already has products — seed skipped.",
                    );
                  }}
                >
                  {seedStatus === "seeding" ? "Seeding..." : "Seed Dummy Data"}
                </Button>

                <Button
                  variant="outlined"
                  color="error"
                  disabled={seedStatus === "seeding" || seedStatus === "clearing"}
                  onClick={async () => {
                    if (!window.confirm("Delete ALL products from Firestore? This cannot be undone.")) {
                      return;
                    }

                    setSeedStatus("clearing");
                    setSeedMessage("");
                    const deleted = await clearDummyProducts(true);
                    setSeedStatus("done");
                    setSeedMessage(
                      deleted > 0
                        ? `Deleted ${deleted} products from Firestore.`
                        : "No products found to delete.",
                    );
                  }}
                >
                  {seedStatus === "clearing" ? "Clearing..." : "Clear All Products"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Layout>
  );
}
