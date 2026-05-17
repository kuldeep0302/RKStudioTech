"use client";

import dynamic from "next/dynamic";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import StraightenIcon from "@mui/icons-material/Straighten";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import { Alert, Box, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useProducts } from "@/hooks/useProducts";

const DupattaGrid = dynamic(
  () => import("@/features/dupatta/components/DupattaGrid"),
);

export default function DupattaPage() {
  const { products, loading, error } = useProducts({ category: "dupatta" });
  const [unitFilter, setUnitFilter] = useState<"all" | "meter" | "piece">("all");

  const filteredProducts = useMemo(() => {
    if (unitFilter === "all") {
      return products;
    }

    return products.filter((product) =>
      unitFilter === "meter" ? product.productType === "fabric" : product.productType === "piece",
    );
  }, [products, unitFilter]);

  return (
    <Layout>
      <Stack spacing={3}>
        <Typography variant="h3">Dupatta</Typography>
        <Typography color="text.secondary">
          Ready designs for all occasions.
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

        {error ? <Alert severity="warning">{error}</Alert> : null}
        {loading ? (
          <Stack spacing={1.2} py={2}>
            <Skeleton variant="rounded" height={220} />
            <Skeleton variant="rounded" height={220} />
          </Stack>
        ) : (
          <DupattaGrid products={filteredProducts} />
        )}
        {!loading && filteredProducts.length === 0 ? (
          <Alert severity="info">Abhi dupatta available nahi hai. Thodi der baad check karein.</Alert>
        ) : null}
      </Stack>
    </Layout>
  );
}
