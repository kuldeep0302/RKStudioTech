import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/services/firebase";
import { UserRole } from "@/types/auth";

type SaveUserInput = {
  uid: string;
  name?: string;
  phone?: string;
  role?: UserRole;
  address?: string;
  measurements?: Record<string, string | number>;
  savedFabricIds?: string[];
};

export type AppUser = {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  address?: string;
  measurements?: Record<string, string | number>;
  savedFabricIds?: string[];
  createdAt: Timestamp | null;
};

export const saveUserToFirestore = async ({ uid, name, phone, role, address, measurements, savedFabricIds }: SaveUserInput) => {
  const db = getFirebaseDb();

  if (!db) {
    return;
  }

  const payload: Record<string, unknown> = {
    createdAt: serverTimestamp(),
  };

  if (typeof name !== "undefined") {
    payload.name = name;
  }

  if (typeof phone !== "undefined") {
    payload.phone = phone;
  }

  if (typeof role !== "undefined") {
    payload.role = role;
  }

  if (typeof address !== "undefined") {
    payload.address = address;
  }

  if (typeof measurements !== "undefined") {
    payload.measurements = measurements;
  }

  if (typeof savedFabricIds !== "undefined") {
    payload.savedFabricIds = savedFabricIds;
  }

  await setDoc(
    doc(db, "users", uid),
    payload,
    { merge: true },
  );
};

export const subscribeToUser = (
  uid: string,
  onUser: (user: AppUser | null) => void,
  onError?: (error: Error) => void,
) => {
  if (uid.startsWith("mock-")) {
    onUser(null);
    return () => undefined;
  }

  const db = getFirebaseDb();

  if (!db) {
    onUser(null);
    return () => undefined;
  }

  return onSnapshot(
    doc(db, "users", uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUser(null);
        return;
      }

      const data = snapshot.data() as Omit<AppUser, "id">;

      onUser({
        id: snapshot.id,
        name: data.name || "-",
        phone: data.phone || "-",
        role: (data.role || "user") as UserRole,
        address: typeof data.address === "string" ? data.address : "",
        measurements:
          data.measurements && typeof data.measurements === "object"
            ? data.measurements as Record<string, string | number>
            : {},
        savedFabricIds: Array.isArray(data.savedFabricIds) ? data.savedFabricIds : [],
        createdAt: data.createdAt || null,
      });
    },
    (error) => {
      onError?.(error as Error);
    },
  );
};

export const subscribeToAllUsers = (
  onUsers: (users: AppUser[]) => void,
  onError?: (error: Error) => void,
) => {
  const db = getFirebaseDb();

  if (!db) {
    onUsers([]);
    return () => undefined;
  }

  const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));

  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const users: AppUser[] = snapshot.docs.map((userDoc) => {
        const data = userDoc.data() as Omit<AppUser, "id">;

        return {
          id: userDoc.id,
          name: data.name || "-",
          phone: data.phone || "-",
          role: (data.role || "user") as UserRole,
          address: typeof data.address === "string" ? data.address : "",
          measurements:
            data.measurements && typeof data.measurements === "object"
              ? data.measurements as Record<string, string | number>
              : {},
          savedFabricIds: Array.isArray(data.savedFabricIds) ? data.savedFabricIds : [],
          createdAt: data.createdAt || null,
        };
      });

      onUsers(users);
    },
    (error) => {
      onError?.(error as Error);
    },
  );
};

export const updateUserRole = async (userId: string, role: UserRole) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await updateDoc(doc(db, "users", userId), {
    role,
    updatedAt: serverTimestamp(),
  });
};

export const deleteUserById = async (userId: string) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await deleteDoc(doc(db, "users", userId));
};
