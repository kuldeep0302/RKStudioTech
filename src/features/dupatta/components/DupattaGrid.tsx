"use client";

import Grid from "@mui/material/Grid2";
import { useRouter } from "next/navigation";
import ProductCard from "@/components/common/ProductCard";
import { CatalogProduct } from "@/services/productService";

type DupattaGridProps = {
  products: CatalogProduct[];
};

export default function DupattaGrid({ products }: DupattaGridProps) {
  const router = useRouter();

  const handleOpenProductDetails = (product: CatalogProduct) => {
    router.push(`/product/${encodeURIComponent(product.id)}?category=${encodeURIComponent(product.category)}`);
  };

  return (
    <Grid container spacing={2.5}>
      {products.map((product) => (
        <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4 }}>
          <ProductCard
            product={product}
            showSuggestion
            onAddToCart={handleOpenProductDetails}
            onOpenDetails={handleOpenProductDetails}
            actionLabel="View Details"
          />
        </Grid>
      ))}
    </Grid>
  );
}
