"use client";

import { CircularProgress, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { resolveUserRoleFromFirestore } from "@/services/userRoleService";
import { uiDevLogError } from "@/utils/uiFeedback";

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
      try {
        const role = await resolveUserRoleFromFirestore({
          uid: user?.uid,
          phoneNumber: user?.phoneNumber,
        });
        setIsAdmin(role === "admin");
      } catch (err) {
        uiDevLogError("ADMIN CHECK - ROLE FETCH ERROR:", err);
        setIsAdmin(false);
      }
    };

    void checkAdminRole();
  }, [loading, user?.phoneNumber, user?.uid]);

  useEffect(() => {
    if (isAdmin === false) {
      router.replace("/access-denied");
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
