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
    return "OTP bhejne me dikkat aayi. Kripya thodi der baad dobara try karein.";
  }

  switch (error.code) {
    case "auth/invalid-phone-number":
      return "Phone number sahi format me dalein.";
    case "auth/too-many-requests":
      return "Bahut zyada attempts hue. Thodi der baad phir try karein.";
    case "auth/captcha-check-failed":
      return "Verification complete nahi ho paya. Page refresh karke dobara try karein.";
    case "auth/network-request-failed":
      return "Network issue hai. Internet check karke dobara try karein.";
    case "auth/unauthorized-domain":
    case "auth/configuration-not-found":
    case "auth/billing-not-enabled":
    case "auth/invalid-app-credential":
      return "Is waqt OTP service available nahi hai. Kripya support se sampark karein.";
    default:
      return "OTP bhejne me dikkat aayi. Kripya thodi der baad dobara try karein.";
  }
};

const mapVerifyOtpErrorMessage = (error: unknown) => {
  if (!(error instanceof FirebaseError)) {
    return "OTP verify nahi hua. Dobara koshish karein.";
  }

  switch (error.code) {
    case "auth/invalid-verification-code":
      return "OTP galat hai. Sahi code dal kar dobara try karein.";
    case "auth/code-expired":
      return "OTP expire ho gaya. Naya OTP bhej kar try karein.";
    case "auth/session-expired":
      return "Session expire ho gayi. Naya OTP bhej kar phir verify karein.";
    case "auth/network-request-failed":
      return "Network issue hai. Internet check karke dobara try karein.";
    default:
      return "OTP verify nahi ho paya. Kripya dobara koshish karein.";
  }
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, setMockSession } = useAuth();
  const { trackAsync } = useGlobalLoading();

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

  const handleSendOtp = async () => {
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Apna naam dalein.");
      return;
    }

    const formattedPhone = normalizeIndianPhone(phone);

    if (!formattedPhone.startsWith("+") || formattedPhone.length < 13) {
      setError("Sahi Indian phone number dalein.");
      return;
    }

    try {
      setBusy(true);
      if (useMockOtp) {
        setPhone(formattedPhone);
        setOtpSent(true);
        setSuccess("Mock OTP mode enabled. Testing code bhej diya gaya hai.");
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
      setError("Pehle OTP bhejein.");
      return;
    }

    if (!otp) {
      setError("OTP dalein.");
      return;
    }

    try {
      setBusy(true);

      if (useMockOtp) {
        if (!verifyMockOtp(otp)) {
          setError("Galat OTP. Testing code dobara check karein.");
          return;
        }

        if (role === "admin" && !isAdminPhone(phone)) {
          setError("Admin access sirf set kiye hue admin number par milega.");
          return;
        }

        const mockUser = createMockUser(name, phone, role);
        setMockSession(mockUser);
        await trackAsync(saveMockUserToFirestore(mockUser));
        setSuccess("Mock OTP se login ho gaya.");
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
      <Box sx={{ maxWidth: 560, mx: "auto" }}>
        <Card
          sx={{
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 24px 54px rgba(15, 23, 42, 0.16)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,249,255,0.98) 100%)",
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack spacing={2.5}>
              <Stack spacing={1.5} alignItems="flex-start">
                <Stack direction="row" spacing={1.4} alignItems="center">
                  <RKStudioLogo size={42} variant="full" />
                  <Stack spacing={0.3}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 800,
                          background: "linear-gradient(135deg, #0F2F7A 0%, #2563EB 55%, #6D28D9 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        RK Studio me login karein
                      </Typography>
                      <Chip size="small" label="Surakshit" color="secondary" />
                    </Stack>
                    <Typography color="text.secondary">
                      Login karke silai order, saved kapda aur support asaani se paayein.
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
              >
                <ToggleButton value="user">Customer</ToggleButton>
                <ToggleButton value="admin">Admin</ToggleButton>
              </ToggleButtonGroup>

              <TextField
                label="Naam"
                placeholder="Aapka naam"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={otpSent || busy}
              />

              <TextField
                label="Phone"
                placeholder="9876543210"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={otpSent || busy}
              />

              {otpSent ? (
                <TextField
                  label="OTP"
                  placeholder={useMockOtp ? "Testing OTP dalein" : "6-digit code dalein"}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                />
              ) : null}

              {success ? <Alert severity="success">{success}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              {!useMockOtp && !isFirebaseConfigured ? (
                <Alert severity="warning">
                  Firebase env vars missing hain. OTP login ke liye NEXT_PUBLIC_FIREBASE_* values add karein.
                </Alert>
              ) : null}

              {useMockOtp ? (
                <Alert severity="info">
                  Testing ke liye Mock OTP mode chalu hai. Test OTP: {MOCK_OTP || "set nahi hai"}
                </Alert>
              ) : null}

              <Typography variant="caption" color="text.secondary">
                Koi dikkat ho to WhatsApp karein. Hum madad ke liye yahan hain.
              </Typography>

              {!otpSent ? (
                <Button variant="contained" onClick={handleSendOtp} disabled={busy || (!useMockOtp && !isFirebaseConfigured)}>
                  {busy ? "Bheja ja raha hai..." : "OTP bhejein"}
                </Button>
              ) : (
                <Button variant="contained" onClick={handleVerifyOtp} disabled={busy || (!useMockOtp && !isFirebaseConfigured)}>
                  {busy ? "Verify ho raha hai..." : "OTP verify karein"}
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
