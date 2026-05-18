"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { FirebaseError } from "firebase/app";
import { ConfirmationResult } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/layout/Layout";
import RKStudioLogo from "@/components/common/RKStudioLogo";
import { useGlobalLoading } from "@/context/LoadingContext";
import { useAuth } from "@/hooks/useAuth";
import { isFirebaseConfigured } from "@/services/firebase";
import {
  MOCK_OTP,
  createMockUser,
  normalizeIndianPhone,
  saveMockUserToFirestore,
  sendOtpToPhone,
  shouldUseAdminMockOverride,
  useMockOtp,
  verifyMockOtp,
  verifyOtpAndSaveUser,
} from "@/services/authService";
import { UserRole } from "@/types/auth";
import { isAdminPhone } from "@/utils/admin";
import { RK_STUDIO } from "@/utils/constants";

const mapOtpErrorMessage = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return "OTP service temporarily unavailable. Please try again.";
  }

  switch (error.code) {
    case "auth/invalid-phone-number":
      return "Enter phone number in a valid format.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/captcha-check-failed":
      return "Verification failed. Refresh the page and try again.";
    case "auth/network-request-failed":
      return "Network issue. Check your connection and try again.";
    case "auth/unauthorized-domain":
    case "auth/configuration-not-found":
    case "auth/billing-not-enabled":
    case "auth/invalid-app-credential":
      return "OTP service temporarily unavailable. Please try again.";
    default:
      return "OTP service temporarily unavailable. Please try again.";
  }
};

