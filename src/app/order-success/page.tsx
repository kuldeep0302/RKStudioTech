"use client";

import { Suspense } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import OrderTimeline from "@/components/orders/OrderTimeline";
import Layout from "@/components/layout/Layout";

// keyframe bounce-in for the icon
const bounceIn = `
  @keyframes bounceIn {
    0%   { transform: scale(0.3); opacity: 0; }
    50%  { transform: scale(1.15); opacity: 1; }
    70%  { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
`;

// Subtle confetti dots rendered as absolutely-positioned spans
function ConfettiDots() {
  const dots = [
    { top: "12%", left: "8%",  color: "#22C55E", size: 10, delay: "0s" },
    { top: "8%",  left: "25%", color: "#3B82F6", size: 8,  delay: "0.1s" },
    { top: "18%", left: "72%", color: "#F59E0B", size: 12, delay: "0.15s" },
    { top: "10%", left: "88%", color: "#EC4899", size: 9,  delay: "0.05s" },
    { top: "28%", left: "5%",  color: "#8B5CF6", size: 7,  delay: "0.2s" },
    { top: "22%", left: "93%", color: "#06B6D4", size: 11, delay: "0.12s" },
  ];

  const fadeUp = `
    @keyframes fadeUp {
      0%   { transform: translateY(0) scale(1); opacity: 1; }
      100% { transform: translateY(-40px) scale(0.4); opacity: 0; }
    }
  `;

  return (
    <>
      <style>{fadeUp}</style>
      {dots.map((d, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            borderRadius: "50%",
            backgroundColor: d.color,
            animation: `fadeUp 1.8s ${d.delay} ease-out both`,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const orderCode = searchParams.get("orderCode") || orderId;
  const amountRaw = searchParams.get("amount") || "";
  const amount = amountRaw ? Number(amountRaw) : null;

  return (
    <Layout>
      <Box
        sx={{
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            maxWidth: 520,
            borderRadius: 4,
            overflow: "visible",
            position: "relative",
            p: { xs: 3, sm: 5 },
          }}
        >
          <ConfettiDots />

          <Stack spacing={3} alignItems="center">
            {/* Animated check icon */}
            <style>{bounceIn}</style>
            <Box
              sx={{
                animation: "bounceIn 0.7s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
                display: "flex",
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 88, color: "success.main" }} />
            </Box>

            {/* Title */}
            <Stack spacing={0.5} alignItems="center" textAlign="center">
              <Typography variant="h5" fontWeight={800}>
                Order Placed Successfully 🎉
              </Typography>
              <Typography variant="body2" color="text.secondary">
                We&apos;ve received your order. Our team will review it shortly.
              </Typography>
            </Stack>

            <Divider sx={{ width: "100%" }} />

            {/* Order summary info */}
            <Stack
              spacing={1.5}
              sx={{
                width: "100%",
                bgcolor: "grey.50",
                borderRadius: 2,
                p: 2,
                border: "1px solid",
                borderColor: "grey.200",
              }}
            >
              {orderCode && (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Order ID
                  </Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ fontFamily: "monospace" }}>
                    {orderCode}
                  </Typography>
                </Stack>
              )}
              {amount !== null && amount > 0 && (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Amount Paid
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    ₹{amount.toLocaleString("en-IN")}
                  </Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label="Pending"
                  size="small"
                  color="warning"
                  variant="filled"
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
            </Stack>

            {/* Timeline */}
            <Box sx={{ width: "100%" }}>
              <OrderTimeline status="pending" />
            </Box>

            <Divider sx={{ width: "100%" }} />

            {/* Action buttons */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              sx={{ width: "100%" }}
            >
              <Button
                component={Link}
                href="/my-orders"
                variant="contained"
                color="primary"
                startIcon={<TrackChangesIcon />}
                fullWidth
                size="large"
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                Track Order
              </Button>
              <Button
                component={Link}
                href="/"
                variant="outlined"
                color="inherit"
                startIcon={<ShoppingBagOutlinedIcon />}
                fullWidth
                size="large"
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                Continue Shopping
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Layout>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OrderSuccessContent />
    </Suspense>
  );
}

