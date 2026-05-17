"use client";

import dynamic from "next/dynamic";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import StraightenIcon from "@mui/icons-material/Straighten";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import { Alert, Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import Layout from "@/components/layout/Layout";
import { CatalogProduct } from "@/services/productService";
import { defaultFilters, ProductFilters } from "@/utils/filters";
import { applyProductFilters } from "@/utils/filters";

const FabricFilters = dynamic(
  () => import("@/features/fabric/components/FabricFilters"),
);

const FabricGrid = dynamic(
  () => import("@/features/fabric/components/FabricGrid"),
);

export default function FabricPage() {
  const router = useRouter();
  const { products, loading, error: productsError } = useProducts({ category: "fabric" });
  const [filters, setFilters] = useState<ProductFilters>(defaultFilters);
  const [unitFilter, setUnitFilter] = useState<"all" | "meter" | "piece">("all");

  const filteredProducts = useMemo(() => {
    const nextProducts = applyProductFilters(products, filters);

    if (unitFilter === "all") {
      return nextProducts;
    }

    return nextProducts.filter((product) =>
      unitFilter === "meter" ? product.productType === "fabric" : product.productType === "piece",
    );
  }, [filters, products, unitFilter]);

  const handleOpenProductDetails = (product: CatalogProduct) => {
    router.push(`/product/${encodeURIComponent(product.id)}?category=${encodeURIComponent(product.category)}`);
  };

  return (
    <Layout>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
          <Typography variant="h3">Buy Febric</Typography>
          <Button variant="outlined" onClick={() => router.push("/cart")}>Open Cart</Button>
        </Stack>
        <Typography color="text.secondary">
          Find quality cloth at fair prices.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Koi dikkat ho to WhatsApp karein. Hum madad ke liye yahan hain.
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Unit Filter:
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              icon={<ViewModuleIcon />}
              label="All"
              clickable
              color={unitFilter === "all" ? "primary" : "default"}
              variant={unitFilter === "all" ? "filled" : "outlined"}
              onClick={() => setUnitFilter("all")}
              sx={{ borderRadius: 999, fontWeight: 600 }}
            />
            <Chip
              icon={<StraightenIcon />}
              label="Meter"
              clickable
              color={unitFilter === "meter" ? "primary" : "default"}
              variant={unitFilter === "meter" ? "filled" : "outlined"}
              onClick={() => setUnitFilter("meter")}
              sx={{ borderRadius: 999, fontWeight: 600 }}
            />
            <Chip
              icon={<CheckroomIcon />}
              label="Piece"
              clickable
              color={unitFilter === "piece" ? "primary" : "default"}
              variant={unitFilter === "piece" ? "filled" : "outlined"}
              onClick={() => setUnitFilter("piece")}
              sx={{ borderRadius: 999, fontWeight: 600 }}
            />
          </Stack>
        </Stack>

        <Box sx={{ p: { xs: 2.5, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Delivery Charges:</Typography>
          <Stack spacing={1} sx={{ pl: 2 }}>
            <Typography variant="body2">• Home delivery: ₹99</Typography>
            <Typography variant="body2">• Pickup and delivery: ₹99</Typography>
            <Typography variant="body2">• Self pickup: Free</Typography>
          </Stack>
        </Box>

        {productsError ? <Alert severity="warning">{productsError}</Alert> : null}

        {loading ? (
          <Stack spacing={1.2} py={2}>
            <Skeleton variant="rounded" height={74} />
            <Skeleton variant="rounded" height={220} />
            <Skeleton variant="rounded" height={220} />
          </Stack>
        ) : null}

        {!loading ? (
          <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <FabricFilters filters={filters} onChange={setFilters} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <FabricGrid
              products={filteredProducts}
              onSelect={handleOpenProductDetails}
              onOpenDetails={handleOpenProductDetails}
            />
          </Grid>
          </Grid>
        ) : null}

        {!loading && filteredProducts.length === 0 ? (
          <Alert severity="info">Abhi filter ke hisab se kapda nahi mila.</Alert>
        ) : null}

      </Stack>
    </Layout>
  );
}