const mapVerifyOtpErrorMessage = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return "OTP verification failed. Please try again.";
  }

  switch (error.code) {
    case "auth/invalid-verification-code":
      return "Invalid OTP. Enter the correct code and try again.";
    case "auth/code-expired":
      return "OTP has expired. Request a new OTP and try again.";
    case "auth/session-expired":
      return "Session expired. Request a new OTP and verify again.";
    case "auth/network-request-failed":
      return "Network issue. Check your connection and try again.";
    default:
      return "OTP verification failed. Please try again.";
  }
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, setMockSession } = useAuth();
  const { trackAsync } = useGlobalLoading();
  const [firebaseConfigured, setFirebaseConfigured] = useState<boolean | null>(null);
  const USE_MOCK_OTP = useMockOtp;
  const nextParam = searchParams.get("next");

  const getSafeNext = () => {
    if (!nextParam) {
      return null;
    }

    return nextParam.startsWith("/") ? nextParam : null;
  };

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [usingMockFlow, setUsingMockFlow] = useState(false);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const whatsappFallbackUrl = useMemo(() => {
    const message = "Service temporarily unavailable, continue via WhatsApp";
    const fallbackNumber = RK_STUDIO.whatsappNumber || "918901501572";
    return `https://wa.me/${fallbackNumber}?text=${encodeURIComponent(message)}`;
  }, []);

  useEffect(() => {
    if (!loading && user) {
      const safeNext = getSafeNext();
      router.replace(safeNext || "/dashboard");
    }
  }, [loading, router, user, nextParam]);

  useEffect(() => {
    setFirebaseConfigured(isFirebaseConfigured());
  }, []);

  useEffect(() => {
    console.log("ENV CHECK:", {
      USE_MOCK_OTP,
      RAW: process.env.NEXT_PUBLIC_USE_MOCK_OTP,
      PROJECT: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }, [USE_MOCK_OTP]);

  const handleSendOtp = async () => {
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    const formattedPhone = normalizeIndianPhone(phone);

    if (!formattedPhone.startsWith("+") || formattedPhone.length < 13) {
      setError("Please enter a valid Indian phone number.");
      return;
    }

    try {
      setBusy(true);
      const adminOverride = shouldUseAdminMockOverride(formattedPhone);
      const shouldUseMockFlow = USE_MOCK_OTP || adminOverride;

      setUsingMockFlow(shouldUseMockFlow);

      if (shouldUseMockFlow) {
        console.log("[auth] mock OTP flow active", {
          reason: USE_MOCK_OTP ? "env-toggle" : "admin-override",
        });
        setPhone(formattedPhone);
        setOtpSent(true);
        setSuccess(`Mock OTP sent: ${MOCK_OTP}`);
        setOtp(MOCK_OTP);
        return;
      }

      console.log("[auth] firebase phone OTP flow active");
      confirmationResultRef.current = await trackAsync(sendOtpToPhone(formattedPhone));
      setPhone(formattedPhone);
      setOtpSent(true);
    } catch (otpError) {
      console.error("OTP ERROR:", otpError);
      setError(mapOtpErrorMessage(otpError));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    if (!usingMockFlow && !confirmationResultRef.current) {
      setError("Send OTP first.");
      return;
    }

    if (!otp) {
      setError("Enter OTP.");
      return;
    }

    try {
      setBusy(true);

      if (usingMockFlow) {
        if (!verifyMockOtp(otp)) {
          setError("Invalid OTP. Please enter the correct code.");
          return;
        }

        if (role === "admin" && !isAdminPhone(phone)) {
          setError("Admin access is only allowed for approved admin numbers.");
          return;
        }

        const mockUser = createMockUser(name, phone, role);
        setMockSession(mockUser);
        await trackAsync(saveMockUserToFirestore(mockUser));
        setSuccess("Login successful with mock OTP.");
      } else {
        await trackAsync(verifyOtpAndSaveUser(confirmationResultRef.current as ConfirmationResult, otp, name, phone));
      }

      const safeNext = getSafeNext();
      router.replace(safeNext || (role === "admin" ? "/admin" : "/dashboard"));
    } catch (verifyError) {
      setError(mapVerifyOtpErrorMessage(verifyError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: { xs: "calc(100dvh - 220px)", sm: "auto" },
          width: "100%",
          px: 2,
          pb: { xs: 10, sm: 3 },
        }}
      >
        <Card
          sx={{
            width: "100%",
            maxWidth: { xs: 360, sm: 460 },
            borderRadius: 2.5,
            overflow: "hidden",
            boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)",
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={3}>
              <Stack spacing={1.35} alignItems="center" sx={{ textAlign: "center" }}>
                <RKStudioLogo size={44} variant="full" />
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: "1.75rem", sm: "2rem" },
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    maxWidth: 320,
                    background: "linear-gradient(135deg, #0F2F7A 0%, #2563EB 55%, #6D28D9 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Sign in to RK Studio
                </Typography>
                <Chip size="small" label="Secure" color="secondary" />
                <Typography
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.5,
                    maxWidth: 320,
                  }}
                >
                  Sign in to manage tailoring orders, saved items, and support.
                </Typography>
              </Stack>

              <ToggleButtonGroup
                value={role}
                exclusive
                onChange={(_, value: UserRole | null) => {
                  if (value) {
                    setRole(value);
                  }
                }}
                color="primary"
                fullWidth
                sx={{
                  width: "100%",
                  "& .MuiToggleButton-root": {
                    flex: 1,
                  },
                }}
              >
                <ToggleButton value="user">Customer</ToggleButton>
                <ToggleButton value="admin">Admin</ToggleButton>
              </ToggleButtonGroup>

              <TextField
                fullWidth
                label="Name"
                placeholder="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={otpSent || busy}
                sx={{ mb: 1.5 }}
              />

              <TextField
                fullWidth
                label="Phone"
                placeholder="9876543210"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={otpSent || busy}
                sx={{ mb: 1.5 }}
              />

              {otpSent ? (
                <TextField
                  fullWidth
                  label="OTP"
                  placeholder={usingMockFlow ? "Enter test OTP" : "Enter 6-digit OTP"}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  sx={{ mb: 1.5 }}
                />
              ) : null}

              {success ? <Alert severity="success">{success}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              {!usingMockFlow && firebaseConfigured === false ? (
                <Alert severity="warning">
                  Service temporarily unavailable, continue via WhatsApp.
                </Alert>
              ) : null}

              {USE_MOCK_OTP || usingMockFlow ? (
                <Alert severity="info">
                  Mock OTP mode enabled (testing)
                </Alert>
              ) : null}

              <Typography variant="caption" color="text.secondary">
                Need help? Contact us on WhatsApp.
              </Typography>

              {!otpSent ? (
                <Button
                  variant="contained"
                  onClick={handleSendOtp}
                  disabled={busy}
                  sx={{
                    "&.Mui-disabled": {
                      opacity: 0.55,
                      cursor: "not-allowed",
                      pointerEvents: "auto",
                    },
                  }}
                >
                  {busy ? "Sending..." : "Send OTP"}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleVerifyOtp}
                  disabled={busy}
                  sx={{
                    "&.Mui-disabled": {
                      opacity: 0.55,
                      cursor: "not-allowed",
                      pointerEvents: "auto",
                    },
                  }}
                >
                  {busy ? "Verifying..." : "Verify OTP"}
                </Button>
              )}

              {!usingMockFlow && firebaseConfigured === false ? (
                <Button
                  component="a"
                  href={whatsappFallbackUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  color="success"
                  sx={{ pointerEvents: "auto" }}
                >
                  Continue via WhatsApp
                </Button>
              ) : null}

              <div id="recaptcha-container" />
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
}
