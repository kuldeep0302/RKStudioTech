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
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  useMockOtp,
  verifyMockOtp,
  verifyOtpAndSaveUser,
} from "@/services/authService";
import { UserRole } from "@/types/auth";
import { isAdminPhone } from "@/utils/admin";

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
  const { user, loading, setMockSession } = useAuth();
  const { trackAsync } = useGlobalLoading();
  const [firebaseConfigured, setFirebaseConfigured] = useState<boolean | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    setFirebaseConfigured(isFirebaseConfigured());
  }, []);

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
      if (useMockOtp) {
        setPhone(formattedPhone);
        setOtpSent(true);
        setSuccess("Mock OTP mode is enabled. Test code is ready.");
        return;
      }

      confirmationResultRef.current = await trackAsync(sendOtpToPhone(formattedPhone));
      setPhone(formattedPhone);
      setOtpSent(true);
    } catch (otpError) {
      setError(mapOtpErrorMessage(otpError));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    if (!useMockOtp && !confirmationResultRef.current) {
      setError("Send OTP first.");
      return;
    }

    if (!otp) {
      setError("Enter OTP.");
      return;
    }

    try {
      setBusy(true);

      if (useMockOtp) {
        if (!verifyMockOtp(otp)) {
          setError("Invalid OTP. Please check the test code.");
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

      router.replace(role === "admin" ? "/admin" : "/");
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
              <Stack spacing={2} alignItems="center">
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1.5, sm: 1.4 }}
                  alignItems="center"
                  sx={{ width: "100%" }}
                >
                  <RKStudioLogo size={42} variant="full" />
                  <Stack spacing={1} alignItems={{ xs: "center", sm: "flex-start" }} sx={{ width: "100%" }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent={{ xs: "center", sm: "flex-start" }}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: "2rem", sm: "2.125rem" },
                          textAlign: { xs: "center", sm: "left" },
                          background: "linear-gradient(135deg, #0F2F7A 0%, #2563EB 55%, #6D28D9 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        Sign in to RK Studio
                      </Typography>
                      <Chip size="small" label="Secure" color="secondary" />
                    </Stack>
                    <Typography
                      color="text.secondary"
                      sx={{
                        textAlign: "center",
                        lineHeight: 1.5,
                        maxWidth: 280,
                        mx: "auto",
                      }}
                    >
                      Sign in to manage tailoring orders, saved items, and support.
                    </Typography>
                  </Stack>
                </Stack>
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
                  placeholder={useMockOtp ? "Enter test OTP" : "Enter 6-digit OTP"}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  sx={{ mb: 1.5 }}
                />
              ) : null}

              {success ? <Alert severity="success">{success}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              {!useMockOtp && firebaseConfigured === false ? (
                <Alert severity="warning">
                  Service temporarily unavailable.
                </Alert>
              ) : null}

              {useMockOtp ? (
                <Alert severity="info">
                  Mock OTP mode is active for testing. Test OTP: {MOCK_OTP || "not set"}
                </Alert>
              ) : null}

              <Typography variant="caption" color="text.secondary">
                Need help? Contact us on WhatsApp.
              </Typography>

              {!otpSent ? (
                <Button variant="contained" onClick={handleSendOtp} disabled={busy || (!useMockOtp && firebaseConfigured === false)}>
                  {busy ? "Sending..." : "Send OTP"}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleVerifyOtp} disabled={busy || (!useMockOtp && firebaseConfigured === false)}>
                  {busy ? "Verifying..." : "Verify OTP"}
                </Button>
              )}

              <div id="recaptcha-container" />
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
}
