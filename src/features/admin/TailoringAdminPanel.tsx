"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth } from "@/services/firebase";
import { createMockAccessToken } from "@/services/authService";
import { TailorCapacity } from "@/types/tailoring";
import { showError, showSuccess } from "@/utils/toast";

export default function TailoringAdminPanel() {
  const { user } = useAuth();
  const [tailors, setTailors] = useState<TailorCapacity[]>([]);
  const [loading, setLoading] = useState(true);

  const [openDialog, setOpenDialog] = useState(false);
  const [editingTailor, setEditingTailor] = useState<TailorCapacity | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    maxOrdersPerDay: 10,
    stitchingCapacityPerDay: 2,
    heavyWorkBufferDays: 3,
    minimumHeavyDeliveryDays: 5,
    bufferPercentage: 0,
    pickupCharge: 50,
    dropCharge: 50,
    discountPercentage: 5,
    advancePercentage: 20,
    active: true,
  });

  // Fetch tailors on mount
  useEffect(() => {
    fetchTailors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTailors = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/tailors", {
        headers: {
          "Authorization": `Bearer ${await getAuthToken()}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch tailors");

      const data = await response.json();
      setTailors(data.tailors || []);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not load tailors");
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    if (user?.provider === "mock") {
      return createMockAccessToken(user);
    }

    const auth = getFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();
    return token || "";
  };

  const handleOpenDialog = (tailor?: TailorCapacity): void => {
    if (tailor) {
      setEditingTailor(tailor);
      setFormData({
        name: tailor.name,
        email: tailor.email || "",
        phone: tailor.phone || "",
        maxOrdersPerDay: tailor.maxOrdersPerDay,
        stitchingCapacityPerDay: tailor.stitchingCapacityPerDay,
        heavyWorkBufferDays: tailor.heavyWorkBufferDays,
        minimumHeavyDeliveryDays: tailor.minimumHeavyDeliveryDays,
        bufferPercentage: tailor.bufferPercentage ?? 0,
        pickupCharge: tailor.pickupCharge ?? 50,
        dropCharge: tailor.dropCharge ?? 50,
        discountPercentage: tailor.discountPercentage ?? 5,
        advancePercentage: tailor.advancePercentage ?? 20,
        active: tailor.active,
      });
    } else {
      setEditingTailor(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        maxOrdersPerDay: 10,
        stitchingCapacityPerDay: 2,
        heavyWorkBufferDays: 3,
        minimumHeavyDeliveryDays: 5,
        bufferPercentage: 0,
        pickupCharge: 50,
        dropCharge: 50,
        discountPercentage: 5,
        advancePercentage: 20,
        active: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = (): void => {
    setOpenDialog(false);
    setEditingTailor(null);
  };

  const handleSave = async (): Promise<void> => {
    try {
      const token = await getAuthToken();

      if (editingTailor?.id) {
        // Update existing tailor
        const response = await fetch(`/api/admin/tailors/${editingTailor.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error("Failed to update tailor");

        showSuccess("Tailor updated successfully");
      } else {
        // Create new tailor
        const response = await fetch("/api/admin/tailors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error("Failed to create tailor");

        showSuccess("Tailor created successfully");
      }

      handleCloseDialog();
      fetchTailors();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Operation failed");
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Tailors Management
        </Typography>
        <Button
          variant="contained"
          onClick={() => handleOpenDialog()}
        >
          Add New Tailor
        </Button>
      </Box>

      <TableContainer component={Card}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Max Orders/Day
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Capacity/Day
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Heavy Buffer
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Capacity Buffer
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Pickup/Drop
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Discount/Advance
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Status
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tailors.map((tailor) => (
              <TableRow key={tailor.id}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {tailor.name}
                    </Typography>
                    {tailor.email && (
                      <Typography variant="caption" color="text.secondary">
                        {tailor.email}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{tailor.maxOrdersPerDay}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{tailor.stitchingCapacityPerDay}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{tailor.heavyWorkBufferDays} days</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{tailor.bufferPercentage ?? 0}%</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">
                    INR {tailor.pickupCharge ?? 50} / INR {tailor.dropCharge ?? 50}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">
                    {tailor.discountPercentage ?? 5}% / {tailor.advancePercentage ?? 20}%
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={tailor.active ? "Active" : "Inactive"}
                    color={tailor.active ? "success" : "default"}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDialog(tailor)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit/Create Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingTailor ? "Edit Tailor" : "Add New Tailor"}
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <TextField
              label="Email"
              fullWidth
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
            <TextField
              label="Phone"
              fullWidth
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
            <TextField
              label="Max Orders Per Day"
              type="number"
              fullWidth
              value={formData.maxOrdersPerDay}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  maxOrdersPerDay: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Stitching Capacity Per Day"
              type="number"
              fullWidth
              value={formData.stitchingCapacityPerDay}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stitchingCapacityPerDay: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Heavy Work Buffer Days"
              type="number"
              fullWidth
              value={formData.heavyWorkBufferDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  heavyWorkBufferDays: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Minimum Heavy Delivery Days"
              type="number"
              fullWidth
              value={formData.minimumHeavyDeliveryDays}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  minimumHeavyDeliveryDays: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Capacity Buffer Percentage (0-90)"
              type="number"
              fullWidth
              value={formData.bufferPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bufferPercentage: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Pickup Charge"
              type="number"
              fullWidth
              value={formData.pickupCharge}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  pickupCharge: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Drop Charge"
              type="number"
              fullWidth
              value={formData.dropCharge}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  dropCharge: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Discount Percentage"
              type="number"
              fullWidth
              value={formData.discountPercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  discountPercentage: parseInt(e.target.value, 10),
                })
              }
            />
            <TextField
              label="Advance Percentage"
              type="number"
              fullWidth
              value={formData.advancePercentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  advancePercentage: parseInt(e.target.value, 10),
                })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.name.trim()}
          >
            {editingTailor ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
