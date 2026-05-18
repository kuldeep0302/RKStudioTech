import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/services/firebase";

const normalizeRole = (value: unknown) => {
  const role = typeof value === "string" ? value.toLowerCase() : "user";
  return role === "admin" ? "admin" : "user";
};

type ResolveRoleInput = {
  uid?: string | null;
  phoneNumber?: string | null;
};

export const resolveUserRoleFromFirestore = async ({ uid, phoneNumber }: ResolveRoleInput) => {
  const db = getFirebaseDb();

  if (!db) {
    return "user" as const;
  }

  try {
    if (uid) {
      const userDoc = await getDoc(doc(db, "users", uid));

      if (userDoc.exists()) {
        return normalizeRole((userDoc.data() as { role?: string }).role);
      }
    }

    void phoneNumber;
    return "user" as const;
  } catch (error) {
    console.error("[role] resolve failed", error);
    return "user" as const;
  }
};
