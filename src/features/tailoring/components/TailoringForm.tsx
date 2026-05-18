"use client";

import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalLoading } from "@/context/LoadingContext";
import { useAuth } from "@/hooks/useAuth";
import { useProducts } from "@/hooks/useProducts";
import { OrderDetails } from "@/services/orderService";
import { saveUserToFirestore, subscribeToUser } from "@/services/userService";
import { RK_STUDIO } from "@/utils/constants";
import { createPendingPaymentToken, savePendingPaymentOrder } from "@/utils/paymentSession";
import { getTailoringValidationMessage } from "@/features/tailoring/utils/validation";
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
import { showError } from "@/utils/toast";
import TailoringStepper from "./TailoringStepper";

type FabricSource = "" | "own" | "external" | "rkstudio";
type PickupDropOption = "self_visit" | "pickup_only" | "drop_only" | "pickup_drop";

type TailoringFormData = {
  category: string;
  design: string;
  size: string;
  customSizeNotes: string;
  bust: string;
  waist: string;
  hip: string;
  shoulder: string;
  sleeveLength: string;
  kurtiLength: string;
  pantLength: string;
  length: string;
  extraMeasurement: string;
  fabricSource: FabricSource;
  pickupDropOption: PickupDropOption;
  fabricType: string;
  fabricColor: string;
  fabricName: string;
  fabricLink: string;
  rkStudioProductId: string;
  fabricNotes: string;
  customerName: string;
  phone: string;
};

type TailoringPickerFilters = {
  query: string;
  type: string;
  maxPrice: string;
  sortBy: string;
};

const stepLabels = ["Category", "Design", "Measurements", "Fabric Source", "Summary"];
const SAVED_FABRICS_STORAGE_KEY = "rkstudio_saved_fabric_ids";
const CUSTOM_SIZE_VALUE = "Custom Size";
const CUSTOM_SIZE_NOTES_MAX_LENGTH = 500;
const DEFAULT_PICKUP_CHARGE = Number(process.env.NEXT_PUBLIC_TAILORING_PICKUP_CHARGE || 50);
const DEFAULT_DROP_CHARGE = Number(process.env.NEXT_PUBLIC_TAILORING_DROP_CHARGE || 50);

const SALWAR_SUIT_FABRIC_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: "cotton", label: "Cotton", description: "Soft and breathable for summer." },
  { value: "rayon", label: "Rayon", description: "Flowy drape for daily and semi-formal wear." },
  { value: "georgette", label: "Georgette", description: "Light texture for party styles." },
  { value: "chiffon", label: "Chiffon", description: "Very light and airy feel." },
  { value: "silk", label: "Silk", description: "Premium wedding and festive look." },
  { value: "lawn-cotton", label: "Lawn Cotton", description: "Thin and cool for hot weather." },
  { value: "velvet", label: "Velvet", description: "Heavy and rich finish." },
  { value: "muslin", label: "Muslin", description: "Premium lightweight comfort." },
  { value: "crepe", label: "Crepe", description: "Soft stretch and easy fall." },
  { value: "organza", label: "Organza", description: "Fancy sheer fabric for occasion wear." },
];

const BLOUSE_FABRIC_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: "cotton", label: "Cotton", description: "Comfortable everyday blouse option." },
  { value: "silk", label: "Silk", description: "Classic bridal and festive choice." },
  { value: "satin", label: "Satin", description: "Smooth glossy finish." },
  { value: "velvet", label: "Velvet", description: "Heavy premium blouse style." },
  { value: "net", label: "Net", description: "Light and decorative layer." },
  { value: "brocade", label: "Brocade", description: "Traditional woven festive texture." },
  { value: "georgette", label: "Georgette", description: "Soft drape with elegant fall." },
  { value: "raw-silk", label: "Raw Silk", description: "Textured premium silk look." },
  { value: "banarasi", label: "Banarasi", description: "Heritage woven festive fabric." },
  { value: "linen", label: "Linen", description: "Breathable and crisp structure." },
];

const FABRIC_SURCHARGE: Record<string, number> = {
  silk: 200,
  velvet: 300,
  cotton: 0,
};

const sizeOptions: Array<{ value: string; label: string }> = [
  { value: "XS", label: "XS (Extra Small)" },
  { value: "S", label: "S (Small)" },
  { value: "M", label: "M (Medium)" },
  { value: "L", label: "L (Large)" },
  { value: "XL", label: "XL (Extra Large)" },
  { value: "XXL", label: "XXL" },
  { value: CUSTOM_SIZE_VALUE, label: CUSTOM_SIZE_VALUE },
];

const normalizeSpace = (value: string) => {
  return value.replace(/\s+/g, " ").trim();
};

const readSavedFabricIdsFromStorage = () => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_FABRICS_STORAGE_KEY);

    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    window.localStorage.removeItem(SAVED_FABRICS_STORAGE_KEY);
    return [] as string[];
  }
};

const fabricSourceOptions: Array<{ value: Exclude<FabricSource, "">; title: string; description: string }> = [
  {
    value: "own",
    title: "I already have fabric",
    description: "Share fabric type, color, and notes.",
  },
  {
    value: "external",
    title: "I will buy fabric myself",
    description: "Share the fabric name and link.",
  },
  {
    value: "rkstudio",
    title: "I want fabric from RK Studio",
    description: "Choose RK Studio fabric directly here.",
  },
];

const getFabricSourceLabel = (fabricSource: FabricSource) => {
  if (fabricSource === "own") {
    return "Own";
  }

  if (fabricSource === "external") {
    return "External Purchase";
  }

  if (fabricSource === "rkstudio") {
    return "RK Studio";
  }

  return "-";
};

const initialData: TailoringFormData = {
  category: "",
  design: "",
  size: "",
  customSizeNotes: "",
  bust: "",
  waist: "",
  hip: "",
  shoulder: "",
  sleeveLength: "",
  kurtiLength: "",
  pantLength: "",
  length: "",
  extraMeasurement: "",
  fabricSource: "",
  pickupDropOption: "self_visit",
  fabricType: "",
  fabricColor: "",
  fabricName: "",
  fabricLink: "",
  rkStudioProductId: "",
  fabricNotes: "",
  customerName: "",
  phone: "",
};

