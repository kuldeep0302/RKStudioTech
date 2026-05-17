import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { alpha, Box, Button, Container, Divider, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import RKStudioLogo from "@/components/common/RKStudioLogo";
import { RK_STUDIO } from "@/utils/constants";

export default function Footer() {
  const whatsappLink = RK_STUDIO.whatsappChatUrl;

  return (
    <Box
      component="footer"
      sx={{
        borderTop: `1px solid ${alpha("#CBD5E1", 0.55)}`,
        py: 4,
        mt: 6,
        background: "#FFFFFF",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={3} alignItems="flex-start" sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={0.6} alignItems="flex-start">
              <RKStudioLogo size={52} variant="full" />
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>Contact Us</Typography>
              <Button
                component="a"
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<WhatsAppIcon />}
                sx={{
                  borderRadius: 999,
                  px: 2.2,
                  py: 0.9,
                  color: "#FFFFFF",
                  bgcolor: "#25D366",
                  boxShadow: "none",
                  justifyContent: "flex-start",
                  "&:hover": {
                    bgcolor: "#1FB85A",
                  },
                }}
              >
                Chat on WhatsApp
              </Button>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.7, fontSize: "0.95rem" }}>
                <LocationOnIcon sx={{ fontSize: 18 }} />
                Address
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                Radha Krishan Studio<br />
                Subhash Nagar, Narnaul<br />
                (123001)
              </Typography>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 3 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>Service Area</Typography>
              <Typography variant="body2" color="text.secondary">
                Serving Narnaul area
              </Typography>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2.5 }} />

        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            © 2026 RK Studio. All rights reserved.
          </Typography>
          <Typography variant="caption" color="text.secondary">Need help? Chat with RK Studio on WhatsApp.</Typography>
        </Stack>
      </Container>
    </Box>
  );
}
