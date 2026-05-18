"use client";

import {
  Alert,
  alpha,
  CircularProgress,
  Box,
  Button,
  Card,
  Chip,
  CardContent,
  InputLabel,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import Grid from "@mui/material/Grid2";
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import RKStudioLogo from "@/components/common/RKStudioLogo";
import Layout from "@/components/layout/Layout";
import { useGlobalLoading } from "@/context/LoadingContext";
import {
  analyzeProductImageWithAI,
  analyzeProductImageWithVisionAPI,
  AiDetectedProduct,
} from "@/utils/aiProductDetection";
import { getFirebaseDb } from "@/services/firebase";
import {
  addProduct,
  CatalogProduct,
  ProductCategory,
  removeProduct,
  uploadProductImage,
  updateProduct,
} from "@/services/productService";

type FormState = {
  name: string;
  price: string;
  marketPrice: string;
  pricingType: "meter" | "piece";
  pricePerUnit: string;
  discountPercentage: string;
  advancePercentage: string;
  productType: "fabric" | "piece";
  type: string;
  category: ProductCategory;
  image: string;
  tag: string;
  description: string;
  discountPercent: string;
  rating: string;
};

const initialForm: FormState = {
  name: "",
  price: "",
  marketPrice: "",
  pricingType: "meter",
  pricePerUnit: "",
  discountPercentage: "5",
  advancePercentage: "20",
  productType: "fabric",
  type: "",
  category: "fabric",
  image: "",
  tag: "daily wear",
  description: "",
  discountPercent: "0",
  rating: "4.5",
};

const MAX_UPLOAD_MB = 8;
const TARGET_MAX_SIDE = 1400;
const TARGET_QUALITY = 0.8;

const compressImageFile = async (file: File): Promise<File> => {
  if (file.size <= 350 * 1024) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unable to read image."));
      element.src = imageUrl;
    });

    const ratio = Math.min(1, TARGET_MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return file;
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", TARGET_QUALITY);
    });

    if (!blob) {
      return file;
    }

    const compressedName = file.name.replace(/\.[^.]+$/, "") + "-compressed.jpg";
    return new File([blob], compressedName, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export default function AdminProductsManagement() {
  const { trackAsync } = useGlobalLoading();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [draggingImage, setDraggingImage] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState("");
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiDetectedProduct | null>(null);
  const [aiSuggestedFields, setAiSuggestedFields] = useState<Record<string, boolean>>({});
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [aiEngine, setAiEngine] = useState<"vision" | "fallback" | "none">("none");

  useEffect(() => {
    const fetchAdminProducts = async () => {
      try {
        const db = getFirebaseDb();
        
        if (!db) {
          setProducts([]);
          setProductsError("Could not fetch products.");
          setLoading(false);
          return;
        }

        const snapshot = await getDocs(collection(db, "products"));

        const products = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CatalogProduct[];

        console.log("ADMIN PRODUCTS COUNT:", products.length);

        setProducts([...products]); // force re-render
        setProductsError("");
        setLoading(false);
      } catch (err) {
        console.error("ADMIN FETCH ERROR:", err);
        setProducts([]);
        setProductsError("Could not fetch products.");
        setLoading(false);
      }
    };

    void fetchAdminProducts();
  }, []);

  const submitLabel = useMemo(() => (editingId ? "Update Product" : "Add Product"), [editingId]);

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setAiSuggestedFields((prev) => {
      if (!prev[field]) {
        return prev;
      }

      return {
        ...prev,
        [field]: false,
      };
    });
  };

  const resetForm = () => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setForm(initialForm);
    setEditingId("");
    setImagePreview("");
    setCompressionInfo("");
    setAiSuggestion(null);
    setAiSuggestedFields({});
    setLastUploadedFile(null);
    setAiEngine("none");
  };

  const clearSelectedImage = () => {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setField("image", "");
    setImagePreview("");
    setCompressionInfo("");
    setAiSuggestion(null);
    setAiSuggestedFields({});
    setLastUploadedFile(null);
    setAiEngine("none");
  };

  const applyAiSuggestion = (suggestion: AiDetectedProduct) => {
    setForm((prev) => ({
      ...prev,
      name: suggestion.name,
      productType: suggestion.productType,
      pricingType: suggestion.productType === "fabric" ? "meter" : "piece",
      category: suggestion.category,
      type: suggestion.type,
      description: suggestion.description,
      price: String(suggestion.suggestedPrice),
      marketPrice: String(suggestion.suggestedPrice),
      pricePerUnit: String(suggestion.suggestedPrice),
    }));

    setAiSuggestion(suggestion);
    setAiSuggestedFields({
      name: true,
      productType: true,
      category: true,
      type: true,
      description: true,
      price: true,
      marketPrice: true,
      pricingType: true,
      pricePerUnit: true,
    });
  };

  const runAiDetection = async (file?: File) => {
    try {
      setAnalyzingImage(true);
      let suggestion: AiDetectedProduct;

      if (file) {
        try {
          suggestion = await analyzeProductImageWithVisionAPI(file);
          setAiEngine("vision");
        } catch {
          suggestion = await analyzeProductImageWithAI({
            file,
            fallbackText: `${form.name} ${form.type} ${form.tag}`,
          });
          setAiEngine("fallback");
          setNotice("Vision API unavailable. Applied local AI suggestion.");
        }
      } else {
        suggestion = await analyzeProductImageWithAI({
          file,
          fallbackText: `${form.name} ${form.type} ${form.tag}`,
        });
        setAiEngine("fallback");
      }

      applyAiSuggestion(suggestion);
      setNotice("AI analysis complete. Fields were pre-filled.");
    } catch {
      setError("AI image analysis could not complete. Please try again.");
    } finally {
      setAnalyzingImage(false);
    }
  };

  const validate = () => {
    if (!form.name.trim() || !form.price || !form.type.trim() || !form.image.trim() || !form.tag.trim()) {
      return "Please fill all required fields.";
    }

    if (Number.isNaN(Number(form.price)) || Number(form.price) <= 0) {
      return "Enter a valid positive price.";
    }

    if (Number.isNaN(Number(form.discountPercent)) || Number(form.discountPercent) < 0 || Number(form.discountPercent) > 90) {
      return "Enter discount between 0 and 90.";
    }

    if (Number.isNaN(Number(form.marketPrice)) || Number(form.marketPrice) <= 0) {
      return "Enter a valid market price.";
    }

    if (Number.isNaN(Number(form.pricePerUnit)) || Number(form.pricePerUnit) <= 0) {
      return "Enter a valid price per unit.";
    }

    if (Number.isNaN(Number(form.discountPercentage)) || Number(form.discountPercentage) < 0 || Number(form.discountPercentage) > 90) {
      return "Enter auto discount between 0 and 90.";
    }

    if (Number.isNaN(Number(form.advancePercentage)) || Number(form.advancePercentage) < 0 || Number(form.advancePercentage) > 100) {
      return "Advance percentage 0 se 100 ke beech dalein.";
    }

    if (Number.isNaN(Number(form.rating)) || Number(form.rating) < 0 || Number(form.rating) > 5) {
      return "Rating 0 se 5 ke beech dalein.";
    }

    return "";
  };

  const handleSubmit = async () => {
    setError("");
    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        price: Number(form.price),
        marketPrice: Number(form.marketPrice),
        pricingType: form.pricingType,
        pricePerUnit: Number(form.pricePerUnit),
        discountPercentage: Number(form.discountPercentage),
        advancePercentage: Number(form.advancePercentage),
        productType: form.productType,
        type: form.type.trim().toLowerCase(),
        category: form.category,
        image: form.image.trim(),
        tag: form.tag.trim(),
        description: form.description.trim(),
        discountPercent: Number(form.discountPercent),
        rating: Number(form.rating),
      };

      if (editingId) {
        await trackAsync(updateProduct(editingId, payload));
        setNotice("Product updated.");
      } else {
        await trackAsync(addProduct(payload));
        setNotice("Product added.");
      }

      resetForm();
    } catch {
      setError("Product was not saved. Please check Firebase setup.");
    } finally {
      setSaving(false);
    }
  };

  const processSelectedImage = async (file: File) => {
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Upload an image smaller than ${MAX_UPLOAD_MB}MB.`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    setError("");
    setUploadingImage(true);

    try {
      const compressed = await compressImageFile(file);

      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }

      setImagePreview(URL.createObjectURL(compressed));
      setLastUploadedFile(compressed);

      await runAiDetection(compressed);

      if (compressed.size < file.size) {
        const fromKb = Math.round(file.size / 1024);
        const toKb = Math.round(compressed.size / 1024);
        setCompressionInfo(`Image was compressed from ${fromKb}KB to ${toKb}KB before upload.`);
      } else {
        setCompressionInfo("Image was kept at original quality.");
      }

      const uploadedUrl = await trackAsync(uploadProductImage(compressed));
      setField("image", uploadedUrl);
      setNotice("Image uploaded.");
    } catch {
      setError("Image upload failed. Please check Firebase Storage setup.");
      setImagePreview("");
      setCompressionInfo("");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await processSelectedImage(file);
    event.target.value = "";
  };

  const handleImageDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDraggingImage(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    await processSelectedImage(file);
  };

  const handleEdit = (product: CatalogProduct) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      price: String(product.price),
      productType: product.productType,
      marketPrice: String(product.marketPrice || product.price),
      pricingType: product.pricingType || (product.productType === "fabric" ? "meter" : "piece"),
      pricePerUnit: String(product.pricePerUnit || product.price),
      discountPercentage: String(product.discountPercentage ?? 5),
      advancePercentage: String(product.advancePercentage ?? 20),
      type: product.type,
      category: product.category,
      image: product.image,
      tag: product.tag,
      description: product.description || "",
      discountPercent: String(product.discountPercent || 0),
      rating: String(product.rating || 4.5),
    });

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    setImagePreview(product.image);
    setCompressionInfo("");
    setAiSuggestion(null);
    setAiSuggestedFields({});
    setLastUploadedFile(null);
    setAiEngine("none");
  };

  const handleDelete = async (id: string) => {
    setError("");

    try {
      await trackAsync(removeProduct(id));
      setNotice("Product deleted.");
      if (editingId === id) {
        resetForm();
      }
    } catch {
      setError("Could not delete product.");
    }
  };

  return (
    <Layout>
      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Stack spacing={1.2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
                <RKStudioLogo size={34} variant="full" />
                <Stack spacing={0.35}>
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography variant="h4">Product Management</Typography>
                    <Box
                      sx={{
                        px: 1.2,
                        py: 0.5,
                        borderRadius: 999,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        color: "primary.main",
                        bgcolor: alpha("#DBEAFE", 0.95),
                        border: `1px solid ${alpha("#93C5FD", 0.48)}`,
                      }}
                    >
                      Catalog Kendra
                    </Box>
                  </Stack>
                  <Typography color="text.secondary">Manage fabric and dupatta products from here.</Typography>
                </Stack>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Upload images here. Images are compressed and saved to Firebase Storage.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {productsError ? <Alert severity="warning">{productsError}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {notice ? <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert> : null}

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Add Product</Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Chip
                  icon={<PsychologyOutlinedIcon />}
                  label={analyzingImage ? "Analyzing image..." : "AI Assist enabled"}
                  color={analyzingImage ? "warning" : "primary"}
                  variant={analyzingImage ? "filled" : "outlined"}
                />
                {aiSuggestion ? (
                  <Chip
                    icon={<AutoAwesomeOutlinedIcon />}
                    label={`AI Confidence: ${aiSuggestion.confidence}%`}
                    color="success"
                    variant="outlined"
                  />
                ) : null}
                {aiEngine !== "none" ? (
                  <Chip
                    label={aiEngine === "vision" ? "Engine: Vision API" : "Engine: Local Fallback"}
                    color={aiEngine === "vision" ? "info" : "warning"}
                    variant="outlined"
                  />
                ) : null}
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesomeOutlinedIcon />}
                  disabled={analyzingImage || uploadingImage || !lastUploadedFile}
                  onClick={() => runAiDetection(lastUploadedFile || undefined)}
                >
                  Regenerate with AI
                </Button>
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Naam"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  helperText={aiSuggestedFields.name ? "AI Suggested" : ""}
                  fullWidth
                />
                <TextField
                  label={form.productType === "fabric" ? "Price per meter (INR)" : "Price per piece (INR)"}
                  type="number"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  helperText={aiSuggestedFields.price ? "AI Suggested" : ""}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  label="Market Price (INR)"
                  type="number"
                  value={form.marketPrice}
                  onChange={(e) => setField("marketPrice", e.target.value)}
                  helperText={aiSuggestedFields.marketPrice ? "AI Suggested" : ""}
                  fullWidth
                />
                <TextField
                  select
                  label="Pricing Type"
                  value={form.pricingType}
                  onChange={(e) => setField("pricingType", e.target.value)}
                  helperText={aiSuggestedFields.pricingType ? "AI Suggested" : ""}
                  fullWidth
                >
                  <MenuItem value="meter">Meter</MenuItem>
                  <MenuItem value="piece">Piece</MenuItem>
                </TextField>
                <TextField
                  label={form.pricingType === "meter" ? "Price Per Meter" : "Price Per Piece"}
                  type="number"
                  value={form.pricePerUnit}
                  onChange={(e) => setField("pricePerUnit", e.target.value)}
                  helperText={aiSuggestedFields.pricePerUnit ? "AI Suggested" : ""}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField label="Discount %" type="number" value={form.discountPercent} onChange={(e) => setField("discountPercent", e.target.value)} fullWidth />
                <TextField label="Rating (0-5)" type="number" inputProps={{ min: 0, max: 5, step: 0.1 }} value={form.rating} onChange={(e) => setField("rating", e.target.value)} fullWidth />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField label="Auto Discount %" type="number" value={form.discountPercentage} onChange={(e) => setField("discountPercentage", e.target.value)} fullWidth />
                <TextField label="Advance %" type="number" value={form.advancePercentage} onChange={(e) => setField("advancePercentage", e.target.value)} fullWidth />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  select
                  label="Product Type"
                  value={form.productType}
                  onChange={(e) => setField("productType", e.target.value)}
                  helperText={aiSuggestedFields.productType ? "AI Suggested" : ""}
                  fullWidth
                >
                  <MenuItem value="fabric">Fabric (meter based)</MenuItem>
                  <MenuItem value="piece">Piece (ready-made suit)</MenuItem>
                </TextField>
                <TextField
                  label="Type"
                  value={form.type}
                  onChange={(e) => setField("type", e.target.value)}
                  helperText={aiSuggestedFields.type ? "AI Suggested" : ""}
                  fullWidth
                />
                <TextField select label="Category" value={form.category} onChange={(e) => setField("category", e.target.value)} helperText={aiSuggestedFields.category ? "AI Suggested" : ""} fullWidth>
                  <MenuItem value="fabric">Fabric</MenuItem>
                  <MenuItem value="dupatta">Dupatta</MenuItem>
                </TextField>
              </Stack>

              <TextField
                label="Description"
                multiline
                minRows={2}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                helperText={aiSuggestedFields.description ? "AI Suggested" : ""}
                fullWidth
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {form.productType === "fabric"
                    ? "Auto UI: Price per meter and meter selection enabled"
                    : "Auto UI: Price per piece and quantity selector enabled"}
                </Typography>
                {aiSuggestion ? (
                  <Chip
                    label={aiSuggestion.recommendedUsage}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                ) : null}
              </Stack>

              {aiSuggestion?.matchingItems?.length ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {aiSuggestion.matchingItems.map((item) => (
                    <Chip key={item} label={item} size="small" variant="outlined" />
                  ))}
                </Stack>
              ) : null}

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField label="Tag" value={form.tag} onChange={(e) => setField("tag", e.target.value)} fullWidth />
                <Stack spacing={1.2} sx={{ width: "100%" }}>
                  <InputLabel sx={{ color: "text.secondary" }}>Product Image</InputLabel>
                  <Box
                    component="label"
                    onDrop={handleImageDrop}
                    onDragOver={(event: DragEvent<HTMLLabelElement>) => {
                      event.preventDefault();
                      setDraggingImage(true);
                    }}
                    onDragLeave={() => setDraggingImage(false)}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px dashed ${draggingImage ? "#1E3A8A" : "#CBD5E1"}`,
                      backgroundColor: draggingImage ? alpha("#1E3A8A", 0.08) : alpha("#FFFFFF", 0.8),
                      display: "flex",
                      alignItems: "center",
                      gap: 1.2,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <CloudUploadOutlinedIcon color={draggingImage ? "primary" : "action"} />
                    <Typography variant="body2" color="text.secondary">
                      {analyzingImage
                        ? "Analyzing image..."
                        : uploadingImage
                          ? "Uploading image..."
                          : "Drop image here or click to choose"}
                    </Typography>
                    <input hidden type="file" accept="image/*" onChange={handleImageFileChange} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Best results: use a clear product photo under 8MB.
                  </Typography>
                  {uploadingImage ? (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">Uploading to Firebase Storage...</Typography>
                    </Stack>
                  ) : null}
                  {analyzingImage ? (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">Analyzing image...</Typography>
                    </Stack>
                  ) : null}
                  {compressionInfo ? (
                    <Typography variant="caption" color="text.secondary">{compressionInfo}</Typography>
                  ) : null}
                  {form.image ? (
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                      URL: {form.image}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>

              {imagePreview ? (
                <Stack spacing={1.2} alignItems="flex-start">
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Product preview"
                    sx={{ width: 170, height: 170, objectFit: "cover", borderRadius: 2, border: "1px solid #E5E7EB" }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" component="label" size="small" disabled={uploadingImage}>
                      Image badlein
                      <input hidden type="file" accept="image/*" onChange={handleImageFileChange} />
                    </Button>
                    <Button variant="text" color="error" size="small" onClick={clearSelectedImage} disabled={uploadingImage}>
                      Remove image
                    </Button>
                  </Stack>
                </Stack>
              ) : null}

              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={handleSubmit} disabled={saving || uploadingImage}>
                  {saving ? "Saving..." : submitLabel}
                </Button>
                {editingId ? (
                  <Button variant="outlined" onClick={resetForm}>Close Edit</Button>
                ) : null}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PhotoLibraryOutlinedIcon color="primary" />
                <Typography variant="h5">Product Gallery</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Quickly preview products and open edit mode.
              </Typography>

              <Grid container spacing={2}>
                {products.map((product) => (
                  <Grid key={`gallery-${product.id}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card sx={{ height: "100%" }}>
                      <Box
                        component="img"
                        src={product.image}
                        alt={product.name}
                        sx={{ width: "100%", height: 180, objectFit: "cover" }}
                      />
                      <CardContent>
                        <Stack spacing={1.1}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {product.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {product.category} | {product.type}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Chhut: {product.discountPercent || 0}% | Rating: {(product.rating || 0).toFixed(1)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Market: INR {product.marketPrice} | Per unit: INR {product.pricePerUnit}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Auto discount: {product.discountPercentage}% | Advance: {product.advancePercentage}%
                          </Typography>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<EditOutlinedIcon />}
                            onClick={() => handleEdit(product)}
                          >
                            Edit this product
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}

                {!loading && products.length === 0 ? (
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info">No products in the gallery yet.</Alert>
                  </Grid>
                ) : null}
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h5">Product List</Typography>

              <Box sx={{ overflowX: "auto" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Market</TableCell>
                      <TableCell>Per Unit</TableCell>
                      <TableCell>Pricing Type</TableCell>
                      <TableCell>Auto Discount</TableCell>
                      <TableCell>Advance</TableCell>
                      <TableCell>Discount</TableCell>
                      <TableCell>Rating</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Label</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>INR {product.price}</TableCell>
                        <TableCell>INR {product.marketPrice}</TableCell>
                        <TableCell>INR {product.pricePerUnit}</TableCell>
                        <TableCell>{product.pricingType}</TableCell>
                        <TableCell>{product.discountPercentage}%</TableCell>
                        <TableCell>{product.advancePercentage}%</TableCell>
                        <TableCell>{product.discountPercent || 0}%</TableCell>
                        <TableCell>{(product.rating || 0).toFixed(1)}</TableCell>
                        <TableCell>{product.type}</TableCell>
                        <TableCell sx={{ textTransform: "capitalize" }}>{product.category}</TableCell>
                        <TableCell>{product.tag}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" onClick={() => handleEdit(product)}>Edit</Button>
                            <Button size="small" color="error" onClick={() => handleDelete(product.id)}>Delete</Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!loading && products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13}>No products found.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Layout>
  );
}
