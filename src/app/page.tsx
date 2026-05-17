"use client";

import { alpha, Box, Button, Card, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import CheckroomIcon from "@mui/icons-material/Checkroom";
import StyleIcon from "@mui/icons-material/Style";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import SecurityIcon from "@mui/icons-material/Security";
import Link from "next/link";
import Layout from "@/components/layout/Layout";

const services = [
  {
    titleEn: "Stitch Clothes",
    descriptionEn: "Custom tailoring for perfect fit.",
    descriptionHi: "Perfect fitting ke liye custom silai.",
    href: "/tailoring",
    icon: ContentCutIcon,
  },
  {
    titleEn: "Buy Fabric",
    descriptionEn: "Quality cloth at fair prices.",
    descriptionHi: "Achhi quality ka fabric sahi daam par.",
    href: "/fabric",
    icon: CheckroomIcon,
  },
  {
    titleEn: "Dupatta",
    descriptionEn: "Ready designs for all occasions.",
    descriptionHi: "Har occasion ke liye ready designs.",
    href: "/dupatta",
    icon: StyleIcon,
  },
  {
    titleEn: "Alterations",
    descriptionEn: "Repairs and modifications.",
    descriptionHi: "Kapdo ki fitting aur changes.",
    href: "/tailoring",
    icon: PrecisionManufacturingIcon,
  },
];

const benefits = [
  {
    icon: CheckroomIcon,
    titleEn: "Perfect Fitting",
    desc: "Guaranteed perfect fit every time",
  },
  {
    icon: LocalShippingIcon,
    titleEn: "Doorstep Service",
    desc: "We come to you, no hassle",
  },
  {
    icon: ThumbUpAltIcon,
    titleEn: "Affordable Price",
    desc: "Best rates in town, no hidden charges",
  },
  {
    icon: SecurityIcon,
    titleEn: "Trusted Quality",
    desc: "Expert tailors with 10+ years experience",
  },
];

const problems = [
  {
    problem: "Finding good tailors is difficult",
    solution: "Book from our trusted network instantly",
  },
  {
    problem: "No proper fitting or delivery tracking",
    solution: "Perfect fit guarantee + order tracking",
  },
  {
    problem: "Expensive and time-consuming",
    solution: "Affordable prices, doorstep delivery",
  },
];

const heroBackgroundVariants = {
  warmPremium:
    "radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0) 35%), radial-gradient(circle at 84% 18%, rgba(255, 244, 214, 0.55) 0%, rgba(255, 244, 214, 0) 34%), linear-gradient(135deg, rgb(244, 232, 214) 0%, rgb(236, 217, 191) 52%, rgb(228, 205, 177) 100%)",
  roseIvory:
    "radial-gradient(circle at 12% 14%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0) 36%), radial-gradient(circle at 86% 20%, rgba(255, 232, 217, 0.6) 0%, rgba(255, 232, 217, 0) 34%), linear-gradient(135deg, rgb(249, 238, 226) 0%, rgb(241, 223, 207) 48%, rgb(233, 210, 192) 100%)",
} as const;

const activeHeroBackground = heroBackgroundVariants.roseIvory;

export default function Home() {
  return (
    <Layout>
      <Stack spacing={{ xs: 6, md: 8 }}>
        {/* Hero Section */}
        <Box
          sx={{
            background: activeHeroBackground,
            borderRadius: 3,
            p: { xs: 3, md: 6 },
            textAlign: "center",
            border: "1px solid rgba(176, 138, 95, 0.22)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 20px 44px rgba(115, 77, 35, 0.12)",
            animation: "fadeIn 0.8s ease-in",
            "@keyframes fadeIn": {
              from: { opacity: 0, transform: "translateY(20px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Box
              sx={{
                position: "relative",
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: { xs: 0.4, md: 0.7 },
                textShadow: "0 8px 20px rgba(35, 88, 255, 0.22)",
                animation: "titleFloat 3.8s ease-in-out infinite",
                "@keyframes titleFloat": {
                  "0%": { transform: "translateY(0px)" },
                  "50%": { transform: "translateY(-4px)" },
                  "100%": { transform: "translateY(0px)" },
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: "-35%",
                  width: "28%",
                  height: "100%",
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
                  transform: "skewX(-18deg)",
                  animation: "titleShine 3.2s ease-in-out infinite",
                  pointerEvents: "none",
                },
                "@keyframes titleShine": {
                  "0%": { left: "-35%" },
                  "100%": { left: "110%" },
                },
              }}
            >
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: "2rem", md: "3.5rem" },
                  fontWeight: 800,
                  lineHeight: 1.2,
                  color: "rgb(15, 38, 89)",
                }}
              >
                Custom Tailoring Made Easy 👗
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  fontSize: { xs: "1.25rem", md: "2.15rem" },
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: "rgb(5, 126, 98)",
                }}
              >
                Custom Tailoring Ab Bilkul Easy Hai
              </Typography>
            </Box>
            <Box
              sx={{
                width: { xs: 240, md: 520 },
                height: 7,
                borderRadius: 999,
                background: "rgba(15, 38, 89, 0.14)",
                overflow: "hidden",
                mt: -1,
                mb: 0.5,
              }}
            >
              <Box
                sx={{
                  width: "38%",
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, rgb(15, 38, 89), rgb(243, 120, 38), rgb(5, 126, 98))",
                  boxShadow: "0 0 14px rgba(35, 88, 255, 0.45)",
                  animation: "sliderMove 2.6s ease-in-out infinite",
                  "@keyframes sliderMove": {
                    "0%": { transform: "translateX(-120%)" },
                    "50%": { transform: "translateX(120%)" },
                    "100%": { transform: "translateX(280%)" },
                  },
                }}
              />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: "1.2rem", md: "1.8rem" },
                color: "#6b4423",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              Tailoring is now faster and easier
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: "0.95rem", md: "1.1rem" },
                color: "#555",
                maxWidth: 700,
                lineHeight: 1.8,
                mt: 2,
              }}
            >
              Book tailoring services, order custom clothes, and get doorstep delivery. All in one place.
            </Typography>
            <Button
              component={Link}
              href="/tailoring"
              variant="contained"
              size="large"
              sx={{
                mt: 3,
                px: 4,
                py: 1.5,
                fontSize: "1.1rem",
                fontWeight: 700,
                textTransform: "none",
                borderRadius: 2,
                color: "#166534",
                bgcolor: alpha("#DCFCE7", 0.92),
                border: `1px solid ${alpha("#86EFAC", 0.86)}`,
                "&:hover": {
                  transform: "translateY(-3px)",
                  bgcolor: alpha("#DCFCE7", 1),
                  boxShadow: "0 12px 24px rgba(22, 101, 52, 0.18)",
                },
                transition: "all 0.3s ease",
              }}
            >
              Get Started
            </Button>
          </Stack>
        </Box>

        {/* Problem + Solution Section */}
        <Box>
          <Typography
            variant="h3"
            sx={{
              textAlign: "center",
              mb: 4,
              fontSize: { xs: "1.8rem", md: "2.5rem" },
              fontWeight: 800,
            }}
          >
            Why Choose Us?
          </Typography>
          <Grid container spacing={3}>
            {problems.map((item, idx) => (
              <Grid key={idx} size={{ xs: 12, md: 4 }}>
                <Card
                  sx={{
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    borderRadius: 2.5,
                    p: 2.5,
                    textAlign: "center",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    },
                  }}
                >
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="body2" sx={{ color: "#d32f2f", fontWeight: 700, mb: 0.5 }}>
                        ❌ Problem
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: "#333" }}>
                        {item.problem}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        height: 2,
                        background: "linear-gradient(90deg, #d32f2f 0%, transparent 100%)",
                        borderRadius: 1,
                      }}
                    />
                    <Box>
                      <Typography variant="body2" sx={{ color: "#388e3c", fontWeight: 700, mb: 0.5 }}>
                        ✅ Solution
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: "#2e7d32" }}>
                        {item.solution}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Services Section with Circular Cards */}
        <Box
          sx={{
            backgroundColor: "#d9d9e8",
            borderRadius: 3,
            p: { xs: 2.5, md: 4 },
          }}
        >
          <Typography
            variant="h3"
            sx={{
              textAlign: "center",
              mb: 5,
              fontSize: { xs: "1.8rem", md: "2.5rem" },
              fontWeight: 800,
            }}
          >
            Our Services
          </Typography>
          <Grid container spacing={4} justifyContent="center">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <Grid key={service.titleEn} size={{ xs: 6, sm: 4, md: 3 }}>
                  <Box
                    component={Link}
                    href={service.href}
                    sx={{
                      textDecoration: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                      cursor: "pointer",
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: 120, md: 140 },
                        height: { xs: 120, md: 140 },
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.3s ease",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        border: "2px solid #ffb74d",
                        "&:hover": {
                          transform: "scale(1.1)",
                          boxShadow: "0 12px 32px rgba(255, 152, 0, 0.3)",
                          background: "linear-gradient(135deg, #ffe0b2 0%, #ffd54f 100%)",
                        },
                      }}
                    >
                      <Icon
                        sx={{
                          fontSize: { xs: 50, md: 60 },
                          color: "#111827",
                        }}
                      />
                    </Box>
                    <Stack spacing={0.5} alignItems="center">
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 700,
                          color: "#333",
                          fontSize: { xs: "0.95rem", md: "1.1rem" },
                        }}
                      >
                        {service.titleEn}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#4b5563",
                          textAlign: "center",
                          fontSize: { xs: "0.78rem", md: "0.85rem" },
                          lineHeight: 1.35,
                          maxWidth: 180,
                        }}
                      >
                        {service.descriptionEn}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#6b7280",
                          textAlign: "center",
                          fontSize: { xs: "0.74rem", md: "0.82rem" },
                          lineHeight: 1.35,
                          maxWidth: 180,
                        }}
                      >
                        {service.descriptionHi}
                      </Typography>
                    </Stack>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {/* Benefits Section */}
        <Box sx={{ mt: 3 }}>
          <Typography
            variant="h3"
            sx={{
              textAlign: "center",
              mb: 4,
              fontSize: { xs: "1.8rem", md: "2.5rem" },
              fontWeight: 800,
            }}
          >
            Why Customers Love Us
          </Typography>
          <Grid container spacing={3}>
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Grid key={benefit.titleEn} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    sx={{
                      textAlign: "center",
                      p: 3,
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      borderRadius: 2.5,
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-6px)",
                        boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                      },
                    }}
                  >
                    <Stack spacing={2} alignItems="center">
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon sx={{ fontSize: 40, color: "#111827" }} />
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#333" }}>
                        {benefit.titleEn}
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#888" }}>
                        {benefit.desc}
                      </Typography>
                    </Stack>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>

        {/* Trust Section */}
        <Box
          sx={{
            background: "linear-gradient(135deg, #f3e5f5 0%, #ede7f6 100%)",
            borderRadius: 3,
            p: { xs: 3, md: 5 },
            textAlign: "center",
            mt: 4,
          }}
        >
          <Stack spacing={2} alignItems="center">
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: "1.5rem", md: "2rem" },
                fontWeight: 800,
                color: "#5e35b1",
              }}
            >
              ⭐ Trusted by 1000+ Happy Customers
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#666",
                fontSize: { xs: "0.95rem", md: "1.1rem" },
              }}
            >
              Trusted by more than 1000 customers
            </Typography>
          </Stack>
        </Box>

        {/* Final CTA */}
        <Box sx={{ textAlign: "center", mt: 4 }}>
          <Typography
            variant="h4"
            sx={{
              mb: 3,
              fontSize: { xs: "1.5rem", md: "2rem" },
              fontWeight: 700,
              color: "#333",
            }}
          >
            Start Your Tailoring Journey Today
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mb: 3,
              color: "#666",
              fontSize: { xs: "0.95rem", md: "1.1rem" },
            }}
          >
            Start your order in a few clicks
          </Typography>
          <Button
            component={Link}
            href="/tailoring"
            variant="contained"
            size="large"
            sx={{
              px: 5,
              py: 2,
              fontSize: "1.1rem",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
              color: "#166534",
              bgcolor: alpha("#DCFCE7", 0.92),
              border: `1px solid ${alpha("#86EFAC", 0.86)}`,
              "&:hover": {
                transform: "translateY(-4px)",
                bgcolor: alpha("#DCFCE7", 1),
                boxShadow: "0 16px 32px rgba(22, 101, 52, 0.2)",
              },
              transition: "all 0.3s ease",
            }}
          >
            Book Now
          </Button>
        </Box>
      </Stack>
    </Layout>
  );
}
