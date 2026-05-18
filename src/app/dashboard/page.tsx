"use client";

import { CircularProgress, Stack } from "@mui/material";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { resolveUserRoleFromFirestore } from "@/services/userRoleService";
import { uiDevLogError } from "@/utils/uiFeedback";

const UserDashboard = dynamic(() => import("@/features/dashboard/UserDashboard"), {
  loading: () => (
    <Stack alignItems="center" py={10}>
      <CircularProgress />
    </Stack>
  ),
});

const AdminDashboard = dynamic(() => import("@/features/admin/AdminDashboard"), {
  loading: () => (
    <Stack alignItems="center" py={10}>
      <CircularProgress />
    </Stack>
  ),
});

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user?.phoneNumber) {
      setUserRole("user");
      return;
    }

    const fetchUserRole = async () => {
      if (!user?.phoneNumber) {
        setUserRole("user");
        return;
      }

      try {
        const role = await resolveUserRoleFromFirestore({
          uid: user?.uid,
          phoneNumber: user?.phoneNumber,
        });
        setUserRole(role);
      } catch (err) {
        uiDevLogError("ROLE FETCH ERROR:", err);
        setUserRole("user");
      }
    };

    void fetchUserRole();
  }, [loading, user?.phoneNumber, user?.uid]);

  if (userRole === "admin") {
    return <AdminDashboard />;
  }

  if (userRole === "user") {
    return <UserDashboard />;
  }

  return (
    <Stack alignItems="center" py={10}>
      <CircularProgress />
    </Stack>
  );
}
