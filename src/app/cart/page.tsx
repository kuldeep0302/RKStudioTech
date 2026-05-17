"use client";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { formatINR } from "@/utils/currency";
import { FabricCartItem, readFabricCart, removeFabricCartItem, clearFabricCart } from "@/utils/fabricCart";
import { createPendingPaymentToken, savePendingPaymentOrder } from "@/utils/paymentSession";

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<FabricCartItem[]>([]);

  useEffect(() => {
    setItems(readFabricCart());
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.total_price, 0),
    [items],
  );

  const handleRemove = (id: string) => {
    removeFabricCartItem(id);
    setItems(readFabricCart());
  };

  const handleClear = () => {
    clearFabricCart();
    setItems([]);
  };

  const handleCheckoutItem = (item: FabricCartItem) => {
    const token = createPendingPaymentToken();

    savePendingPaymentOrder(token, {
      service: item.category === "dupatta" ? "dupatta" : "fabric",
      userId: user?.uid || "guest-user",
      customerName: user?.displayName || "Customer",
      customerPhone: user?.phoneNumber || "Not provided",
      orderDetails: {
        productId: item.productId,
        cart_item_id: item.id,
        productName: item.name,
        product_type: item.product_type,
        unit_label: item.unit_label,
        price_per_unit: item.price_per_unit,
        selected_quantity: item.selected_quantity,
        total_price: item.total_price,
        type: item.type || "fabric",
      },
      productId: item.productId,
      amount: item.total_price,
      paymentType: "full",
      whatsappDetails: [
        `Product: ${item.name}`,
        `Price per ${item.unit_label}: INR ${item.price_per_unit}`,
        `Selected ${item.unit_label}: ${item.selected_quantity}`,
        `Total: INR ${item.total_price}`,
      ],
    });

    router.push(`/checkout?token=${encodeURIComponent(token)}`);
  };

  const handleCheckoutAll = () => {
    if (items.length === 0) {
      return;
    }

    const token = createPendingPaymentToken();
    const allSuitItems = items.every((item) => item.category === "dupatta");
    const whatsappLines = items.flatMap((item, index) => [
      `Item ${index + 1}: ${item.name}`,
      `Quantity: ${item.selected_quantity} ${item.unit_label}`,
      `Rate: INR ${item.price_per_unit}/${item.unit_label}`,
      `Line total: INR ${item.total_price}`,
    ]);

    savePendingPaymentOrder(token, {
      service: allSuitItems ? "dupatta" : "fabric",
      userId: user?.uid || "guest-user",
      customerName: user?.displayName || "Customer",
      customerPhone: user?.phoneNumber || "Not provided",
      orderDetails: {
        checkout_mode: "cart_all",
        cart_item_ids: items.map((item) => item.id),
        item_count: items.length,
        total_price: subtotal,
      },
      amount: subtotal,
      paymentType: "full",
      whatsappDetails: [
        `Combined cart checkout`,
        `Items: ${items.length}`,
        ...whatsappLines,
        `Grand Total: INR ${subtotal}`,
      ],
    });

    router.push(`/checkout?token=${encodeURIComponent(token)}`);
  };

  return (
    <Layout>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Typography variant="h3">Cart</Typography>
          {items.length > 0 ? (
            <Button variant="outlined" color="error" onClick={handleClear}>
              Clear Cart
            </Button>
          ) : null}
        </Stack>

        {items.length === 0 ? (
          <Alert severity="info">Cart khali hai. Fabric page se products add karein.</Alert>
        ) : null}

        {items.length > 0 ? (
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2}>
                {items.map((item) => (
                  <Card
                    key={item.id}
                    sx={{
                      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                      borderRadius: 2,
                    }}
                  >
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box sx={{ position: "relative", width: "100%", height: 140, borderRadius: 1.5, overflow: "hidden" }}>
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="(max-width: 900px) 100vw, 33vw"
                              style={{ objectFit: "cover" }}
                            />
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 8 }}>
                          <Stack spacing={1}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              {item.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Price per {item.unit_label}: {formatINR(item.price_per_unit)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Selected {item.unit_label}: {item.selected_quantity}
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 700 }}>
                              {formatINR(item.price_per_unit)} x {item.selected_quantity} {item.unit_label} = {formatINR(item.total_price)}
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              <Button
                                component={Link}
                                href={`/product/${encodeURIComponent(item.productId)}?category=${encodeURIComponent(item.category)}`}
                                variant="outlined"
                                size="small"
                              >
                                {item.unit_label === "meter" ? "Edit Meter" : "Edit Quantity"}
                              </Button>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleCheckoutItem(item)}
                              >
                                Checkout
                              </Button>
                              <Button
                                variant="text"
                                color="error"
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => handleRemove(item.id)}
                                size="small"
                              >
                                Remove
                              </Button>
                            </Stack>
                          </Stack>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card sx={{ boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)", borderRadius: 2 }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ShoppingBagOutlinedIcon color="primary" />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        Cart Summary
                      </Typography>
                    </Stack>
                    <Divider />
                    <Typography variant="body2" color="text.secondary">
                      Items: {items.length}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                      Total: {formatINR(subtotal)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Unit wise total already calculated for each product.
                    </Typography>
                    <Button variant="contained" color="primary" onClick={handleCheckoutAll}>
                      Checkout All
                    </Button>
                    <Button component={Link} href="/fabric" variant="contained">
                      Add More Fabric
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : null}
      </Stack>
    </Layout>
  );
}
