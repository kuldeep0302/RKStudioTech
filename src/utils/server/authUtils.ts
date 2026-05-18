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

const getDevMockUserFromToken = (token: string): AuthUser | null => {
  // token format: mock:<uid>:<role>
  const mockOtpEnabled = process.env.NEXT_PUBLIC_USE_MOCK_OTP === "true";

  if (!token.startsWith("mock:")) {
    return null;
  }

  if (process.env.NODE_ENV === "production" || !mockOtpEnabled) {
    return null;
  }

  const [, uid, role] = token.split(":");

  if (!uid) {
    return null;
  }

  return {
    uid,
    displayName: null,
    phoneNumber: null,
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
