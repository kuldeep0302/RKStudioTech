"use client";

import dynamic from "next/dynamic";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import Layout from "@/components/layout/Layout";

const TailoringForm = dynamic(
  () => import("@/features/tailoring/components/TailoringForm"),
  {
    ssr: false,
    loading: () => (
      <Stack alignItems="center" py={10}>
        <CircularProgress />
      </Stack>
    ),
  },
);

export default function TailoringPage() {
  return (
    <Layout>
      <Stack spacing={3}>
        <Typography variant="h3">Stitch Clothes</Typography>
        <Typography color="text.secondary">
          Share your measurements and design preferences.
        </Typography>

        <Box sx={{ p: { xs: 2.5, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Available Services</Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>We stitch:</Typography>
              <Stack spacing={0.8} sx={{ pl: 2 }}>
                <Typography variant="body2">• Ladies Suits (all types)</Typography>
                <Typography variant="body2">• Blouse (all types)</Typography>
                <Typography variant="body2">• Kurti (all types)</Typography>
                <Typography variant="body2">• Kids clothes</Typography>
              </Stack>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "grey.50", borderLeft: "3px solid", borderColor: "primary.main" }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Currently serving women’s tailoring only.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 2.5, md: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
          <Typography variant="h5" sx={{ mb: 2 }}>Pricing</Typography>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              • Final price will be shared after you provide details
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • We offer competitive rates in the market
            </Typography>
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "grey.50", borderLeft: "3px solid", borderColor: "primary.main" }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                All charges are transparent. No hidden fees.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <TailoringForm />
      </Stack>
    </Layout>
  );
}
