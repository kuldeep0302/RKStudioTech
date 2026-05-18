import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber, updateProfile } from "firebase/auth";
import { getFirebaseAuth } from "@/services/firebase";
import { saveUserToFirestore } from "@/services/userService";
import { AuthUser, UserRole } from "@/types/auth";

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

export const MOCK_OTP = process.env.NEXT_PUBLIC_MOCK_OTP || "";
export const useMockOtp = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_MOCK_OTP === "true";

export const createMockUser = (name: string, phone: string, role: UserRole): AuthUser => {
  const digits = phone.replace(/\D/g, "");

  return {
    uid: `mock-${digits || "user"}`,
    displayName: name.trim() || "Test User",
    phoneNumber: normalizeIndianPhone(phone),
    role,
    provider: "mock",
  };
};

export const verifyMockOtp = (otp: string): boolean => {
  return useMockOtp && Boolean(MOCK_OTP) && otp.trim().length > 0 && otp.trim() === MOCK_OTP;
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
