"use client";

import {
  Alert,
  Box,
  CircularProgress,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Grid2,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import RKStudioLogo from "@/components/common/RKStudioLogo";
import Layout from "@/components/layout/Layout";
import { useGlobalLoading } from "@/context/LoadingContext";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth } from "@/services/firebase";
import { createMockAccessToken } from "@/services/authService";
import { useOrders } from "@/hooks/useOrders";
import {
  markOrderPaymentAsPaid,
  normalizeOrderStatus,
  OrderDetails,
  OrderServiceType,
  OrderStatus,
  updateOrderStatus,
  UserOrder,
} from "@/services/orderService";
import { AppUser, deleteUserById, subscribeToAllUsers, updateUserRole } from "@/services/userService";
import { clearDummyProducts, seedDummyProducts } from "@/services/productService";
import { useAutoSeed } from "@/hooks/useAutoSeed";
import PreLaunchFlow from "@/features/admin/PreLaunchFlow";
import { UserRole } from "@/types/auth";
import { hideToast, showError, showLoading, showSuccess } from "@/utils/toast";
import { getFriendlyErrorMessage } from "@/utils/uiFeedback";

const formatStatusLabel = (status: OrderStatus) => {
  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "stitching" || status === "in_progress" || status === "in progress") return "Stitching";
  if (status === "ready") return "Ready";
  if (status === "delivered" || status === "done") return "Delivered";
  return status;
};

const getStatusChipColor = (status: OrderStatus) => {
  if (status === "pending") return "warning" as const;
  if (status === "accepted") return "success" as const;
  if (status === "rejected") return "error" as const;
  if (status === "stitching" || status === "in_progress" || status === "in progress") return "info" as const;
  if (status === "ready") return "secondary" as const;
  if (status === "delivered" || status === "done") return "default" as const;
  return "default" as const;
};

