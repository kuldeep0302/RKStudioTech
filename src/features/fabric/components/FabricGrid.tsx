import Grid from "@mui/material/Grid2";
import ProductCard from "@/components/common/ProductCard";
import { CatalogProduct } from "@/services/productService";

type FabricGridProps = {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
  onOpenDetails?: (product: CatalogProduct) => void;
};

export default function FabricGrid({ products, onSelect, onOpenDetails }: FabricGridProps) {
  const handleOpen = (product: CatalogProduct) => {
    if (onOpenDetails) {
      onOpenDetails(product);
      return;
    }

    onSelect(product);
  };

  return (
    <Grid container spacing={2.5}>
      {products.map((product) => (
        <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4 }}>
          <ProductCard
            product={product}
            onAddToCart={handleOpen}
            onOpenDetails={handleOpen}
            actionLabel="View Details"
          />
        </Grid>
      ))}
    </Grid>
  );
}