export default function TailoringForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { trackAsync } = useGlobalLoading();
  const { products, loading: productsLoading, error: productsError } = useProducts({ category: "fabric" });
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<TailoringFormData>(initialData);
  const [pickerFilters, setPickerFilters] = useState<TailoringPickerFilters>({
    query: "",
    type: "all",
    maxPrice: "5000",
    sortBy: "featured",
  });
  const [compareProductIds, setCompareProductIds] = useState<string[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [savedProductsReady, setSavedProductsReady] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [initialPrefilledProductId, setInitialPrefilledProductId] = useState("");
  const [prefilledProductIds, setPrefilledProductIds] = useState<string[]>([]);
  const [highlightedProductId, setHighlightedProductId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [hasSavedSizeProfile, setHasSavedSizeProfile] = useState(false);
  const [sizeProfileFeedback, setSizeProfileFeedback] = useState("");
  const [isAutoSuggestedMeasurement, setIsAutoSuggestedMeasurement] = useState(false);

  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error]);

  const isLast = activeStep === stepLabels.length - 1;

  const updateField = (field: keyof TailoringFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateFabricSource = (value: FabricSource) => {
    setFormData((prev) => ({
      ...prev,
      fabricSource: value,
      fabricType: "",
      fabricColor: "",
      fabricName: "",
      fabricLink: "",
      rkStudioProductId: "",
      fabricNotes: "",
    }));
    setCompareProductIds([]);
  };

  const toggleCompareProduct = (productId: string) => {
    setCompareProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }

      if (prev.length >= 2) {
        return [...prev.slice(1), productId];
      }

      return [...prev, productId];
    });
  };

  const toggleSavedProduct = (productId: string) => {
    setSavedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }

      return [...prev, productId];
    });
  };

  useEffect(() => {
    const localSavedProductIds = readSavedFabricIdsFromStorage();

    if (!user?.uid) {
      setSavedProductIds(localSavedProductIds);
      setSavedProductsReady(true);
      return;
    }

    setSavedProductsReady(false);

    const unsubscribe = subscribeToUser(
      user.uid,
      (appUser) => {
        const nextSavedProductIds = appUser?.savedFabricIds?.length ? appUser.savedFabricIds : localSavedProductIds;
        setSavedProductIds(nextSavedProductIds);
        setSavedProductsReady(true);
      },
      () => {
        setSavedProductIds(localSavedProductIds);
        setSavedProductsReady(true);
      },
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!savedProductsReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SAVED_FABRICS_STORAGE_KEY, JSON.stringify(savedProductIds));

    if (!user?.uid) {
      return;
    }

    void saveUserToFirestore({
      uid: user.uid,
      name: user.displayName || "Customer",
      phone: user.phoneNumber || "-",
      savedFabricIds: savedProductIds,
    });
  }, [savedProductIds, savedProductsReady, user?.displayName, user?.phoneNumber, user?.uid]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setCompareProductIds((prev) => prev.filter((productId) => savedProductIds.includes(productId) || products.some((product) => product.id === productId)));
  }, [products, savedProductIds]);

  useEffect(() => {
    if (prefillApplied || typeof window === "undefined" || products.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const selectedFabricId = params.get("fabric") || "";
    const compareIds = (params.get("compare") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 2);

    const validSelectedFabricId = products.some((product) => product.id === selectedFabricId) ? selectedFabricId : "";
    const validCompareIds = compareIds.filter((compareId) => products.some((product) => product.id === compareId));

    if (validSelectedFabricId || validCompareIds.length > 0) {
      setInitialPrefilledProductId(validSelectedFabricId || validCompareIds[0] || "");
      setPrefilledProductIds(Array.from(new Set([validSelectedFabricId, ...validCompareIds].filter(Boolean))));
      setFormData((prev) => ({
        ...prev,
        fabricSource: "rkstudio",
        rkStudioProductId: validSelectedFabricId || validCompareIds[0] || prev.rkStudioProductId,
      }));
      setActiveStep(3);
      setCompareProductIds(validCompareIds);
    }

    setPrefillApplied(true);
  }, [prefillApplied, products]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !prefillApplied ||
      activeStep !== 3 ||
      formData.fabricSource !== "rkstudio" ||
      !formData.rkStudioProductId
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const selectedCard = document.getElementById(`rkstudio-fabric-card-${formData.rkStudioProductId}`);

      selectedCard?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      setHighlightedProductId(formData.rkStudioProductId);
    }, 150);

    const resetTimer = window.setTimeout(() => {
      setHighlightedProductId("");
    }, 1800);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(resetTimer);
    };
  }, [activeStep, formData.fabricSource, formData.rkStudioProductId, prefillApplied]);

  const selectedFabricProduct = useMemo(() => {
    return products.find((product) => product.id === formData.rkStudioProductId) || null;
  }, [formData.rkStudioProductId, products]);

  const compareProducts = useMemo(() => {
    return compareProductIds
      .map((productId) => products.find((product) => product.id === productId) || null)
      .filter((product): product is (typeof products)[number] => Boolean(product));
  }, [compareProductIds, products]);

  const savedProducts = useMemo(() => {
    return savedProductIds
      .map((productId) => products.find((product) => product.id === productId) || null)
      .filter((product): product is (typeof products)[number] => Boolean(product));
  }, [products, savedProductIds]);

  const isDashboardPrefilledSelection = useMemo(() => {
    return Boolean(formData.rkStudioProductId) && prefilledProductIds.includes(formData.rkStudioProductId);
  }, [formData.rkStudioProductId, prefilledProductIds]);

  const hasChangedFromPrefilledSelection = useMemo(() => {
    return Boolean(initialPrefilledProductId) && Boolean(formData.rkStudioProductId) && formData.rkStudioProductId !== initialPrefilledProductId;
  }, [formData.rkStudioProductId, initialPrefilledProductId]);

  const availableFabricTypes = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.type))).sort((left, right) => left.localeCompare(right));
  }, [products]);

  const tailoringFabricOptions = useMemo(() => {
    return formData.category === "blouse" ? BLOUSE_FABRIC_OPTIONS : SALWAR_SUIT_FABRIC_OPTIONS;
  }, [formData.category]);

  const selectedFabricOption = useMemo(() => {
    return tailoringFabricOptions.find((option) => option.value === formData.fabricType) || null;
  }, [formData.fabricType, tailoringFabricOptions]);

  const filteredFabricProducts = useMemo(() => {
    const normalizedQuery = pickerFilters.query.trim().toLowerCase();
    const maxPrice = Number(pickerFilters.maxPrice || 0);

    const filteredProducts = products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.type.toLowerCase().includes(normalizedQuery) ||
        product.tag.toLowerCase().includes(normalizedQuery);
      const matchesType = pickerFilters.type === "all" || product.type === pickerFilters.type;
      const matchesPrice = product.price <= maxPrice;

      return matchesQuery && matchesType && matchesPrice;
    });

    const sortedProducts = [...filteredProducts];

    if (pickerFilters.sortBy === "price-low") {
      sortedProducts.sort((left, right) => left.price - right.price);
    } else if (pickerFilters.sortBy === "price-high") {
      sortedProducts.sort((left, right) => right.price - left.price);
    } else if (pickerFilters.sortBy === "discount-first") {
      sortedProducts.sort((left, right) => (right.discountPercent || 0) - (left.discountPercent || 0));
    } else if (pickerFilters.sortBy === "rating-high") {
      sortedProducts.sort((left, right) => (right.rating || 0) - (left.rating || 0));
    }

    return sortedProducts;
  }, [pickerFilters.maxPrice, pickerFilters.query, pickerFilters.sortBy, pickerFilters.type, products]);

  const fabricDetails = useMemo<OrderDetails | null>(() => {
    if (formData.fabricSource === "own") {
      const normalizedType = formData.fabricType.trim().toLowerCase();
      const surcharge = FABRIC_SURCHARGE[normalizedType] || 0;
      const details: OrderDetails = {
        fabricSource: "own",
        fabricType: normalizedType,
        fabricTypeDescription: selectedFabricOption?.description || "",
        fabricSurcharge: surcharge,
        fabricColor: formData.fabricColor.trim(),
        notes: formData.fabricNotes.trim(),
      };

      return details;
    }

    if (formData.fabricSource === "external") {
      const normalizedType = formData.fabricType.trim().toLowerCase();
      const details: OrderDetails = {
        fabricSource: "external",
        fabricType: normalizedType,
        fabricTypeDescription: selectedFabricOption?.description || "",
        fabricSurcharge: FABRIC_SURCHARGE[normalizedType] || 0,
        fabricName: formData.fabricName.trim(),
        fabricLink: formData.fabricLink.trim(),
        notes: formData.fabricNotes.trim(),
      };

      return details;
    }

    if (formData.fabricSource === "rkstudio") {
      const details: OrderDetails = {
        fabricSource: "rkstudio",
        productId: selectedFabricProduct?.id || formData.rkStudioProductId,
        productName: selectedFabricProduct?.name || "",
      };

      return details;
    }

    return null;
  }, [formData.fabricColor, formData.fabricLink, formData.fabricName, formData.fabricNotes, formData.fabricSource, formData.fabricType, formData.rkStudioProductId, selectedFabricOption?.description, selectedFabricProduct]);

  const fabricSummaryLines = useMemo(() => {
    if (formData.fabricSource === "own") {
      return [
        `Fabric Source: ${getFabricSourceLabel(formData.fabricSource)}`,
        `Type: ${formData.fabricType || "-"}`,
        `Type Details: ${selectedFabricOption?.description || "-"}`,
        `Color: ${formData.fabricColor || "-"}`,
        `Notes: ${formData.fabricNotes || "-"}`,
      ];
    }

    if (formData.fabricSource === "external") {
      return [
        `Fabric Source: ${getFabricSourceLabel(formData.fabricSource)}`,
        `Type: ${formData.fabricType || "-"}`,
        `Type Details: ${selectedFabricOption?.description || "-"}`,
        `Fabric Name: ${formData.fabricName || "-"}`,
        `Fabric Link: ${formData.fabricLink || "-"}`,
        `Notes: ${formData.fabricNotes || "-"}`,
      ];
    }

    if (formData.fabricSource === "rkstudio") {
      return [
        `Fabric Source: ${getFabricSourceLabel(formData.fabricSource)}`,
        `Selected Fabric: ${selectedFabricProduct?.name || "-"}`,
      ];
    }

    return ["Fabric Source: -"];
  }, [formData.fabricLink, formData.fabricName, formData.fabricNotes, formData.fabricSource, formData.fabricType, formData.fabricColor, selectedFabricOption?.description, selectedFabricProduct]);

  const whatsappDetails = useMemo(() => {
    const normalizedCustomSize = normalizeSpace(formData.customSizeNotes);
    const sizeText = formData.size
      ? formData.size === CUSTOM_SIZE_VALUE
        ? `Custom Size: ${normalizedCustomSize || "-"}`
        : `Size: ${formData.size}`
      : "Size: -";

    const pickupCharge = formData.pickupDropOption === "pickup_only" || formData.pickupDropOption === "pickup_drop"
      ? DEFAULT_PICKUP_CHARGE
      : 0;
    const dropCharge = formData.pickupDropOption === "drop_only" || formData.pickupDropOption === "pickup_drop"
      ? DEFAULT_DROP_CHARGE
      : 0;
    const pickupDropLabel = formData.pickupDropOption === "pickup_only"
      ? "Pickup Only"
      : formData.pickupDropOption === "drop_only"
        ? "Drop Only"
        : formData.pickupDropOption === "pickup_drop"
          ? "Pickup & Drop"
          : "No Pickup (Self Visit)";

    return [
      `Tailoring Category: ${formData.category || "-"}`,
      `Design: ${formData.design || "-"}`,
      sizeText,
      `Pickup/Drop: ${pickupDropLabel}`,
      `Pickup Charge: INR ${pickupCharge}`,
      `Drop Charge: INR ${dropCharge}`,
      `Measurements: Bust ${formData.bust || "-"}, Waist ${formData.waist || "-"}, Hip ${formData.hip || "-"}, Shoulder ${formData.shoulder || "-"}, Sleeve ${formData.sleeveLength || "-"}, Kurti Length ${formData.kurtiLength || "-"}, Pant Length ${formData.pantLength || "-"}`,
      `Extra Measurement: ${formData.extraMeasurement || "-"}`,
      ...fabricSummaryLines,
    ];
  }, [fabricSummaryLines, formData.bust, formData.category, formData.customSizeNotes, formData.design, formData.extraMeasurement, formData.hip, formData.kurtiLength, formData.pantLength, formData.pickupDropOption, formData.shoulder, formData.size, formData.sleeveLength, formData.waist]);

  const validationMessage = useMemo(() => {
    return getTailoringValidationMessage({
      activeStep,
      formData,
    });
  }, [activeStep, formData]);

  const customSizeCharactersLeft = CUSTOM_SIZE_NOTES_MAX_LENGTH - formData.customSizeNotes.length;

  const handleNext = useCallback(async () => {
    console.info("[tailoring] proceed click", {
      activeStep,
      isLast,
      hasValidationError: Boolean(validationMessage),
    });

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");

    if (isLast) {
      const userId = user?.uid || `guest-${formData.phone.replace(/\D/g, "") || "anonymous"}`;
      const name = formData.customerName.trim() || user?.displayName || "Customer";
      const phone = formData.phone.trim() || user?.phoneNumber || "Not provided";
      const normalizedCustomSize = normalizeSpace(formData.customSizeNotes);
      const suggested = getSuggestedMeasurementsForSize(formData.size);
      const chestValue = parseMeasurementNumber(formData.bust);
      const waistValue = parseMeasurementNumber(formData.waist);
      const lengthValue = parseMeasurementNumber(formData.length);
      const hipValue = parseMeasurementNumber(formData.hip);
      const shoulderValue = parseMeasurementNumber(formData.shoulder);
      const sleeveLengthValue = parseMeasurementNumber(formData.sleeveLength);
      const kurtiLengthValue = parseMeasurementNumber(formData.kurtiLength);
      const pantLengthValue = parseMeasurementNumber(formData.pantLength);
      const pickupCharge = formData.pickupDropOption === "pickup_only" || formData.pickupDropOption === "pickup_drop"
        ? DEFAULT_PICKUP_CHARGE
        : 0;
      const dropCharge = formData.pickupDropOption === "drop_only" || formData.pickupDropOption === "pickup_drop"
        ? DEFAULT_DROP_CHARGE
        : 0;
      const workType = formData.design === "simple" ? "simple" : "heavy";
      const isCustomized = formData.size === CUSTOM_SIZE_VALUE
        || (Boolean(suggested) && (
          formData.bust.trim() !== suggested?.chest
          || formData.waist.trim() !== suggested?.waist
          || formData.length.trim() !== suggested?.length
        ));
      const sizePayload = formData.size
        ? formData.size === CUSTOM_SIZE_VALUE
          ? {
            size_type: "custom" as const,
            size_value: CUSTOM_SIZE_VALUE,
            custom_size_notes: normalizedCustomSize,
          }
          : {
            size_type: "standard" as const,
            size_value: formData.size,
          }
        : null;

      try {
        setSubmitting(true);
        const token = createPendingPaymentToken();

        await trackAsync(
          Promise.resolve(
            savePendingPaymentOrder(token, {
              service: "tailoring",
              userId,
              customerName: name,
              customerPhone: phone,
              orderDetails: {
                category: formData.category || "-",
                design: formData.design || "-",
                ...(sizePayload || {}),
                size: formData.size || undefined,
                chest: chestValue,
                waist: waistValue,
                length: lengthValue,
                hip: hipValue,
                shoulder: shoulderValue,
                sleeve_length: sleeveLengthValue,
                kurti_length: kurtiLengthValue,
                pant_length: pantLengthValue,
                is_customized: isCustomized,
                work_type: workType,
                pickup_drop_option: formData.pickupDropOption,
                pickup_charge: pickupCharge,
                drop_charge: dropCharge,
                measurements: {
                  bust: chestValue,
                  waist: waistValue,
                  hip: hipValue,
                  shoulder: shoulderValue,
                  sleeveLength: sleeveLengthValue,
                  kurtiLength: kurtiLengthValue,
                  pantLength: pantLengthValue,
                  extraMeasurement: formData.extraMeasurement || "-",
                },
                fabricDetails: fabricDetails || {
                  fabricSource: "-",
                },
                pricing_type: selectedFabricProduct?.pricingType || "piece",
                quantity_or_meter: 1,
              },
              productId: selectedFabricProduct?.id || undefined,
              amount: RK_STUDIO.payment.tailoringAdvanceDefault,
              paymentType: "advance",
              pricingInput: {
                productId: selectedFabricProduct?.id || undefined,
                pricingType: selectedFabricProduct?.pricingType || "piece",
                quantityOrMeter: 1,
                pickupCharge,
                dropCharge,
              },
              whatsappDetails,
            }),
          ),
        );

        console.info("[tailoring] checkout redirect", {
          token,
          service: "tailoring",
          productId: selectedFabricProduct?.id || "",
        });
        router.push(`/checkout?token=${encodeURIComponent(token)}`);
      } catch {
        setError("Could not open payment page. Please try again.");
      } finally {
        setSubmitting(false);
      }

      return;
    }

    setActiveStep((prev) => prev + 1);
  }, [
    activeStep,
    fabricDetails,
    formData,
    isLast,
    router,
    selectedFabricProduct,
    trackAsync,
    user,
    validationMessage,
    whatsappDetails,
  ]);

  const handleBack = () => {
    setError("");
    setActiveStep((prev) => Math.max(0, prev - 1));
  };

  useEffect(() => {
    const savedProfile = readTailoringSizeProfile();

    if (!savedProfile) {
      return;
    }

    setHasSavedSizeProfile(true);

    setFormData((prev) => ({
      ...prev,
      size: prev.size || savedProfile.sizeValue,
      customSizeNotes: prev.customSizeNotes || savedProfile.customSizeNotes,
      bust: prev.bust || savedProfile.bust,
      waist: prev.waist || savedProfile.waist,
      hip: prev.hip || savedProfile.hip || "",
      shoulder: prev.shoulder || savedProfile.shoulder || "",
      sleeveLength: prev.sleeveLength || savedProfile.sleeveLength || "",
      kurtiLength: prev.kurtiLength || savedProfile.kurtiLength || "",
      pantLength: prev.pantLength || savedProfile.pantLength || "",
      length: prev.length || savedProfile.length,
      extraMeasurement: prev.extraMeasurement || savedProfile.extraMeasurement,
    }));
  }, []);

  const handleSaveSizeProfile = () => {
    const hasAnyMeasurementData = Boolean(
      formData.size.trim()
      || formData.customSizeNotes.trim()
      || formData.bust.trim()
      || formData.waist.trim()
      || formData.hip.trim()
      || formData.shoulder.trim()
      || formData.sleeveLength.trim()
      || formData.kurtiLength.trim()
      || formData.pantLength.trim()
      || formData.length.trim()
      || formData.extraMeasurement.trim(),
    );

    if (!hasAnyMeasurementData) {
      setSizeProfileFeedback("Add measurement details first, then save your size profile.");
      return;
    }

    writeTailoringSizeProfile({
      sizeValue: formData.size.trim(),
      customSizeNotes: formData.customSizeNotes.trim(),
      bust: formData.bust.trim(),
      waist: formData.waist.trim(),
      hip: formData.hip.trim(),
      shoulder: formData.shoulder.trim(),
      sleeveLength: formData.sleeveLength.trim(),
      kurtiLength: formData.kurtiLength.trim(),
      pantLength: formData.pantLength.trim(),
      length: formData.length.trim(),
      extraMeasurement: formData.extraMeasurement.trim(),
      measurements: "",
    });
    setHasSavedSizeProfile(true);
    setSizeProfileFeedback("Size profile saved. You can reuse it for your next orders.");
  };

  const handleApplySavedSizeProfile = () => {
    const savedProfile = readTailoringSizeProfile();

    if (!savedProfile) {
      setHasSavedSizeProfile(false);
      setSizeProfileFeedback("No saved size profile found yet.");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      size: savedProfile.sizeValue,
      customSizeNotes: savedProfile.customSizeNotes,
      bust: savedProfile.bust,
      waist: savedProfile.waist,
      hip: savedProfile.hip || "",
      shoulder: savedProfile.shoulder || "",
      sleeveLength: savedProfile.sleeveLength || "",
      kurtiLength: savedProfile.kurtiLength || "",
      pantLength: savedProfile.pantLength || "",
      length: savedProfile.length,
      extraMeasurement: savedProfile.extraMeasurement,
    }));
    setIsAutoSuggestedMeasurement(Boolean(getSuggestedMeasurementsForSize(savedProfile.sizeValue)));
    setSizeProfileFeedback("Saved size profile applied.");
  };

  const handleClearSavedSizeProfile = () => {
    clearTailoringSizeProfile();
    setHasSavedSizeProfile(false);
    setIsAutoSuggestedMeasurement(false);
    setSizeProfileFeedback("Saved size profile cleared.");
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h4" mb={1}>
          Tailoring Order Form
        </Typography>
        <Typography color="text.secondary" mb={3}>
          Fill details step by step, and we will contact you soon.
        </Typography>

        <TailoringStepper steps={stepLabels} activeStep={activeStep} />

        <Stack spacing={3}>
            {activeStep === 0 ? (
              <FormControl>
                <FormLabel>1. Select category</FormLabel>
                <RadioGroup
                  value={formData.category}
                  onChange={(event) => updateField("category", event.target.value)}
                >
                  <FormControlLabel value="salwar-suit" control={<Radio />} label="Salwar Suit" />
                  <FormControlLabel value="blouse" control={<Radio />} label="Blouse" />
                  <FormControlLabel value="kurti" control={<Radio />} label="Kurti" />
                </RadioGroup>
              </FormControl>
            ) : null}

            {activeStep === 1 ? (
              <TextField
                select
                fullWidth
                label="2. Select design"
                value={formData.design}
                onChange={(event) => updateField("design", event.target.value)}
              >
                <MenuItem value="simple">Simple</MenuItem>
                <MenuItem value="party">Party Wear</MenuItem>
                <MenuItem value="bridal">Bridal/Festive</MenuItem>
              </TextField>
            ) : null}

            {activeStep === 2 ? (
              <Box>
                <Typography mb={2}>3. Enter measurements (in inches)</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} mb={2}>
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
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {sizeProfileFeedback}
                  </Alert>
                ) : null}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      fullWidth
                      label="Select Size (Optional)"
                      helperText="Select a standard size if you are unsure about exact measurements"
                      value={formData.size}
                      onChange={(event) => {
                        const nextSize = event.target.value;
                        const suggested = getSuggestedMeasurementsForSize(nextSize);
                        const isCustom = nextSize === CUSTOM_SIZE_VALUE;

                        setFormData((prev) => ({
                          ...prev,
                          size: nextSize,
                          customSizeNotes: isCustom ? prev.customSizeNotes : "",
                          bust: isCustom
                            ? ""
                            : (suggested?.chest ?? prev.bust),
                          waist: isCustom
                            ? ""
                            : (suggested?.waist ?? prev.waist),
                          length: isCustom
                            ? ""
                            : (suggested?.length ?? prev.length),
                        }));

                        setIsAutoSuggestedMeasurement(Boolean(suggested) && !isCustom);
                      }}
                    >
                      <MenuItem value="">No size selected</MenuItem>
                      {sizeOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  {getSuggestedMeasurementsForSize(formData.size) ? (
                    <Grid size={{ xs: 12 }}>
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
                    </Grid>
                  ) : null}
                  {formData.size === CUSTOM_SIZE_VALUE ? (
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={2}
                        label="Enter your measurements or size details"
                        placeholder="Chest 40, Waist 34, Length 38"
                        helperText={`Add details for custom size | ${Math.max(0, customSizeCharactersLeft)} characters left`}
                        value={formData.customSizeNotes}
                        inputProps={{ maxLength: CUSTOM_SIZE_NOTES_MAX_LENGTH }}
                        onChange={(event) => updateField("customSizeNotes", event.target.value)}
                      />
                    </Grid>
                  ) : null}
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Bust"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.bust}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("bust", event.target.value);
                      }}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Waist"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.waist}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("waist", event.target.value);
                      }}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Hip"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.hip}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("hip", event.target.value);
                      }}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Shoulder"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.shoulder}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("shoulder", event.target.value);
                      }}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Sleeve Length"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.sleeveLength}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("sleeveLength", event.target.value);
                      }}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Kurti Length"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.kurtiLength}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("kurtiLength", event.target.value);
                      }}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Salwar/Pant Length"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.pantLength}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("pantLength", event.target.value);
                      }}
                      required
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      label="Length"
                      fullWidth
                      type="number"
                      inputProps={{ min: 1, step: "0.1" }}
                      value={formData.length}
                      onChange={(event) => {
                        setIsAutoSuggestedMeasurement(false);
                        updateField("length", event.target.value);
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Extra measurement (optional)"
                      fullWidth
                      multiline
                      minRows={2}
                      placeholder="Add any extra measurements here"
                      value={formData.extraMeasurement}
                      onChange={(event) => updateField("extraMeasurement", event.target.value)}
                    />
                  </Grid>
                </Grid>
              </Box>
            ) : null}

            {activeStep === 3 ? (
              <Stack spacing={2.5}>
                <FormControl>
                  <FormLabel>4. Fabric source</FormLabel>
                  <RadioGroup
                    value={formData.fabricSource}
                    onChange={(event) => updateFabricSource(event.target.value as FabricSource)}
                  >
                    <Grid container spacing={1.5} sx={{ mt: 1 }}>
                      {fabricSourceOptions.map((option) => {
                        const selected = formData.fabricSource === option.value;

                        return (
                          <Grid key={option.value} size={{ xs: 12, md: 4 }}>
                            <Card
                              variant="outlined"
                              sx={{
                                height: "100%",
                                borderColor: selected ? "primary.main" : "divider",
                                boxShadow: selected ? (theme) => `0 0 0 1px ${theme.palette.primary.main}` : "none",
                              }}
                            >
                              <Box sx={{ p: 2 }}>
                                <FormControlLabel
                                  value={option.value}
                                  control={<Radio />}
                                  label={
                                    <Stack spacing={0.5}>
                                      <Typography fontWeight={700}>{option.title}</Typography>
                                      <Typography variant="body2" color="text.secondary">
                                        {option.description}
                                      </Typography>
                                    </Stack>
                                  }
                                  sx={{ alignItems: "flex-start", m: 0, width: "100%" }}
                                />
                              </Box>
                            </Card>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </RadioGroup>
                </FormControl>

                <FormControl>
                  <FormLabel>Pickup/Drop Service</FormLabel>
                  <RadioGroup
                    value={formData.pickupDropOption}
                    onChange={(event) => setFormData((prev) => ({ ...prev, pickupDropOption: event.target.value as PickupDropOption }))}
                  >
                    <FormControlLabel value="self_visit" control={<Radio />} label="No Pickup (Self Visit)" />
                    <FormControlLabel value="pickup_only" control={<Radio />} label={`Pickup Only (+INR ${DEFAULT_PICKUP_CHARGE})`} />
                    <FormControlLabel value="drop_only" control={<Radio />} label={`Drop Only (+INR ${DEFAULT_DROP_CHARGE})`} />
                    <FormControlLabel value="pickup_drop" control={<Radio />} label={`Pickup & Drop (+INR ${DEFAULT_PICKUP_CHARGE + DEFAULT_DROP_CHARGE})`} />
                  </RadioGroup>
                </FormControl>

                {formData.fabricSource === "own" ? (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        select
                        fullWidth
                        label="Fabric type"
                        value={formData.fabricType}
                        onChange={(event) => updateField("fabricType", event.target.value)}
                      >
                        {tailoringFabricOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                      </TextField>
                      {selectedFabricOption ? (
                        <Typography variant="caption" color="text.secondary">
                          {selectedFabricOption.description}
                        </Typography>
                      ) : null}
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        label="Fabric color"
                        value={formData.fabricColor}
                        onChange={(event) => updateField("fabricColor", event.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Fabric notes"
                        value={formData.fabricNotes}
                        onChange={(event) => updateField("fabricNotes", event.target.value)}
                      />
                    </Grid>
                  </Grid>
                ) : null}

                {formData.fabricSource === "external" ? (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Fabric name"
                        value={formData.fabricName}
                        onChange={(event) => updateField("fabricName", event.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        select
                        fullWidth
                        label="Fabric type"
                        value={formData.fabricType}
                        onChange={(event) => updateField("fabricType", event.target.value)}
                      >
                        {tailoringFabricOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        type="url"
                        label="Fabric link (optional)"
                        value={formData.fabricLink}
                        onChange={(event) => updateField("fabricLink", event.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Notes"
                        value={formData.fabricNotes}
                        onChange={(event) => updateField("fabricNotes", event.target.value)}
                      />
                    </Grid>
                  </Grid>
                ) : null}

                {formData.fabricSource === "rkstudio" ? (
                  <Stack spacing={2}>
                    {productsError ? <Alert severity="warning">{productsError}</Alert> : null}
                    {productsLoading ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography color="text.secondary">Loading RK Studio fabric options...</Typography>
                      </Stack>
                    ) : null}
                    {!productsLoading && products.length > 0 ? (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          Choose fabric from the cards below.
                        </Typography>
                        {selectedFabricProduct ? (
                          <Card
                            variant="outlined"
                            sx={{
                              position: "sticky",
                              top: { xs: 72, md: 88 },
                              zIndex: 2,
                              borderColor: "primary.main",
                              boxShadow: (theme) => `0 10px 30px ${theme.palette.primary.main}22`,
                              background: (theme) =>
                                `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.primary.light}12 100%)`,
                            }}
                          >
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ p: 2 }} alignItems={{ xs: "flex-start", sm: "center" }}>
                              <Box
                                component="img"
                                src={selectedFabricProduct.image}
                                alt={selectedFabricProduct.name}
                                sx={{ width: { xs: "100%", sm: 96 }, height: { xs: 180, sm: 96 }, objectFit: "cover", borderRadius: 2 }}
                              />
                              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
                                    SELECTED FABRIC
                                  </Typography>
                                  {isDashboardPrefilledSelection ? (
                                    <Chip size="small" color="secondary" label="Selected from dashboard" />
                                  ) : null}
                                  {hasChangedFromPrefilledSelection ? (
                                    <Chip size="small" variant="outlined" color="warning" label="Selection changed" />
                                  ) : null}
                                </Stack>
                                {isDashboardPrefilledSelection ? (
                                  <Typography variant="caption" color="text.secondary">
                                    This fabric came from dashboard selection. You can change it.
                                  </Typography>
                                ) : null}
                                {hasChangedFromPrefilledSelection ? (
                                  <Typography variant="caption" color="text.secondary">
                                    Your new fabric selection will be used for this order.
                                  </Typography>
                                ) : null}
                                <Typography variant="h6">{selectedFabricProduct.name}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {selectedFabricProduct.type} | {selectedFabricProduct.tag}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  INR {selectedFabricProduct.price}
                                  {selectedFabricProduct.discountPercent ? ` | ${selectedFabricProduct.discountPercent}% off` : ""}
                                  {selectedFabricProduct.rating ? ` | ${selectedFabricProduct.rating.toFixed(1)} rating` : ""}
                                </Typography>
                              </Stack>
                              <Button variant="outlined" color="inherit" onClick={() => updateField("rkStudioProductId", "") }>
                                Remove selection
                              </Button>
                            </Stack>
                          </Card>
                        ) : (
                          <Alert severity="info">No fabric selected yet. Choose one card below.</Alert>
                        )}
                        {compareProducts.length > 0 ? (
                          <Card variant="outlined" sx={{ borderColor: "divider" }}>
                            <Stack spacing={1.5} sx={{ p: 2 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle1" fontWeight={700}>
                                  Fabric Compare
                                </Typography>
                                <Button size="small" color="inherit" onClick={() => setCompareProductIds([])}>
                                  Clear compare
                                </Button>
                              </Stack>
                              <Grid container spacing={2}>
                                {compareProducts.map((product) => (
                                  <Grid key={`compare-${product.id}`} size={{ xs: 12, md: 6 }}>
                                    <Card variant="outlined" sx={{ height: "100%" }}>
                                      <Box
                                        component="img"
                                        src={product.image}
                                        alt={product.name}
                                        sx={{ width: "100%", height: 180, objectFit: "cover" }}
                                      />
                                      <Stack spacing={0.8} sx={{ p: 2 }}>
                                        <Typography variant="subtitle1" fontWeight={700}>{product.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {product.type} | {product.tag}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          INR {product.price}
                                          {product.discountPercent ? ` | ${product.discountPercent}% off` : ""}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          Rating: {product.rating?.toFixed(1) || "-"}
                                        </Typography>
                                        <Stack direction="row" spacing={1}>
                                          <Button variant="contained" size="small" onClick={() => updateField("rkStudioProductId", product.id)}>
                                            Select
                                          </Button>
                                          <Button variant="outlined" size="small" onClick={() => toggleCompareProduct(product.id)}>
                                            Remove
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    </Card>
                                  </Grid>
                                ))}
                                {compareProducts.length === 1 ? (
                                  <Grid size={{ xs: 12, md: 6 }}>
                                    <Card
                                      variant="outlined"
                                      sx={{
                                        height: "100%",
                                        minHeight: 180,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderStyle: "dashed",
                                      }}
                                    >
                                      <Typography color="text.secondary" textAlign="center" sx={{ px: 2 }}>
                                        Add one more fabric to compare side by side.
                                      </Typography>
                                    </Card>
                                  </Grid>
                                ) : null}
                              </Grid>
                            </Stack>
                          </Card>
                        ) : null}
                        {savedProducts.length > 0 ? (
                          <Card variant="outlined" sx={{ borderColor: "divider" }}>
                            <Stack spacing={1.5} sx={{ p: 2 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle1" fontWeight={700}>
                                  Saved for later
                                </Typography>
                                <Button size="small" color="inherit" onClick={() => setSavedProductIds([])}>
                                  Clear saved
                                </Button>
                              </Stack>
                              <Grid container spacing={2}>
                                {savedProducts.map((product) => (
                                  <Grid key={`saved-${product.id}`} size={{ xs: 12, sm: 6, lg: 4 }}>
                                    <Card variant="outlined" sx={{ height: "100%" }}>
                                      <Box
                                        component="img"
                                        src={product.image}
                                        alt={product.name}
                                        sx={{ width: "100%", height: 140, objectFit: "cover" }}
                                      />
                                      <Stack spacing={0.8} sx={{ p: 1.5 }}>
                                        <Typography fontWeight={700}>{product.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                          {product.type} | INR {product.price}
                                        </Typography>
                                        <Stack direction="row" spacing={1}>
                                          <Button variant="contained" size="small" onClick={() => updateField("rkStudioProductId", product.id)}>
                                            Select
                                          </Button>
                                          <Button variant="outlined" size="small" onClick={() => toggleSavedProduct(product.id)}>
                                            Remove
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    </Card>
                                  </Grid>
                                ))}
                              </Grid>
                            </Stack>
                          </Card>
                        ) : null}
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                              fullWidth
                              label="Fabric search"
                              placeholder="Search by name, type, or tag"
                              value={pickerFilters.query}
                              onChange={(event) => setPickerFilters((prev) => ({ ...prev, query: event.target.value }))}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                            <TextField
                              select
                              fullWidth
                              label="Type"
                              value={pickerFilters.type}
                              onChange={(event) => setPickerFilters((prev) => ({ ...prev, type: event.target.value }))}
                            >
                              <MenuItem value="all">All types</MenuItem>
                              {availableFabricTypes.map((type) => (
                                <MenuItem key={type} value={type}>
                                  {type}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                            <TextField
                              select
                              fullWidth
                              label="Max rate"
                              value={pickerFilters.maxPrice}
                              onChange={(event) => setPickerFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
                            >
                              <MenuItem value="1000">Up to INR 1000</MenuItem>
                              <MenuItem value="1500">Up to INR 1500</MenuItem>
                              <MenuItem value="2500">Up to INR 2500</MenuItem>
                              <MenuItem value="5000">Up to INR 5000</MenuItem>
                            </TextField>
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <TextField
                              select
                              fullWidth
                              label="Sort"
                              value={pickerFilters.sortBy}
                              onChange={(event) => setPickerFilters((prev) => ({ ...prev, sortBy: event.target.value }))}
                            >
                              <MenuItem value="featured">Best</MenuItem>
                              <MenuItem value="price-low">Price: low to high</MenuItem>
                              <MenuItem value="price-high">Price: high to low</MenuItem>
                              <MenuItem value="discount-first">Highest discount first</MenuItem>
                              <MenuItem value="rating-high">Top rating</MenuItem>
                            </TextField>
                          </Grid>
                        </Grid>
                        <Typography variant="caption" color="text.secondary">
                          {filteredFabricProducts.length} fabric options found.
                        </Typography>
                        <Grid container spacing={2}>
                          {filteredFabricProducts.map((product) => {
                            const isSelected = formData.rkStudioProductId === product.id;
                            const isCompared = compareProductIds.includes(product.id);
                            const isSaved = savedProductIds.includes(product.id);
                            const isHighlighted = highlightedProductId === product.id;

                            return (
                              <Grid key={product.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                                <Card
                                  id={`rkstudio-fabric-card-${product.id}`}
                                  variant="outlined"
                                  onClick={() => updateField("rkStudioProductId", product.id)}
                                  sx={{
                                    height: "100%",
                                    cursor: "pointer",
                                    overflow: "hidden",
                                    borderColor: isSelected ? "primary.main" : "divider",
                                    boxShadow: isHighlighted
                                      ? (theme) => `0 0 0 2px ${theme.palette.primary.main}, 0 0 0 10px ${theme.palette.primary.main}22`
                                      : isSelected
                                        ? (theme) => `0 0 0 1px ${theme.palette.primary.main}`
                                        : "none",
                                    transition: "transform 180ms ease, box-shadow 240ms ease, border-color 180ms ease",
                                    animation: isHighlighted ? "rkStudioSelectedPulse 1.2s ease-out 1" : "none",
                                    '&:hover': {
                                      transform: "translateY(-4px)",
                                      boxShadow: 4,
                                    },
                                    '@keyframes rkStudioSelectedPulse': {
                                      '0%': {
                                        boxShadow: '0 0 0 0 rgba(14, 165, 233, 0.45)',
                                      },
                                      '50%': {
                                        boxShadow: '0 0 0 10px rgba(14, 165, 233, 0.18)',
                                      },
                                      '100%': {
                                        boxShadow: '0 0 0 2px rgba(14, 165, 233, 0)',
                                      },
                                    },
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={product.image}
                                    alt={product.name}
                                    sx={{ width: "100%", height: 180, objectFit: "cover" }}
                                  />
                                  <Stack spacing={1} sx={{ p: 2 }}>
                                    <Typography fontWeight={700}>{product.name}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      {product.type} | {product.tag}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      INR {product.price}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        variant={isSelected ? "contained" : "outlined"}
                                        size="small"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          updateField("rkStudioProductId", product.id);
                                        }}
                                      >
                                        {isSelected ? "Selected" : "Select fabric"}
                                      </Button>
                                      <Button
                                        variant={isCompared ? "contained" : "text"}
                                        color="secondary"
                                        size="small"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleCompareProduct(product.id);
                                        }}
                                      >
                                        {isCompared ? "Compared" : "Compare"}
                                      </Button>
                                      <Button
                                        variant={isSaved ? "contained" : "text"}
                                        size="small"
                                        color="warning"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          toggleSavedProduct(product.id);
                                        }}
                                      >
                                        {isSaved ? "Saved" : "Save"}
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Card>
                              </Grid>
                            );
                          })}
                        </Grid>
                        {filteredFabricProducts.length === 0 ? (
                          <Alert severity="info">
                            No fabric found for this search or filter. Try another type or price range.
                          </Alert>
                        ) : null}
                      </>
                    ) : null}
                    {!productsLoading && products.length === 0 ? (
                      <Alert severity="info">RK Studio fabric is not available right now.</Alert>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            ) : null}

            {activeStep === 4 ? (
              <Stack spacing={2}>
                <Typography>5. Summary</Typography>
                <Alert severity="info">
                  <Stack spacing={0.7}>
                    <Typography variant="body2">Category: {formData.category || "-"}</Typography>
                    <Typography variant="body2">Design: {formData.design || "-"}</Typography>
                    <Typography variant="body2">
                      {formData.size
                        ? formData.size === CUSTOM_SIZE_VALUE
                          ? `Custom Size: ${normalizeSpace(formData.customSizeNotes) || "-"}`
                          : `Size: ${formData.size}`
                        : "Size: -"}
                    </Typography>
                    <Typography variant="body2">
                      Pickup/Drop: {formData.pickupDropOption === "pickup_only"
                        ? `Pickup Only (+INR ${DEFAULT_PICKUP_CHARGE})`
                        : formData.pickupDropOption === "drop_only"
                          ? `Drop Only (+INR ${DEFAULT_DROP_CHARGE})`
                          : formData.pickupDropOption === "pickup_drop"
                            ? `Pickup & Drop (+INR ${DEFAULT_PICKUP_CHARGE + DEFAULT_DROP_CHARGE})`
                            : "No Pickup (Self Visit)"}
                    </Typography>
                    <Typography variant="body2">
                      Measurements: Bust {formData.bust || "-"}, Waist {formData.waist || "-"}, Length {formData.length || "-"}
                    </Typography>
                    <Typography variant="body2">Extra Measurement: {formData.extraMeasurement || "-"}</Typography>
                    {fabricSummaryLines.map((line) => (
                      <Typography key={line} variant="body2">
                        {line}
                      </Typography>
                    ))}
                  </Stack>
                </Alert>
                <TextField
                  label="Your name"
                  value={formData.customerName}
                  onChange={(event) => updateField("customerName", event.target.value)}
                />
                <TextField
                  label="Phone number"
                  value={formData.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
                <Typography variant="caption" color="text.secondary">
                  Need help? Contact us on WhatsApp.
                </Typography>
              </Stack>
            ) : null}

            <Stack direction="row" justifyContent="space-between">
              <Button variant="outlined" onClick={handleBack} disabled={activeStep === 0}>
                Back
              </Button>
              <Button variant="contained" onClick={handleNext} disabled={submitting}>
                {isLast ? "Proceed to payment" : "Next"}
              </Button>
            </Stack>
          </Stack>
      </CardContent>
    </Card>
  );
}
