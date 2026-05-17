"use client";

import StarRoundedIcon from "@mui/icons-material/StarRounded";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { Box, Button, Card, CardActions, CardContent, Chip, Rating, Stack, Typography } from "@mui/material";
import Image from "next/image";
import { memo } from "react";
import { CatalogProduct } from "@/services/productService";
import { formatINR } from "@/utils/currency";

type ProductCardProps = {
  product: CatalogProduct;
  onAddToCart?: (product: CatalogProduct) => void;
  onOpenDetails?: (product: CatalogProduct) => void;
  showSuggestion?: boolean;
  actionLabel?: string;
};

function ProductCardComponent({
  product,
  onAddToCart,
  onOpenDetails,
  showSuggestion = false,
  actionLabel = "Order",
}: ProductCardProps) {
  const isFabric = product.productType === "fabric";
  const discountPercent = product.discountPercent || 0;
  const discountedPrice = discountPercent > 0
    ? Math.max(0, Math.round(product.price * (1 - discountPercent / 100)))
    : product.price;
  const savingsAmount = Math.max(0, product.price - discountedPrice);

  return (
    <Card
      onClick={onOpenDetails ? () => onOpenDetails(product) : undefined}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: onOpenDetails ? "pointer" : "default",
        "&:hover img": {
          transform: "scale(1.04)",
        },
      }}
    >
      <Box sx={{ position: "relative", width: "100%", height: 220 }}>
        {discountPercent > 0 ? (
          <Chip
            label={`${discountPercent}% OFF`}
            color="secondary"
            size="small"
            sx={{ position: "absolute", top: 12, left: 12, zIndex: 1, fontWeight: 700 }}
          />
        ) : null}
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 900px) 100vw, 33vw"
          style={{ objectFit: "cover", transition: "transform 0.35s ease" }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="start" gap={1}>
          <Typography variant="h6">{product.name}</Typography>
          <Chip label={product.inStock === false ? "Nahi hai" : "Hai"} color={product.inStock === false ? "default" : "success"} size="small" />
        </Stack>
        {isFabric ? (
          <Chip
            label="Sold per meter / Meter ke hisaab se bikta hai"
            size="small"
            color="warning"
            sx={{ mt: 1 }}
          />
        ) : (
          <Chip
            label="Per piece / Fixed price"
            size="small"
            color="info"
            sx={{ mt: 1 }}
          />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {product.description || `${product.tag || "Roz ke liye"} ${product.type}.`}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.7} sx={{ mt: 1.6 }}>
          <Rating
            value={product.rating || 0}
            precision={0.1}
            readOnly
            size="small"
            icon={<StarRoundedIcon fontSize="inherit" />}
            emptyIcon={<StarRoundedIcon fontSize="inherit" />}
          />
          <Typography variant="caption" color="text.secondary">
            {(product.rating || 0).toFixed(1)}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 1.3 }}>
          <Typography variant="h6" sx={{ color: "primary.main" }}>
            {isFabric ? `${formatINR(discountedPrice)} / meter` : `${formatINR(discountedPrice)} per piece`}
          </Typography>
          {discountPercent > 0 ? (
            <Typography variant="body2" sx={{ color: "text.disabled", textDecoration: "line-through" }}>
              {formatINR(product.price)}
            </Typography>
          ) : null}
        </Stack>
        {discountPercent > 0 ? (
          <Typography variant="caption" sx={{ display: "block", mt: 0.6, color: "secondary.main", fontWeight: 700 }}>
            Bachche: {formatINR(savingsAmount)}
          </Typography>
        ) : null}

        {showSuggestion && product.suggestion ? (
          <Box sx={{ mt: 2, p: 1.2, borderRadius: 1.5, backgroundColor: "#FFF7ED" }}>
            <Typography variant="caption" sx={{ color: "secondary.main", fontWeight: 600 }}>
              Sari ke saath mil jayegi: {product.suggestion}
            </Typography>
          </Box>
        ) : null}
      </CardContent>

      {onAddToCart ? (
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<ShoppingCartIcon />}
            disabled={product.inStock === false}
            onClick={(event) => {
              event.stopPropagation();
              onAddToCart(product);
            }}
          >
            {actionLabel}
          </Button>
        </CardActions>
      ) : null}
    </Card>
  );
}

const ProductCard = memo(ProductCardComponent);

export default ProductCard;
