"use client";

import dynamic from "next/dynamic";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import StraightenIcon from "@mui/icons-material/Straighten";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import { Alert, Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useProducts } from "@/hooks/useProducts";
import { RK_STUDIO } from "@/utils/constants";

const DupattaGrid = dynamic(
  () => import("@/features/dupatta/components/DupattaGrid"),
);

export default function DupattaPage() {
  const {
    products,
    loading,
    error,
    loadMore,
    hasMore,
    loadingMore,
  } = useProducts({ category: "dupatta", paginated: true, pageSize: 24 });
  const [unitFilter, setUnitFilter] = useState<"all" | "meter" | "piece">("all");
  const infiniteScrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const whatsappSupportUrl = useMemo(() => {
    const phone = RK_STUDIO.whatsappNumber || "918901501572";
    const message = encodeURIComponent("Hi, I need help with product availability.");
    return `https://wa.me/${phone}?text=${message}`;
  }, []);

  const filteredProducts = useMemo(() => {
    if (unitFilter === "all") {
      return products;
    }

    return products.filter((product) =>
      unitFilter === "meter" ? product.productType === "fabric" : product.productType === "piece",
    );
  }, [products, unitFilter]);

  useEffect(() => {
    if (loading || loadingMore || !hasMore) {
      return;
    }

    const anchor = infiniteScrollAnchorRef.current;

    if (!anchor) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting || loadingMore || !hasMore) {
          return;
        }

        void loadMore();
      },
      {
        root: null,
        rootMargin: "220px 0px",
        threshold: 0,
      },
    );

    observer.observe(anchor);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore, loading, loadingMore]);

  return (
    <Layout>
      <Stack spacing={3}>
        <Typography variant="h3">Dupatta</Typography>
        <Typography color="text.secondary">
          Ready designs for all occasions.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Need help? Contact us on WhatsApp.
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
          <Stack spacing={1.25}>
            <Alert severity="info">
              Currently no products available. Please check back later or contact us on WhatsApp.
            </Alert>
            <Button
              component="a"
              href={whatsappSupportUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              color="success"
              sx={{ alignSelf: "flex-start" }}
            >
              Contact on WhatsApp
            </Button>
          </Stack>
        ) : null}

        {!loading && hasMore ? (
          <>
            <Box ref={infiniteScrollAnchorRef} sx={{ width: "100%", height: 1 }} />
            {loadingMore ? (
              <Stack spacing={1} sx={{ px: { xs: 0, md: 2 } }}>
                <Skeleton variant="rounded" height={16} />
                <Skeleton variant="rounded" height={16} width="70%" />
              </Stack>
            ) : null}
            <Stack direction="row" justifyContent="center">
              <Button
                variant="outlined"
                onClick={loadMore}
                disabled={loadingMore}
                sx={{
                  "&.Mui-disabled": {
                    opacity: 0.55,
                    cursor: "not-allowed",
                    pointerEvents: "auto",
                  },
                }}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </Button>
            </Stack>
          </>
        ) : null}
      </Stack>
    </Layout>
  );
}
