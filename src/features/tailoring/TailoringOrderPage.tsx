"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  RadioGroup,
  Radio,
  Stack,
  TextField,
  Typography,
  Chip,
  MenuItem,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseAuth } from "@/services/firebase";
import { createMockAccessToken } from "@/services/authService";
import { calculatePricingBreakdown } from "@/utils/pricing";
import { CapacityInfo, PickupDropOption, TailorCapacity, WorkType } from "@/types/tailoring";
import {
  clearTailoringSizeProfile,
  hasTailoringSizeProfile,
  readTailoringSizeProfile,
  writeTailoringSizeProfile,
} from "@/features/tailoring/utils/sizeProfile";
import {
  getSuggestedMeasurementsForSize,
  parseMeasurementNumber,
} from "@/features/tailoring/utils/sizeSuggestions";

const CUSTOM_SIZE_VALUE = "custom";

export default function TailoringOrderPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [tailors, setTailors] = useState<TailorCapacity[]>([]);
  const [selectedTailorId, setSelectedTailorId] = useState<string>("");
  const [capacityInfo, setCapacityInfo] = useState<CapacityInfo | null>(null);
  const [workType, setWorkType] = useState<WorkType>("simple");
  const [sizeValue, setSizeValue] = useState("");
  const [customSizeNotes, setCustomSizeNotes] = useState("");
  const [pickupDropOption, setPickupDropOption] = useState<PickupDropOption>("self_visit");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [bust, setBust] = useState("");
  const [waist, setWaist] = useState("");
  const [length, setLength] = useState("");
  const [measurements, setMeasurements] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hasSavedSizeProfile, setHasSavedSizeProfile] = useState(false);
  const [sizeProfileFeedback, setSizeProfileFeedback] = useState("");
  const [isAutoSuggestedMeasurement, setIsAutoSuggestedMeasurement] = useState(false);

  const selectedTailor = tailors.find((tailor) => tailor.id === selectedTailorId) || null;
  const pickupCharge = pickupDropOption === "pickup_only" || pickupDropOption === "pickup_drop"
    ? (selectedTailor?.pickupCharge ?? 50)
    : 0;
  const dropCharge = pickupDropOption === "drop_only" || pickupDropOption === "pickup_drop"
    ? (selectedTailor?.dropCharge ?? 50)
    : 0;
  const pricingPreview = calculatePricingBreakdown({
    marketPrice: selectedTailor?.stitchingCapacityPerDay ? selectedTailor.stitchingCapacityPerDay * 500 : 1000,
    pricingType: "piece",
    pricePerUnit: selectedTailor?.stitchingCapacityPerDay ? selectedTailor.stitchingCapacityPerDay * 500 : 1000,
    quantityOrMeter: 1,
    discountPercentage: selectedTailor?.discountPercentage ?? 5,
    advancePercentage: selectedTailor?.advancePercentage ?? 20,
    pickupCharge,
    dropCharge,
  });

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (user?.provider === "mock") {
      return {
        Authorization: `Bearer ${createMockAccessToken(user)}`,
      };
    }

    const auth = getFirebaseAuth();
    const token = await auth?.currentUser?.getIdToken();

    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const savedProfile = readTailoringSizeProfile();

    if (!savedProfile) {
      return;
    }

    setHasSavedSizeProfile(true);
    setSizeValue((prev) => prev || savedProfile.sizeValue);
    setCustomSizeNotes((prev) => prev || savedProfile.customSizeNotes);
    setBust((prev) => prev || savedProfile.bust);
    setWaist((prev) => prev || savedProfile.waist);
    setLength((prev) => prev || savedProfile.length);
    setMeasurements((prev) => {
      if (prev) {
        return prev;
      }

      if (savedProfile.measurements) {
        return savedProfile.measurements;
      }

      const compact = [
        savedProfile.bust ? `Bust: ${savedProfile.bust}` : "",
        savedProfile.waist ? `Waist: ${savedProfile.waist}` : "",
        savedProfile.length ? `Length: ${savedProfile.length}` : "",
      ].filter(Boolean).join(", ");

      return compact;
    });
  }, []);

  const handleSaveSizeProfile = () => {
    const hasAnyMeasurementData = Boolean(
      sizeValue.trim()
      || customSizeNotes.trim()
      || bust.trim()
      || waist.trim()
      || length.trim()
      || measurements.trim(),
    );

    if (!hasAnyMeasurementData) {
      setSizeProfileFeedback("Add size or measurement details first.");
      return;
    }

    writeTailoringSizeProfile({
      sizeValue: sizeValue.trim(),
      customSizeNotes: customSizeNotes.trim(),
      bust: bust.trim(),
      waist: waist.trim(),
      length: length.trim(),
      extraMeasurement: "",
      measurements: measurements.trim(),
    });
    setHasSavedSizeProfile(true);
    setSizeProfileFeedback("Size profile saved for future tailoring orders.");
  };

  const handleApplySavedSizeProfile = () => {
    const savedProfile = readTailoringSizeProfile();

    if (!savedProfile) {
      setHasSavedSizeProfile(false);
      setSizeProfileFeedback("No saved size profile found.");
      return;
    }

    setSizeValue(savedProfile.sizeValue);
    setCustomSizeNotes(savedProfile.customSizeNotes);
    setBust(savedProfile.bust);
    setWaist(savedProfile.waist);
    setLength(savedProfile.length);
    setMeasurements(savedProfile.measurements || measurements);
    setIsAutoSuggestedMeasurement(Boolean(getSuggestedMeasurementsForSize(savedProfile.sizeValue)));
    setSizeProfileFeedback("Saved size profile applied.");
  };

  const handleClearSavedSizeProfile = () => {
    clearTailoringSizeProfile();
    setHasSavedSizeProfile(false);
    setIsAutoSuggestedMeasurement(false);
    setSizeProfileFeedback("Saved size profile cleared.");
  };

  // Fetch available tailors on mount
  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let cancelled = false;

    const fetchTailors = async () => {
      try {
        const response = await fetch("/api/admin/tailors", {
          headers: await getAuthHeaders(),
        });
        if (!response.ok) {
          throw new Error("Failed to fetch tailors");
        }

        const data = await response.json();
        if (cancelled) {
          return;
        }

        setTailors(data.tailors || []);

        if (data.tailors?.length > 0) {
          setSelectedTailorId(data.tailors[0].id);
        } else {
          setError("No tailors are available right now.");
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error("Error fetching tailors:", err);
        setError("Could not load tailors. Please try again shortly.");
      }
    };

    void fetchTailors();

    return () => {
      cancelled = true;
    };
  }, [getAuthHeaders, loading, user]);

  // Fetch capacity info when tailor changes
  useEffect(() => {
    if (!selectedTailorId) return;

    let ignore = false;

    const fetchCapacity = async () => {
      try {
        const response = await fetch(
          `/api/orders/tailoring/capacity?tailorId=${selectedTailorId}`,
          {
            headers: await getAuthHeaders(),
          },
        );
        if (!response.ok) throw new Error("Failed to fetch capacity");

        const data = await response.json();
        if (!ignore) {
          setCapacityInfo(data);
        }
      } catch (err) {
        console.error("Error fetching capacity:", err);
      }
    };

    void fetchCapacity();
    const timer = window.setInterval(() => {
      void fetchCapacity();
    }, 20000);

    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [selectedTailorId, getAuthHeaders]);

  const handlePlaceOrder = async () => {
    setError("");
    setSuccess("");

    if (!productName.trim()) {
      setError("Product name is required.");
      return;
    }

    if (sizeValue === CUSTOM_SIZE_VALUE && !customSizeNotes.trim()) {
      setError("Custom size details are required.");
      return;
    }

    if (!capacityInfo?.canUsePickupDrop && pickupDropOption !== "self_visit") {
      setError("Pickup/Drop slots are full.");
      return;
    }

    if (!capacityInfo?.canAcceptOrders) {
      setError("Today's slots are full. Please try again tomorrow.");
      return;
    }

    try {
      setIsLoading(true);
      const suggested = getSuggestedMeasurementsForSize(sizeValue);
      const chestValue = parseMeasurementNumber(bust);
      const waistValue = parseMeasurementNumber(waist);
      const lengthValue = parseMeasurementNumber(length);
      const isCustomized = sizeValue === CUSTOM_SIZE_VALUE
        || (Boolean(suggested) && (
          bust.trim() !== suggested?.chest
          || waist.trim() !== suggested?.waist
          || length.trim() !== suggested?.length
        ));

      const response = await fetch("/api/orders/tailoring/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          tailorId: selectedTailorId,
          workType,
          productDetails: {
            name: productName,
            description: productDescription,
            size: sizeValue || undefined,
            chest: chestValue,
            waist: waistValue,
            length: lengthValue,
            is_customized: isCustomized,
            measurements: {
              bust: bust || "-",
              waist: waist || "-",
              length: length || "-",
              notes: measurements || "-",
            },
            size_type: sizeValue ? (sizeValue === CUSTOM_SIZE_VALUE ? "custom" : "standard") : undefined,
            size_value: sizeValue || undefined,
            custom_size_notes: customSizeNotes.trim() || undefined,
            pickup_drop_option: pickupDropOption,
            pickup_charge: pickupCharge,
            drop_charge: dropCharge,
            total_price: pricingPreview.totalPrice,
            discount_percentage: pricingPreview.discountPercentage,
            discount_amount: pricingPreview.discountAmount,
            final_price: pricingPreview.finalPrice,
            final_payable: pricingPreview.finalPayable,
            advance_amount: pricingPreview.advanceAmount,
            remaining_amount: pricingPreview.remainingAmount,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not create order");
      }

      const data = await response.json();
      setSuccess(
        `Order successfully placed! Delivery: ${new Date(data.order.deliveryDate).toLocaleDateString("en-IN")}`,
      );

      // Reset form
      setProductName("");
      setProductDescription("");
      setBust("");
      setWaist("");
      setLength("");
      setMeasurements("");
      setWorkType("simple");
      setSizeValue("");
      setCustomSizeNotes("");
      setPickupDropOption("self_visit");

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push("/orders");
      }, 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while placing the order.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <Box sx={{ maxWidth: 800, mx: "auto", py: 4 }}>
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                  New Tailoring Order
                </Typography>
                <Typography color="text.secondary">
                  Select a tailor and place your order.
                </Typography>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}
              {success && <Alert severity="success">{success}</Alert>}

              {/* Tailor Selection */}
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 1.5, fontWeight: 600 }}>
                  Select Tailor
                </FormLabel>
                <RadioGroup
                  value={selectedTailorId}
                  onChange={(e) => setSelectedTailorId(e.target.value)}
                >
                  {tailors.map((tailor) => (
                    <FormControlLabel
                      key={tailor.id}
                      value={tailor.id}
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {tailor.name}
                          </Typography>
                          {capacityInfo?.tailorId === tailor.id && (
                            <Typography variant="caption" color="text.secondary">
                              Slots left: {capacityInfo?.slotsAvailable} /{" "}
                              {capacityInfo?.slotsPerDay}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  ))}
                </RadioGroup>
              </FormControl>

              {/* Capacity Display */}
              {capacityInfo && (
                <Card variant="outlined" sx={{ bgcolor: "background.default" }}>
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Today&apos;s Slots
                        </Typography>
                        <Box sx={{ mt: 0.5 }}>
                          {capacityInfo.canAcceptOrders ? (
                            <Chip
                              label={`${capacityInfo.slotsAvailable} slots left`}
                              color="success"
                              variant="outlined"
                              size="small"
                            />
                          ) : (
                            <Chip
                              label="All slots are booked today"
                              color="error"
                              variant="filled"
                              size="small"
                            />
                          )}
                        </Box>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Pending Queue
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{ fontWeight: 700, mt: 0.5 }}
                        >
                          {capacityInfo.pendingOrdersCount} orders
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Next available delivery date:{" "}
                          {new Date(capacityInfo.nextAvailableDeliveryDate).toLocaleDateString("en-IN")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {capacityInfo.nextAvailableSlotMessage}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Estimated queue position: #{capacityInfo.estimatedQueuePosition}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Pickup/Drop: {capacityInfo.canUsePickupDrop ? "Available" : "Pickup/Drop slots full"}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              )}

              <TextField
                select
                fullWidth
                label="Select Size (Optional)"
                helperText="Select a standard size if you are unsure about exact measurements"
                value={sizeValue}
                onChange={(e) => {
                  const value = e.target.value;
                  const suggested = getSuggestedMeasurementsForSize(value);
                  setSizeValue(value);

                  if (value === CUSTOM_SIZE_VALUE) {
                    setBust("");
                    setWaist("");
                    setLength("");
                    setIsAutoSuggestedMeasurement(false);
                  } else if (suggested) {
                    setBust(suggested.chest);
                    setWaist(suggested.waist);
                    setLength(suggested.length);
                    setIsAutoSuggestedMeasurement(true);
                  } else {
                    setIsAutoSuggestedMeasurement(false);
                  }

                  if (value !== CUSTOM_SIZE_VALUE) {
                    setCustomSizeNotes("");
                  }
                }}
              >
                <MenuItem value="">No size selected</MenuItem>
                <MenuItem value="XS">XS (Extra Small)</MenuItem>
                <MenuItem value="S">S (Small)</MenuItem>
                <MenuItem value="M">M (Medium)</MenuItem>
                <MenuItem value="L">L (Large)</MenuItem>
                <MenuItem value="XL">XL (Extra Large)</MenuItem>
                <MenuItem value="XXL">XXL</MenuItem>
                <MenuItem value={CUSTOM_SIZE_VALUE}>Custom Size</MenuItem>
              </TextField>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <Button variant="outlined" onClick={handleSaveSizeProfile}>
                  Save Size Profile
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleApplySavedSizeProfile}
                  disabled={!hasSavedSizeProfile && !hasTailoringSizeProfile()}
                >
                  Use Saved Profile
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleClearSavedSizeProfile}
                  disabled={!hasSavedSizeProfile && !hasTailoringSizeProfile()}
                >
                  Clear Saved Profile
                </Button>
              </Stack>

              {sizeProfileFeedback ? (
                <Alert severity="info">{sizeProfileFeedback}</Alert>
              ) : null}

              {getSuggestedMeasurementsForSize(sizeValue) ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                  <Alert severity="info" sx={{ flex: 1 }}>
                    Suggested measurements based on selected size (you can edit).
                  </Alert>
                  <Chip
                    color={isAutoSuggestedMeasurement ? "success" : "warning"}
                    label={isAutoSuggestedMeasurement ? "Auto-suggested" : "Manually adjusted"}
                    variant="outlined"
                    size="small"
                  />
                </Stack>
              ) : null}

              {sizeValue === CUSTOM_SIZE_VALUE ? (
                <TextField
                  label="Enter your measurements or size details"
                  value={customSizeNotes}
                  onChange={(e) => setCustomSizeNotes(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Chest 40, Waist 34, Length 38"
                  helperText="Add details for custom size"
                />
              ) : null}

              {/* Product Details */}
              <TextField
                label="Chest"
                value={bust}
                onChange={(e) => {
                  setIsAutoSuggestedMeasurement(false);
                  setBust(e.target.value);
                }}
                fullWidth
                placeholder="Enter chest in inches"
              />

              <TextField
                label="Waist"
                value={waist}
                onChange={(e) => {
                  setIsAutoSuggestedMeasurement(false);
                  setWaist(e.target.value);
                }}
                fullWidth
                placeholder="Enter waist in inches"
              />

              <TextField
                label="Length"
                value={length}
                onChange={(e) => {
                  setIsAutoSuggestedMeasurement(false);
                  setLength(e.target.value);
                }}
                fullWidth
                placeholder="Enter length in inches"
              />

              <TextField
                label="Product Name (e.g., Kurta, Shirt)"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                fullWidth
                placeholder="What do you want to stitch?"
              />

              <TextField
                label="Description"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Write design details..."
              />

              <TextField
                label="Additional Measurements / Notes (Optional)"
                value={measurements}
                onChange={(e) => setMeasurements(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Any extra fit instructions"
              />

              {/* Work Type Selection */}
              <FormControl>
                <FormLabel sx={{ fontWeight: 600, mb: 1.5 }}>
                  Work Type
                </FormLabel>
                <RadioGroup
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value as WorkType)}
                >
                  <FormControlLabel
                    value="simple"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Simple Stitching
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Usually completed in 2-3 days
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="heavy"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          Heavy / Designer Work
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Usually takes at least 4-5 days
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>

              <FormControl>
                <FormLabel sx={{ fontWeight: 600, mb: 1.5 }}>
                  Pickup / Drop Service
                </FormLabel>
                <RadioGroup
                  value={pickupDropOption}
                  onChange={(e) => setPickupDropOption(e.target.value as PickupDropOption)}
                >
                  <FormControlLabel value="self_visit" control={<Radio />} label="No Pickup (Self Visit)" />
                  <FormControlLabel
                    value="pickup_only"
                    control={<Radio />}
                    label={`Pickup Only (+INR ${selectedTailor?.pickupCharge ?? 50})`}
                    disabled={!capacityInfo?.canUsePickupDrop}
                  />
                  <FormControlLabel
                    value="drop_only"
                    control={<Radio />}
                    label={`Drop Only (+INR ${selectedTailor?.dropCharge ?? 50})`}
                    disabled={!capacityInfo?.canUsePickupDrop}
                  />
                  <FormControlLabel
                    value="pickup_drop"
                    control={<Radio />}
                    label={`Pickup & Drop (+INR ${(selectedTailor?.pickupCharge ?? 50) + (selectedTailor?.dropCharge ?? 50)})`}
                    disabled={!capacityInfo?.canUsePickupDrop}
                  />
                </RadioGroup>
                {!capacityInfo?.canUsePickupDrop ? (
                  <Typography variant="caption" color="error.main">
                    Pickup/Drop slots are full
                  </Typography>
                ) : null}
              </FormControl>

              <Card variant="outlined" sx={{ bgcolor: "background.default" }}>
                <CardContent>
                  <Stack spacing={0.8}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Pricing Preview</Typography>
                    <Typography variant="body2" color="text.secondary">Market Price: INR {pricingPreview.marketPrice}</Typography>
                    <Typography variant="body2" color="success.main">Discount ({pricingPreview.discountPercentage}%): -INR {pricingPreview.discountAmount}</Typography>
                    <Typography variant="body2" color="text.secondary">Final Price: INR {pricingPreview.finalPrice}</Typography>
                    <Typography variant="body2" color="text.secondary">Pickup/Drop Charges: INR {pricingPreview.pickupDropCharge}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Total Payable: INR {pricingPreview.finalPayable}</Typography>
                    <Typography variant="body2" color="text.secondary">Advance: INR {pricingPreview.advanceAmount}</Typography>
                    <Typography variant="body2" color="text.secondary">Remaining: INR {pricingPreview.remainingAmount}</Typography>
                    <Typography variant="caption" color="success.main">You saved INR {pricingPreview.discountAmount}</Typography>
                    {pricingPreview.pickupDropCharge > 0 ? (
                      <Typography variant="caption" color="info.main">Pickup/Drop charge included</Typography>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>

              {/* Delivery Estimate */}
              {capacityInfo?.canAcceptOrders && (
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Estimated Delivery:</strong>{" "}
                    {workType === "simple"
                      ? `${new Date(capacityInfo.nextAvailableDeliveryDate).toLocaleDateString("en-IN")}`
                      : "Heavy design work may take 4-5 days"}
                  </Typography>
                </Alert>
              )}

              {capacityInfo && !capacityInfo.canAcceptOrders && (
                <Alert severity="warning">
                  Today&apos;s slots are full. Next available slot is tomorrow.
                </Alert>
              )}

              {/* Action Buttons */}
              <Button
                variant="contained"
                size="large"
                onClick={handlePlaceOrder}
                disabled={
                  isLoading ||
                  !capacityInfo?.canAcceptOrders ||
                  !productName.trim()
                }
                sx={{ mt: 2 }}
              >
                {isLoading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Creating...
                  </>
                ) : (
                  "Place Order"
                )}
              </Button>

              <Button
                variant="outlined"
                onClick={() => router.push("/")}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  );
}
