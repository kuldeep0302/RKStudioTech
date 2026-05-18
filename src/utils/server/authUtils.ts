import { NextRequest } from "next/server";
import { AuthUser } from "@/types/auth";
import { getFirebaseAdminAuth } from "@/utils/server/firebaseAdmin";

/**
 * Bootstraps Firebase Admin Auth once per runtime.
 */
const getAdminAuth = () => getFirebaseAdminAuth();

const getBearerToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim() || null;
};

const normalizePhoneDigits = (phone?: string | null): string => {
  return (phone || "").replace(/\D/g, "");
};

const isAdminPhoneDigits = (phone?: string | null): boolean => {
  const adminPhoneDigits = normalizePhoneDigits(process.env.NEXT_PUBLIC_ADMIN_PHONE);
  const userPhoneDigits = normalizePhoneDigits(phone);

  if (!adminPhoneDigits || !userPhoneDigits) {
    return false;
  }

  return adminPhoneDigits.slice(-10) === userPhoneDigits.slice(-10);
};

const getDevMockUserFromToken = (token: string): AuthUser | null => {
  // token format (legacy): mock:<uid>:<role>
  // token format (current): mock-token-<uid>:<role>:<phoneDigits>
  const mockOtpEnabled = process.env.NEXT_PUBLIC_USE_MOCK_OTP === "true";
  let uid = "";
  let role = "user";
  let phoneNumber: string | null = null;

  if (token.startsWith("mock-token-")) {
    const withoutPrefix = token.slice("mock-token-".length);
    const [parsedUid, parsedRole, parsedPhone] = withoutPrefix.split(":");

    uid = parsedUid || "";
    role = parsedRole === "admin" ? "admin" : "user";
    phoneNumber = parsedPhone ? `+${parsedPhone}` : null;
  } else if (token.startsWith("mock:")) {
    const [, parsedUid, parsedRole] = token.split(":");

    uid = parsedUid || "";
    role = parsedRole === "admin" ? "admin" : "user";
  } else {
    return null;
  }

  if (!uid) {
    return null;
  }

  const allowAdminOverride = isAdminPhoneDigits(phoneNumber);

  if (!mockOtpEnabled && !allowAdminOverride) {
    return null;
  }

  if (process.env.NODE_ENV === "production" && !mockOtpEnabled && !allowAdminOverride) {
    return null;
  }

  return {
    uid,
    displayName: null,
    phoneNumber,
    provider: "mock",
    role: role === "admin" ? "admin" : "user",
  };
};

/**
 * Verify Firebase ID token from request headers.
 */
export const verifyUserToken = async (request: NextRequest): Promise<AuthUser | null> => {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return null;
    }

    const devMockUser = getDevMockUserFromToken(token);

    if (devMockUser) {
      return devMockUser;
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const isAdmin = decoded.admin === true || decoded.role === "admin" || decoded.custom_claim_role === "admin";

    return {
      uid: decoded.uid,
      displayName: typeof decoded.name === "string" ? decoded.name : null,
      phoneNumber: typeof decoded.phone_number === "string" ? decoded.phone_number : null,
      provider: "firebase",
      role: isAdmin ? "admin" : "user",
    };
  } catch {
    return null;
  }
};

/**
 * Verify admin token from request.
 */
export const verifyAdminToken = async (
  request: NextRequest,
): Promise<AuthUser | null> => {
  try {
    const user = await verifyUserToken(request);
    if (!user) {
      return null;
    }

    if (user.role !== "admin") {
      return null;
    }

    return user;
  } catch {
    return null;
  }
};
