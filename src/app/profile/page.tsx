"use client";

import {
  Alert,
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<ProfileForm>(initialForm);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    if (user.provider === "mock") {
      setForm({
        name: user.displayName || "",
        phone: user.phoneNumber || "",
        address: "",
        chest: "",
        waist: "",
        hip: "",
        length: "",
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
        setError("Could not load profile.");
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
    setError("");
    setSuccess("");

    if (!user?.uid) {
      setError("Please login first.");
      return;
    }

    if (!hasRequired) {
      setError("Name and phone are required.");
      return;
    }

    try {
      setSaving(true);

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

      setSuccess("Profile updated successfully.");
    } catch (saveError) {
      console.error(saveError);
      setError("Something went wrong while saving profile.");
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

            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}

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
