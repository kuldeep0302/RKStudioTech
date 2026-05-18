"use client";

import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { AppUser, saveUserToFirestore, subscribeToUser } from "@/services/userService";
import { readMockProfileForUser, saveMockProfileForUser } from "@/utils/mockProfileStore";
import { getFriendlyErrorMessage, uiDevLogError } from "@/utils/uiFeedback";
import { showError, showSuccess } from "@/utils/toast";

type ProfileForm = {
  name: string;
  phone: string;
  address: string;
  chest: string;
  waist: string;
  hip: string;
  length: string;
};

const initialForm: ProfileForm = {
  name: "",
  phone: "",
  address: "",
  chest: "",
  waist: "",
  hip: "",
  length: "",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileForm>(initialForm);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    if (user.provider === "mock") {
      const storedMockProfile = readMockProfileForUser(user.uid);

      setForm({
        name: storedMockProfile?.name || user.displayName || "",
        phone: storedMockProfile?.phone || user.phoneNumber || "",
        address: storedMockProfile?.address || "",
        chest: storedMockProfile?.measurements?.chest || "",
        waist: storedMockProfile?.measurements?.waist || "",
        hip: storedMockProfile?.measurements?.hip || "",
        length: storedMockProfile?.measurements?.length || "",
      });
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToUser(
      user.uid,
      (profile: AppUser | null) => {
        const measurements = profile?.measurements || {};

        setForm({
          name: profile?.name || user.displayName || "",
          phone: profile?.phone || user.phoneNumber || "",
          address: profile?.address || "",
          chest: String(measurements.chest || ""),
          waist: String(measurements.waist || ""),
          hip: String(measurements.hip || ""),
          length: String(measurements.length || ""),
        });
        setLoading(false);
      },
      () => {
        showError("Could not load profile.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, user?.displayName, user?.phoneNumber]);

  const hasRequired = useMemo(() => form.name.trim() && form.phone.trim(), [form.name, form.phone]);

  const updateField = (key: keyof ProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user?.uid) {
      showError("Please login first.");
      return;
    }

    if (!hasRequired) {
      showError("Name and phone are required.");
      return;
    }

    try {
      setSaving(true);

      if (user.provider === "mock") {
        saveMockProfileForUser({
          userId: user.uid,
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          measurements: {
            chest: form.chest.trim(),
            waist: form.waist.trim(),
            hip: form.hip.trim(),
            length: form.length.trim(),
          },
        });

        showSuccess("Profile saved successfully");
        return;
      }

      await saveUserToFirestore({
        uid: user.uid,
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        measurements: {
          chest: form.chest.trim(),
          waist: form.waist.trim(),
          hip: form.hip.trim(),
          length: form.length.trim(),
        },
      });

      showSuccess("Profile saved successfully");
    } catch (saveError) {
      uiDevLogError(saveError);
      showError(getFriendlyErrorMessage(saveError, "Something went wrong"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Stack alignItems="center" py={8}>
          <CircularProgress />
        </Stack>
      </Layout>
    );
  }

  return (
    <Layout>
      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography variant="h4">My Profile</Typography>
            <Typography color="text.secondary">Keep your details updated for faster checkout.</Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Name" value={form.name} onChange={(event) => updateField("name", event.target.value)} fullWidth />
              <TextField label="Phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} fullWidth />
            </Stack>

            <TextField
              label="Address"
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              multiline
              minRows={2}
              fullWidth
            />

            <Typography variant="h6">Measurements</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Chest" value={form.chest} onChange={(event) => updateField("chest", event.target.value)} fullWidth />
              <TextField label="Waist" value={form.waist} onChange={(event) => updateField("waist", event.target.value)} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Hip" value={form.hip} onChange={(event) => updateField("hip", event.target.value)} fullWidth />
              <TextField label="Length" value={form.length} onChange={(event) => updateField("length", event.target.value)} fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button variant="contained" onClick={handleSave} disabled={saving || !hasRequired} fullWidth>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Layout>
  );
}