const getStatusChipSx = (status: OrderStatus) => {
  const normalized = normalizeOrderStatus(status);

  if (normalized === "accepted") {
    return {
      bgcolor: "#DBEAFE",
      color: "#1D4ED8",
      border: "1px solid #93C5FD",
      fontWeight: 600,
    };
  }

  if (normalized === "rejected") {
    return {
      bgcolor: "#FEE2E2",
      color: "#991B1B",
      border: "1px solid #FCA5A5",
      fontWeight: 600,
    };
  }

  if (normalized === "pending") {
    return {
      bgcolor: "#FEF3C7",
      color: "#92400E",
      border: "1px solid #FCD34D",
      fontWeight: 600,
    };
  }

  return undefined;
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

type SalesPoint = {
  key: string;
  label: string;
  amount: number;
};

type SalesRange = 7 | 15 | 30;
type PaymentFollowupFilter = "all" | "partial" | "pending";
type StatusFilter = "all" | "completed" | OrderStatus;

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
  const theme = useTheme();
  const isMobileOrders = useMediaQuery(theme.breakpoints.down("sm"));
  const { user } = useAuth();
  const { trackAsync } = useGlobalLoading();
  const { orders, error: ordersError } = useOrders({ mode: "all", mockMode: user?.provider === "mock" });
  const [users, setUsers] = useState<AppUser[]>([]);
  const [salesRange, setSalesRange] = useState<SalesRange>(7);
  const [search, setSearch] = useState("");
  const [orderPhoneFilter, setOrderPhoneFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState<"all" | OrderServiceType>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFollowupFilter, setPaymentFollowupFilter] = useState<PaymentFollowupFilter>("all");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [ordersPage, setOrdersPage] = useState(0);
  const [updatingPaymentOrderId, setUpdatingPaymentOrderId] = useState("");
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
        Authorization: `Bearer ${createMockAccessToken(user)}`,
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
    } catch (readinessError) {
      showError(getFriendlyErrorMessage(readinessError, "Could not load readiness status."));
    } finally {
      setReadinessLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const unsubscribeUsers = subscribeToAllUsers(setUsers, () => {
      showError("Could not load users.");
    });

    return () => {
      unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    if (ordersError) {
      showError(ordersError);
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

  const pendingOrdersCount = useMemo(
    () => orders.filter((order) => normalizeOrderStatus(order.status) === "pending").length,
    [orders],
  );

  const completedOrdersCount = useMemo(
    () => orders.filter((order) => ["delivered", "done"].includes(normalizeOrderStatus(order.status))).length,
    [orders],
  );

  const todayRevenue = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    return orders
      .filter((order) => order.paymentStatus === "paid" && order.createdAt?.toDate && order.createdAt.toDate() >= start)
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
    const normalizedPhoneFilter = orderPhoneFilter.replace(/\D/g, "");
    const fromTime = fromDateFilter ? new Date(`${fromDateFilter}T00:00:00`).getTime() : null;
    const toTime = toDateFilter ? new Date(`${toDateFilter}T23:59:59.999`).getTime() : null;

    return orders.filter((order) => {
      const linkedUser = usersById[order.userId];
      const byService = serviceFilter === "all" || order.service === serviceFilter;
      const byStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && ["delivered", "done"].includes(normalizeOrderStatus(order.status))) ||
        order.status === statusFilter ||
        (statusFilter === "in progress" && order.status === ("in_progress" as OrderStatus));

      const candidatePhone = ((order.phone || linkedUser?.phone || "").replace(/\D/g, ""));
      const byPhone = !normalizedPhoneFilter || candidatePhone.includes(normalizedPhoneFilter);

      const orderTime = order.createdAt?.toDate?.().getTime?.() || 0;
      const byFromDate = fromTime === null || orderTime >= fromTime;
      const byToDate = toTime === null || orderTime <= toTime;

      return byService && byStatus && byPhone && byFromDate && byToDate;
    });
  }, [orders, serviceFilter, statusFilter, orderPhoneFilter, fromDateFilter, toDateFilter, usersById]);

  const paginatedOrders = useMemo(() => {
    const start = ordersPage * 20;
    return filteredOrders.slice(start, start + 20);
  }, [filteredOrders, ordersPage]);

  useEffect(() => {
    setOrdersPage(0);
  }, [serviceFilter, statusFilter, orderPhoneFilter, fromDateFilter, toDateFilter]);

  useEffect(() => {
    const allowedIds = new Set(filteredOrders.map((order) => order.id));
    setSelectedOrderIds((prev) => prev.filter((id) => allowedIds.has(id)));
  }, [filteredOrders]);

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

  const handleUpdateStatus = async (order: UserOrder, status: OrderStatus, successNote: string) => {
    const loadingToastId = showLoading("Updating order status...");

    try {
      setUpdatingOrderId(order.id);
      await trackAsync(updateOrderStatus(order.id, status, user?.phoneNumber || "admin", "Updated by admin"));

      const linkedUser = usersById[order.userId];
      const targetPhone = (order.phone || linkedUser?.phone || "").trim();

      if (status === "accepted") {
        if (!targetPhone) {
          showError("User phone number is missing. Cannot open WhatsApp notification.");
        } else {
          const amount = Math.round(Number(order.total || order.finalPayable || order.finalPrice || order.totalPrice || getOrderAmount(order) || 0));
          const message = `Your order is accepted ✅\nOrder ID: ${order.id}\nAmount: ₹${amount}`;
          const phone = targetPhone.replace("+", "");
          const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          window.open(url, "_blank");
        }
      }

      showSuccess(successNote);
    } catch (statusError) {
      showError(getFriendlyErrorMessage(statusError, "Could not update order status."));
    } finally {
      hideToast(loadingToastId);
      setUpdatingOrderId("");
    }
  };

  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      }

      return [...prev, orderId];
    });
  };

  const handleToggleSelectAllVisible = () => {
    const visibleIds = paginatedOrders.map((order) => order.id);

    setSelectedOrderIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.includes(id));

      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const handleBulkStatusUpdate = async (status: "stitching" | "delivered") => {
    if (selectedOrderIds.length === 0) {
      showError("Select at least one order for bulk update.");
      return;
    }

    try {
      setUpdatingOrderId("bulk");

      await Promise.all(
        selectedOrderIds.map((orderId) =>
          trackAsync(updateOrderStatus(orderId, status, user?.phoneNumber || "admin", "Bulk updated by admin")),
        ),
      );

      showSuccess(`Updated ${selectedOrderIds.length} orders to ${status}.`);
      setSelectedOrderIds([]);
      setOrdersPage(0);
    } catch (bulkError) {
      showError(getFriendlyErrorMessage(bulkError, "Could not apply bulk status update."));
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
      showSuccess("Payment status marked as paid.");
    } catch (paymentError) {
      showError(getFriendlyErrorMessage(paymentError, "Could not mark payment as paid."));
    } finally {
      setUpdatingPaymentOrderId("");
    }
  };

  const handleSetUserRole = async (appUser: AppUser, nextRole: UserRole) => {
    if (appUser.role === nextRole) {
      return;
    }

    try {
      setUpdatingUserRoleId(appUser.id);
      await trackAsync(updateUserRole(appUser.id, nextRole));
      showSuccess(`${appUser.name || "User"} is now ${nextRole}.`);
    } catch (roleError) {
      showError(getFriendlyErrorMessage(roleError, "Could not update user role."));
    } finally {
      setUpdatingUserRoleId("");
    }
  };

  const handleDeleteUser = async (appUser: AppUser) => {
    const myPhone = (user?.phoneNumber || "").replace(/\D/g, "").slice(-10);
    const targetPhone = (appUser.phone || "").replace(/\D/g, "").slice(-10);

    if (myPhone && myPhone === targetPhone) {
      showError("You cannot delete your own admin account.");
      return;
    }

    const confirmed = window.confirm(`Delete user ${appUser.name || appUser.phone || "this user"}?`);

    if (!confirmed) {
      return;
    }

    try {
      setDeletingUserId(appUser.id);
      await trackAsync(deleteUserById(appUser.id));
      showSuccess("User deleted successfully.");
    } catch (deleteError) {
      showError(getFriendlyErrorMessage(deleteError, "Could not delete user."));
    } finally {
      setDeletingUserId("");
    }
  };

  const renderOrderActionButtons = (order: UserOrder, isUpdatingThisRow: boolean, mobile = false) => (
    <Stack direction={mobile ? "column" : "row"} spacing={0.8} useFlexGap flexWrap={mobile ? "nowrap" : "wrap"} sx={{ width: mobile ? "100%" : "auto" }}>
      <Button
        size="small"
        variant="outlined"
        color="success"
        onClick={() => handleUpdateStatus(order, "accepted", "Order accepted.")}
        disabled={isUpdatingThisRow || normalizeOrderStatus(order.status) === "accepted"}
        sx={{ minWidth: "fit-content", width: mobile ? "100%" : "auto" }}
      >
        {isUpdatingThisRow ? <CircularProgress size={14} /> : "Accept"}
      </Button>

      <Button
        size="small"
        variant="outlined"
        color="error"
        onClick={() => handleUpdateStatus(order, "rejected", "Order rejected.")}
        disabled={isUpdatingThisRow || normalizeOrderStatus(order.status) === "rejected"}
        sx={{ minWidth: "fit-content", width: mobile ? "100%" : "auto" }}
      >
        {isUpdatingThisRow ? <CircularProgress size={14} /> : "Reject"}
      </Button>

      <Button
        size="small"
        variant="outlined"
        color="info"
        onClick={() => handleUpdateStatus(order, "stitching", "Order moved to stitching.")}
        disabled={isUpdatingThisRow || normalizeOrderStatus(order.status) === "stitching"}
        sx={{ minWidth: "fit-content", width: mobile ? "100%" : "auto" }}
      >
        {isUpdatingThisRow ? <CircularProgress size={14} /> : "In Progress"}
      </Button>

      <Button
        size="small"
        variant="outlined"
        onClick={() => handleUpdateStatus(order, "delivered", "Order marked completed.")}
        disabled={isUpdatingThisRow || ["delivered", "done"].includes(normalizeOrderStatus(order.status))}
        sx={{ minWidth: "fit-content", width: mobile ? "100%" : "auto" }}
      >
        {isUpdatingThisRow ? <CircularProgress size={14} /> : "Completed"}
      </Button>
    </Stack>
  );

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
                <Typography variant="body2" color="text.secondary">Pending Orders</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{pendingOrdersCount}</Typography>
              </CardContent>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Completed Orders</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{completedOrdersCount}</Typography>
              </CardContent>
            </Card>
          </Grid2>

          <Grid2 size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">Revenue Today</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatINR(todayRevenue)}</Typography>
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

              <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
                <TextField
                  label="Filter by phone"
                  value={orderPhoneFilter}
                  onChange={(event) => setOrderPhoneFilter(event.target.value)}
                  placeholder="10 digits"
                  size="small"
                  sx={{ minWidth: 180 }}
                />
                <TextField
                  type="date"
                  label="From"
                  value={fromDateFilter}
                  onChange={(event) => setFromDateFilter(event.target.value)}
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ minWidth: 140 }}
                />
                <TextField
                  type="date"
                  label="To"
                  value={toDateFilter}
                  onChange={(event) => setToDateFilter(event.target.value)}
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ minWidth: 140 }}
                />
                <TextField
                  select
                  label="Service"
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value as "all" | OrderServiceType)}
                  size="small"
                  sx={{ minWidth: 140 }}
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
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  size="small"
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="all">All status</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="accepted">Accepted</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="stitching">Stitching</MenuItem>
                  <MenuItem value="ready">Ready</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                </TextField>
              </Stack>

              {!isMobileOrders && selectedOrderIds.length > 0 ? (
                <Alert severity="info">
                  {selectedOrderIds.length} orders selected |{" "}
                  <Button
                    size="small"
                    onClick={() => handleBulkStatusUpdate("stitching")}
                    disabled={updatingOrderId === "bulk"}
                    sx={{ ml: 1 }}
                  >
                    Bulk: Stitching
                  </Button>
                  <Button
                    size="small"
                    onClick={() => handleBulkStatusUpdate("delivered")}
                    disabled={updatingOrderId === "bulk"}
                    sx={{ ml: 1 }}
                  >
                    Bulk: Delivered
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setSelectedOrderIds([])}
                    sx={{ ml: 1 }}
                  >
                    Clear
                  </Button>
                </Alert>
              ) : null}

              {isMobileOrders ? (
                <Stack spacing={1.5}>
                  {paginatedOrders.map((order) => {
                    const linkedUser = usersById[order.userId];
                    const userName = linkedUser?.name || "User";
                    const userPhone = linkedUser?.phone || "-";
                    const isUpdatingThisRow = updatingOrderId === order.id;

                    return (
                      <Card
                        key={`order-mobile-${order.id}`}
                        variant="outlined"
                        sx={{
                          borderRadius: 2.5,
                          boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
                        }}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Stack spacing={1.2}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{userName}</Typography>
                            <Typography variant="body2" color="text.secondary">{userPhone}</Typography>

                            <Typography variant="caption" color="text.secondary">
                              {`Order ${order.orderCode || order.id.slice(0, 8)} | ${formatDate(order.createdAt)} | ${formatINR(Number(order.total || order.finalPayable || order.finalPrice || order.totalPrice || getOrderAmount(order) || 0))}`}
                            </Typography>

                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                              <Chip
                                label={formatStatusLabel(order.status)}
                                size="small"
                                color={getStatusChipColor(order.status)}
                                sx={getStatusChipSx(order.status)}
                              />
                              <Chip
                                label={order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "partial" ? "Partial" : "Pending"}
                                size="small"
                                color={getPaymentChipColor(order.paymentStatus)}
                              />
                            </Stack>

                            {renderOrderActionButtons(order, isUpdatingThisRow, true)}
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {paginatedOrders.length === 0 ? (
                    <Alert severity="info">No orders found for filters.</Alert>
                  ) : null}
                </Stack>
              ) : (
                <Box sx={{ overflowX: "auto" }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={
                              paginatedOrders.length > 0
                              && paginatedOrders.every((order) => selectedOrderIds.includes(order.id))
                            }
                            indeterminate={
                              paginatedOrders.some((order) => selectedOrderIds.includes(order.id))
                              && !paginatedOrders.every((order) => selectedOrderIds.includes(order.id))
                            }
                            onChange={handleToggleSelectAllVisible}
                          />
                        </TableCell>
                        <TableCell>Order Code</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell>Items</TableCell>
                        <TableCell>Total</TableCell>
                        <TableCell>Payment</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedOrders.map((order) => {
                        const linkedUser = usersById[order.userId];
                        const userName = linkedUser?.name || "User";
                        const userPhone = linkedUser?.phone || "";
                        const detailsText = createOrderDetailsText(order);
                        const displayItems = (order.items && order.items.length > 0)
                          ? order.items.join(", ")
                          : detailsText || order.service;
                        const totalAmount = order.total || order.finalPayable || order.finalPrice || order.totalPrice || getOrderAmount(order);
                        const isUpdatingThisRow = updatingOrderId === order.id;

                        return (
                          <TableRow key={order.id}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                size="small"
                                checked={selectedOrderIds.includes(order.id)}
                                onChange={() => handleToggleOrderSelection(order.id)}
                              />
                            </TableCell>
                            <TableCell>{order.orderCode || order.id.slice(0, 8)}</TableCell>
                            <TableCell>{userName}</TableCell>
                            <TableCell>{userPhone || "-"}</TableCell>
                            <TableCell sx={{ maxWidth: 200, fontSize: "0.85rem" }}>
                              <Typography variant="body2">{displayItems}</Typography>
                            </TableCell>
                            <TableCell>{formatINR(Number(totalAmount || 0))}</TableCell>
                            <TableCell>
                              <Chip
                                label={order.paymentStatus === "paid" ? "Paid" : order.paymentStatus === "partial" ? "Partial" : "Pending"}
                                size="small"
                                color={getPaymentChipColor(order.paymentStatus)}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={formatStatusLabel(order.status)}
                                size="small"
                                color={getStatusChipColor(order.status)}
                                sx={getStatusChipSx(order.status)}
                              />
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{formatDate(order.createdAt)}</TableCell>
                            <TableCell>{renderOrderActionButtons(order, isUpdatingThisRow)}</TableCell>
                          </TableRow>
                        );
                      })}

                      {paginatedOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10}>No orders found for filters.</TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </Box>
              )}

              {filteredOrders.length > 20 ? (
                <TablePagination
                  component="div"
                  count={filteredOrders.length}
                  page={ordersPage}
                  onPageChange={(event, newPage) => setOrdersPage(newPage)}
                  rowsPerPage={20}
                  onRowsPerPageChange={() => {}}
                  rowsPerPageOptions={[20]}
                  sx={{ justifyContent: "flex-end" }}
                />
              ) : null}
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
