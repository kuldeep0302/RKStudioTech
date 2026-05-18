import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber, updateProfile } from "firebase/auth";
import { getFirebaseAuth } from "@/services/firebase";
import { saveUserToFirestore } from "@/services/userService";
import { AuthUser, UserRole } from "@/types/auth";
import { isAdminPhone } from "@/utils/admin";
import { getEnvBool } from "@/utils/env";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export const normalizeIndianPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return value;
};

const rawMockOtp = process.env.NEXT_PUBLIC_MOCK_OTP || "";
export const MOCK_OTP = rawMockOtp && rawMockOtp !== "false" ? rawMockOtp : "123456";

// In production, mock OTP only runs when explicitly enabled via env toggle.
export const useMockOtp = getEnvBool(process.env.NEXT_PUBLIC_USE_MOCK_OTP);

export const createMockUser = (name: string, phone: string, role: UserRole): AuthUser => {
  const normalizedPhone = normalizeIndianPhone(phone);

  return {
    uid: `mock-${normalizedPhone || "user"}`,
    displayName: name.trim() || "Test User",
    phoneNumber: normalizedPhone,
    role,
    provider: "mock",
  };
};

export const verifyMockOtp = (otp: string): boolean => {
  return Boolean(MOCK_OTP) && otp.trim().length > 0 && otp.trim() === MOCK_OTP;
};

export const shouldUseAdminMockOverride = (phone: string): boolean => {
  return isAdminPhone(phone);
};

export const createMockAccessToken = (user: Pick<AuthUser, "uid">): string => {
  return `mock-token-${user.uid}`;
};

export const getOrCreateRecaptcha = (): RecaptchaVerifier => {
  if (typeof window === "undefined") {
    throw new Error("OTP service temporarily unavailable. Please try again.");
  }

  const auth = getFirebaseAuth();

  if (!auth) {
    throw new Error("OTP service temporarily unavailable. Please try again.");
  }

  const recaptchaContainer = document.getElementById("recaptcha-container");

  if (!recaptchaContainer) {
    throw new Error("OTP service temporarily unavailable. Please try again.");
  }

  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
  }

  return window.recaptchaVerifier;
};

export const sendOtpToPhone = async (phone: string): Promise<ConfirmationResult> => {
  const auth = getFirebaseAuth();

  if (!auth) {
    throw new Error("OTP service temporarily unavailable. Please try again.");
  }

  const verifier = getOrCreateRecaptcha();

  try {
    return await signInWithPhoneNumber(auth, phone, verifier);
  } catch (error) {
    if (typeof window !== "undefined" && window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      delete window.recaptchaVerifier;
    }

    throw error;
  }
};

export const verifyOtpAndSaveUser = async (
  confirmationResult: ConfirmationResult,
  otp: string,
  name: string,
  fallbackPhone: string,
) => {
  const userCredential = await confirmationResult.confirm(otp);

  await updateProfile(userCredential.user, {
    displayName: name.trim(),
  });

  await saveUserToFirestore({
    uid: userCredential.user.uid,
    name: name.trim(),
    phone: userCredential.user.phoneNumber || fallbackPhone,
  });

  return userCredential.user;
};

export const saveMockUserToFirestore = async (user: AuthUser) => {
  try {
    await saveUserToFirestore({
      uid: user.uid,
      name: user.displayName || "Test User",
      phone: user.phoneNumber || "",
    });
  } catch {
    // Mock auth should not fail login when Firestore rejects unauthenticated writes.
  }
};
