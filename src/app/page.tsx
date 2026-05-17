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
    titleHi: "Silai",
    description: "Custom tailoring for perfect fit.",
    href: "/tailoring",
    icon: ContentCutIcon,
  },
  {
    titleEn: "Buy Febric",
    titleHi: "Kapda",
    description: "Quality cloth at fair prices.",
    href: "/fabric",
    icon: CheckroomIcon,
  },
  {
    titleEn: "Dupatta",
    titleHi: "डुपट्टा",
    description: "Ready designs for all occasions.",
    href: "/dupatta",
    icon: StyleIcon,
  },
  {
    titleEn: "Alterations",
    titleHi: "Kapde Theek Karna",
    description: "Repairs and modifications.",
    href: "/tailoring",
    icon: PrecisionManufacturingIcon,
  },
];

const benefits = [
  {
    icon: CheckroomIcon,
    titleEn: "Perfect Fitting",
    titleHi: "Perfect Fit",
    desc: "Guaranteed perfect fit every time",
  },
  {
    icon: LocalShippingIcon,
    titleEn: "Doorstep Service",
    titleHi: "Ghar Par Service",
    desc: "We come to you, no hassle",
  },
  {
    icon: ThumbUpAltIcon,
    titleEn: "Affordable Price",
    titleHi: "Sasti Silai",
    desc: "Best rates in town, no hidden charges",
  },
  {
    icon: SecurityIcon,
    titleEn: "Trusted Quality",
    titleHi: "Bharosemand",
    desc: "Expert tailors with 10+ years experience",
  },
];

const problems = [
  {
    problem: "Finding good tailors is difficult",
    problemHi: "Acha darzi dhundna mushkil hai",
    solution: "Book from our trusted network instantly",
    solutionHi: "Hamari trusted team se book karein",
  },
  {
    problem: "No proper fitting or delivery tracking",
    problemHi: "Fitting theek nahi, delivery pata nahi chalta",
    solution: "Perfect fit guarantee + order tracking",
    solutionHi: "Perfect fit + apka order track karein",
  },
  {
    problem: "Expensive and time-consuming",
    problemHi: "Mehnga aur time lagne wala kaam",
    solution: "Affordable prices, doorstep delivery",
    solutionHi: "Sasta aur ghar baithe deliver karenge",
  },
];

export default function Home() {
  return (
    <Layout>
      <Stack spacing={{ xs: 6, md: 8 }}>
        {/* Hero Section */}
        <Box
          sx={{
            background: "linear-gradient(135deg, #f5e6d3 0%, #e8d4c4 50%, #f0e6d8 100%)",
            borderRadius: 3,
            p: { xs: 3, md: 6 },
            textAlign: "center",
            animation: "fadeIn 0.8s ease-in",
            "@keyframes fadeIn": {
              from: { opacity: 0, transform: "translateY(20px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <Stack spacing={3} alignItems="center">
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "2rem", md: "3.5rem" },
                fontWeight: 800,
                lineHeight: 1.2,
                color: "#111827",
              }}
            >
              Custom Tailoring Made Easy 👗
            </Typography>
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: "1.2rem", md: "1.8rem" },
                color: "#6b4423",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              Ab Silai ka Kaam Hua Aur Bhi Aasaan
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
            <Typography
              variant="body2"
              sx={{
                fontSize: { xs: "0.85rem", md: "1rem" },
                color: "#666",
                maxWidth: 700,
                fontStyle: "italic",
              }}
            >
              Ab ghar baithe silai, design aur delivery – sab kuch ek hi app mein
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
              Get Started / Shuru Karein
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
                      <Typography variant="caption" sx={{ color: "#888" }}>
                        {item.problemHi}
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
                      <Typography variant="caption" sx={{ color: "#666" }}>
                        {item.solutionHi}
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
                        variant="caption"
                        sx={{
                          color: "#888",
                          fontSize: { xs: "0.75rem", md: "0.85rem" },
                        }}
                      >
                        {service.titleHi}
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
                      <Typography variant="caption" sx={{ color: "#666", fontWeight: 600 }}>
                        {benefit.titleHi}
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
              1000+ logon ka bharosa aur vishwas
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
            Aaj hi apni silai journey shuru karein
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
            Book Now / Abhi Book Karein
          </Button>
        </Box>
      </Stack>
    </Layout>
  );
}
