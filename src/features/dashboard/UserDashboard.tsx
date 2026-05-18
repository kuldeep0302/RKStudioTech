"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useOrders } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { OrderHistoryItem, OrderStatus, UserOrder } from "@/services/orderService";
import { AppUser, saveUserToFirestore, subscribeToUser } from "@/services/userService";

const formatOrderDate = (order: UserOrder) => {
  if (!order.createdAt) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(order.createdAt.toDate());
};

const formatStatus = (status: OrderStatus) => {
  if (status === "in_progress" || status === "in progress") {
    return "Stitching";
  }

  if (status === "done") {
    return "Delivered";
  }

  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "stitching") return "Stitching";
  if (status === "ready") return "Ready";
  if (status === "delivered") return "Delivered";

  return status;
};

const getStatusChipColor = (status: OrderStatus) => {
  if (status === "pending") return "warning" as const;
  if (status === "accepted") return "success" as const;
  if (status === "rejected") return "error" as const;
  if (status === "stitching" || status === "in progress" || status === "in_progress") return "info" as const;
  if (status === "ready") return "secondary" as const;
  if (status === "delivered" || status === "done") return "default" as const;
  return "default" as const;
};

const formatHistoryDate = (history: OrderHistoryItem) => {
  const maybeTimestamp = history.updatedAt as { toDate?: () => Date } | null;

  if (!maybeTimestamp || typeof maybeTimestamp.toDate !== "function") {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(maybeTimestamp.toDate());
};

const buildTailoringHref = (selectedFabricId?: string, compareFabricIds: string[] = []) => {
  const params = new URLSearchParams();

  if (selectedFabricId) {
    params.set("fabric", selectedFabricId);
  }

  if (compareFabricIds.length > 0) {
    params.set("compare", compareFabricIds.join(","));
  }

  const queryString = params.toString();
  return queryString ? `/tailoring?${queryString}` : "/tailoring";
};

export default function UserDashboard() {
  const { user } = useAuth();
  const { orders, loading, error } = useOrders({ mode: "user", userId: user?.uid, mockMode: user?.provider === "mock" });
  const { products } = useProducts({ category: "fabric" });
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [profileError, setProfileError] = useState("");
  const [removingFabricId, setRemovingFabricId] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      return;
    }

    if (user.provider === "mock") {
      setProfile(null);
      setProfileError("");
      return;
    }

    const unsubscribe = subscribeToUser(
      user.uid,
      (nextProfile) => {
        setProfile(nextProfile);
        setProfileError("");
      },
      () => {
        setProfileError("Could not load saved fabric.");
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const savedFabricProducts = useMemo(() => {
    const savedIds = profile?.savedFabricIds || [];

    return savedIds
      .map((savedId) => products.find((product) => product.id === savedId) || null)
      .filter((product): product is NonNullable<typeof product> => Boolean(product));
  }, [products, profile?.savedFabricIds]);

  const handleRemoveSavedFabric = async (productId: string) => {
    if (!user?.uid || !profile) {
      return;
    }

    const nextSavedFabricIds = (profile.savedFabricIds || []).filter((savedId) => savedId !== productId);
    const previousProfile = profile;

    setRemovingFabricId(productId);
    setProfile({
      ...profile,
      savedFabricIds: nextSavedFabricIds,
    });
    setProfileError("");

    try {
      await saveUserToFirestore({
        uid: user.uid,
        name: user.displayName || previousProfile.name || "Customer",
        phone: user.phoneNumber || previousProfile.phone || "-",
        savedFabricIds: nextSavedFabricIds,
      });
    } catch {
      setProfile(previousProfile);
      setProfileError("Could not update saved fabric.");
    } finally {
      setRemovingFabricId("");
    }
  };

  return (
    <Layout>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h4">My Dashboard</Typography>
            <Typography color="text.secondary">Your active orders and details are shown here.</Typography>
            <Typography>
              Login phone: <strong>{user?.phoneNumber || "-"}</strong>
            </Typography>
            <Typography color="text.secondary">Serving Narnaul (123001) | Home visit service available</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button component={Link} href="/my-orders" variant="contained">
                Open Full Order Tracking
              </Button>
              <Button component={Link} href="/profile" variant="outlined">
                Update Profile
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography variant="h5">Saved Fabric</Typography>
                <Typography color="text.secondary">Your saved fabric options appear here.</Typography>
              </Box>
              <Button component={Link} href="/tailoring" variant="outlined">
                Open Tailoring Picker
              </Button>
            </Stack>

            {profileError ? <Alert severity="warning">{profileError}</Alert> : null}

            {savedFabricProducts.length === 0 ? (
              <Alert severity="info">No saved fabric yet. Save items from the tailoring page.</Alert>
            ) : (
              <Grid container spacing={2}>
                {savedFabricProducts.map((product) => {
                  const comparePartner = savedFabricProducts.find((savedProduct) => savedProduct.id !== product.id) || null;
                  const tailoringHref = buildTailoringHref(product.id);
                  const compareHref = comparePartner
                    ? buildTailoringHref(product.id, [product.id, comparePartner.id])
                    : tailoringHref;

                  return (
                  <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card variant="outlined" sx={{ height: "100%" }}>
                      <Box
                        component="img"
                        src={product.image}
                        alt={product.name}
                        sx={{ width: "100%", height: 180, objectFit: "cover" }}
                      />
                      <CardContent>
                        <Stack spacing={1}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {product.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {product.type} | {product.tag}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            INR {product.price}
                            {product.discountPercent ? ` | ${product.discountPercent}% off` : ""}
                            {product.rating ? ` | ${product.rating.toFixed(1)} rating` : ""}
                          </Typography>
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Button component={Link} href={tailoringHref} variant="contained" size="small">
                              Use in Tailoring
                            </Button>
                            <Button
                              component={Link}
                              href={compareHref}
                              variant="outlined"
                              size="small"
                              disabled={!comparePartner}
                            >
                              Compare in Tailoring
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              disabled={removingFabricId === product.id}
                              onClick={() => handleRemoveSavedFabric(product.id)}
                            >
                              {removingFabricId === product.id ? "Removing..." : "Remove"}
                            </Button>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );})}
              </Grid>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">My Orders</Typography>

            {error ? <Alert severity="error">{error}</Alert> : null}

            {loading ? (
              <Stack alignItems="center" py={6}>
                <CircularProgress />
              </Stack>
            ) : null}

            {!loading && orders.length === 0 ? (
              <Alert severity="info">No orders yet. Place an order from Tailoring, Fabric, or Dupatta pages.</Alert>
            ) : null}

            {!loading && orders.length > 0 ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                      <TableCell>Status Timeline</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell sx={{ textTransform: "capitalize" }}>{order.service}</TableCell>
                        <TableCell>
                          <Chip label={formatStatus(order.status)} color={getStatusChipColor(order.status)} size="small" />
                        </TableCell>
                        <TableCell>{formatOrderDate(order)}</TableCell>
                        <TableCell>
                          <Stack spacing={0.8}>
                            {order.statusHistory.length > 0
                              ? order.statusHistory.map((history, index) => (
                                  <Typography key={`${order.id}-${index}`} variant="caption" color="text.secondary">
                                    {formatStatus(history.status)} - {formatHistoryDate(history)}
                                  </Typography>
                                ))
                              : <Typography variant="caption" color="text.secondary">No history yet</Typography>}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : null}
          </Stack>
        </CardContent>
      </Card>
    </Layout>
  );
}
