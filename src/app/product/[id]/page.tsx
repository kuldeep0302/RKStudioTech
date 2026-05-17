"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Rating,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useProducts } from "@/hooks/useProducts";
import { ProductCategory } from "@/services/productService";
import { formatINR } from "@/utils/currency";
import { addFabricItemToCart } from "@/utils/fabricCart";

const isCategory = (value: string | null): value is ProductCategory => value === "fabric" || value === "dupatta";

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const categoryParam = searchParams.get("category");
  const category = isCategory(categoryParam) ? categoryParam : undefined;

  const { products, loading } = useProducts(category ? { category } : {});

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [pricePulse, setPricePulse] = useState(false);

  const product = useMemo(
    () => products.find((item) => item.id === params.id),
    [params.id, products],
  );

  const discountPercent = product?.discountPercent || 0;
  const discountedPrice = product
    ? discountPercent > 0
      ? Math.max(0, Math.round(product.price * (1 - discountPercent / 100)))
      : product.price
    : 0;

  const isMeterBased = product?.productType === "fabric";
  const unitLabel = isMeterBased ? "meter" : "piece";
  const helperText = isMeterBased
    ? "Kurti ke liye approx 2.5 meter chahiye"
    : "Ready to wear";

  const totalPrice = Math.round(discountedPrice * selectedQuantity);

  const updateQuantity = (next: number) => {
    const baseValue = Number.isFinite(next) ? Math.max(1, next) : 1;
    const sanitized = isMeterBased
      ? Math.round(baseValue * 100) / 100
      : Math.max(1, Math.round(baseValue));
    setSelectedQuantity(sanitized);
    setPricePulse(true);
  };

  const handleAddToCart = async () => {
    setError("");

    try {
      if (!product) {
        return;
      }

      addFabricItemToCart({
        productId: product.id,
        name: product.name,
        image: product.image,
        category: product.category,
        product_type: product.productType,
        price_per_unit: discountedPrice,
        selected_quantity: selectedQuantity,
        description: product.description,
        type: product.type,
      });

      setNotice("Product cart me add ho gaya.");
      router.push("/cart");
    } catch {
      setError("Cart me add nahi ho paya. Dobara koshish karein.");
    }
  };

  const handleQuantityInputChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setSelectedQuantity(1);
      setPricePulse(true);
      return;
    }

    updateQuantity(parsed);
  };

  return (
    <Layout>
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.back()}
            sx={{ alignSelf: "flex-start" }}
          >
            Back
          </Button>
          <Chip
            label={(category || product?.category || "product").toUpperCase()}
            color="secondary"
            size="small"
          />
        </Stack>

        {loading ? (
          <Stack alignItems="center" py={8} spacing={1.5}>
            <CircularProgress />
            <Typography color="text.secondary">Product details load ho rahi hain...</Typography>
          </Stack>
        ) : null}

        {!loading && !product ? (
          <Alert severity="warning">Product nahi mila. Please dobara list se select karein.</Alert>
        ) : null}

        {!loading && product ? (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ overflow: "hidden" }}>
                <Box sx={{ position: "relative", width: "100%", height: { xs: 300, md: 420 } }}>
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 900px) 100vw, 50vw"
                    style={{ objectFit: "cover" }}
                  />
                </Box>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={2}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {product.name}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={product.inStock === false ? "Nahi hai" : "Hai"} color={product.inStock === false ? "default" : "success"} />
                  {isMeterBased ? (
                    <Chip label="Sold per meter / Meter ke hisaab se bikta hai" color="warning" />
                  ) : (
                    <Chip label="Per piece / Fixed price" color="info" />
                  )}
                  {discountPercent > 0 ? <Chip label={`${discountPercent}% OFF`} color="error" /> : null}
                </Stack>

                <Stack direction="row" alignItems="center" spacing={0.7}>
                  <Rating
                    value={product.rating || 0}
                    precision={0.1}
                    readOnly
                    icon={<StarRoundedIcon fontSize="inherit" />}
                    emptyIcon={<StarRoundedIcon fontSize="inherit" />}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {(product.rating || 0).toFixed(1)} / 5
                  </Typography>
                </Stack>

                <Stack direction="row" alignItems="baseline" spacing={1}>
                  <Typography variant="h4" color="primary.main" sx={{ fontWeight: 800 }}>
                    {isMeterBased
                      ? `${formatINR(discountedPrice)} / meter`
                      : `${formatINR(discountedPrice)} per piece`}
                  </Typography>
                  {discountPercent > 0 ? (
                    <Typography variant="body1" sx={{ color: "text.disabled", textDecoration: "line-through" }}>
                      {formatINR(product.price)}
                    </Typography>
                  ) : null}
                </Stack>

                <Divider />

                <Stack spacing={1}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {product.description || `${product.tag || "daily wear"} ${product.type}.`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Type: {product.type}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tag: {product.tag}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Available stock: {product.inStock === false ? "Out of stock" : "In stock"}
                  </Typography>
                  {product.suggestion ? (
                    <Typography variant="body2" color="text.secondary">
                      Suggestion: {product.suggestion}
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="text.secondary">
                    {helperText}
                  </Typography>
                </Stack>

                <Card
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <Stack spacing={1.4}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {isMeterBased
                        ? "Select Meter (Kitna meter chahiye?)"
                        : "Select Quantity (Kitne piece chahiye?)"}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center">
                      <Button
                        variant="outlined"
                        onClick={() => updateQuantity(selectedQuantity - (isMeterBased ? 0.5 : 1))}
                        disabled={selectedQuantity <= 1}
                        sx={{ minWidth: 44, px: 0 }}
                        aria-label={`Decrease ${unitLabel}`}
                      >
                        <RemoveIcon fontSize="small" />
                      </Button>
                      <TextField
                        size="small"
                        type="number"
                        value={selectedQuantity}
                        onChange={(event) => handleQuantityInputChange(event.target.value)}
                        inputProps={{ min: 1, step: isMeterBased ? 0.5 : 1 }}
                        sx={{ width: 140 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {unitLabel}
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => updateQuantity(selectedQuantity + (isMeterBased ? 0.5 : 1))}
                        sx={{ minWidth: 44, px: 0 }}
                        aria-label={`Increase ${unitLabel}`}
                      >
                        <AddIcon fontSize="small" />
                      </Button>
                    </Stack>

                    <Box
                      onAnimationEnd={() => setPricePulse(false)}
                      sx={{
                        p: 1.4,
                        borderRadius: 1.5,
                        bgcolor: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        animation: pricePulse ? "pricePulse 260ms ease" : "none",
                        "@keyframes pricePulse": {
                          from: { transform: "scale(1)", backgroundColor: "#DBEAFE" },
                          to: { transform: "scale(1.02)", backgroundColor: "#EFF6FF" },
                        },
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {formatINR(discountedPrice)} x {selectedQuantity} {unitLabel} =
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
                        {formatINR(totalPrice)}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>

                <Button
                  variant="contained"
                  startIcon={<ShoppingCartIcon />}
                  disabled={product.inStock === false}
                  onClick={handleAddToCart}
                  sx={{ mt: 1, width: { xs: "100%", sm: "auto" } }}
                >
                  Add to Cart / Cart me add karein
                </Button>
              </Stack>
            </Grid>
          </Grid>
        ) : null}

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Snackbar
          open={Boolean(notice)}
          autoHideDuration={2200}
          onClose={() => setNotice("")}
          message={notice}
        />
      </Stack>
    </Layout>
  );
}
