"use client";

import { CircularProgress, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseDb } from "@/services/firebase";

type AdminGuardProps = {
  children: ReactNode;
};

export default function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user?.phoneNumber) {
      setIsAdmin(false);
      return;
    }

    const checkAdminRole = async () => {
      const db = getFirebaseDb();
      const userPhone = user?.phoneNumber;

      if (!db || !userPhone) {
        setIsAdmin(false);
        return;
      }

      try {
        const q = query(collection(db, "users"), where("phone", "==", userPhone));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data() as { role?: string };
          const role = (data.role || "user").toLowerCase();
          console.log("ADMIN CHECK - USER ROLE:", role);
          setIsAdmin(role === "admin");
        } else {
          console.log("ADMIN CHECK - No user found");
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("ADMIN CHECK - ROLE FETCH ERROR:", err);
        setIsAdmin(false);
      }
    };

    void checkAdminRole();
  }, [loading, user?.phoneNumber]);

  useEffect(() => {
    if (isAdmin === false) {
      router.replace("/");
    }
  }, [isAdmin, router]);

  if (loading || isAdmin === null) {
    return (
      <Stack alignItems="center" justifyContent="center" py={10}>
        <CircularProgress />
      </Stack>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}
