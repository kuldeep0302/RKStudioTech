export type AiDetectedProduct = {
  name: string;
  productType: "fabric" | "piece";
  category: "fabric" | "dupatta";
  type: string;
  description: string;
  suggestedPrice: number;
  confidence: number;
  recommendedUsage: string;
  matchingItems: string[];
};

const normalizeDetectedProduct = (input: Partial<AiDetectedProduct>): AiDetectedProduct => {
  const productType = input.productType === "piece" ? "piece" : "fabric";

  return {
    name: (input.name || "AI Product").trim(),
    productType,
    category: input.category === "dupatta" || productType === "piece" ? "dupatta" : "fabric",
    type: (input.type || (productType === "fabric" ? "cotton" : "party")).trim().toLowerCase(),
    description: (input.description || "AI generated description").trim(),
    suggestedPrice:
      typeof input.suggestedPrice === "number" && Number.isFinite(input.suggestedPrice) && input.suggestedPrice > 0
        ? Math.round(input.suggestedPrice)
        : productType === "fabric"
          ? 280
          : 1400,
    confidence:
      typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? Math.max(1, Math.min(99, Math.round(input.confidence)))
        : 72,
    recommendedUsage:
      (input.recommendedUsage || (productType === "fabric" ? "Kurti ke liye 2.5 meter recommended" : "Ready to wear")).trim(),
    matchingItems: Array.isArray(input.matchingItems) && input.matchingItems.length > 0
      ? input.matchingItems.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
      : productType === "fabric"
        ? ["Matching Dupatta", "Cotton Lining", "Lace Border"]
        : ["Matching Dupatta", "Alteration Service", "Fall-Pico Finish"],
  };
};

type AnalyzeInput = {
  file?: File;
  fallbackText?: string;
};

const imageSizeFromFile = async (file: File) => {
  const blobUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Unable to read image dimensions."));
      element.src = blobUrl;
    });

    return { width: image.width, height: image.height };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

const hasAnyKeyword = (value: string, list: string[]) => list.some((keyword) => value.includes(keyword));

const buildFabricName = (type: string) => {
  if (type === "silk") {
    return "Premium Silk Fabric";
  }

  if (type === "cotton") {
    return "Floral Cotton Fabric";
  }

  if (type === "rayon") {
    return "Rayon Kurti Fabric";
  }

  if (type === "linen") {
    return "Soft Linen Fabric";
  }

  return "Designer Kurti Fabric";
};

const buildPieceName = (type: string) => {
  if (type === "party") {
    return "Designer Party Wear Suit";
  }

  if (type === "silk") {
    return "Silk Festive Suit Set";
  }

  if (type === "cotton") {
    return "Daily Wear Cotton Suit";
  }

  return "Ready-to-Wear Suit Set";
};

export const analyzeProductImageWithAI = async ({ file, fallbackText = "" }: AnalyzeInput): Promise<AiDetectedProduct> => {
  const seedText = `${file?.name || ""} ${fallbackText}`.toLowerCase();

  const dimensions = file ? await imageSizeFromFile(file) : { width: 0, height: 0 };
  const isLandscape = dimensions.width > dimensions.height;

  const fabricSignals = [
    "fabric",
    "cloth",
    "cotton",
    "linen",
    "rayon",
    "silk",
    "roll",
    "meter",
    "unstitched",
  ];

  const pieceSignals = [
    "suit",
    "stitched",
    "ready",
    "mannequin",
    "piece",
    "kurta",
    "dress",
    "set",
  ];

  const fabricScore = (hasAnyKeyword(seedText, fabricSignals) ? 2 : 0) + (isLandscape ? 1 : 0);
  const pieceScore = (hasAnyKeyword(seedText, pieceSignals) ? 2 : 0) + (!isLandscape ? 1 : 0);

  const productType: "fabric" | "piece" = fabricScore >= pieceScore ? "fabric" : "piece";
  const category = productType === "fabric" ? "fabric" : "dupatta";

  const looksCotton = hasAnyKeyword(seedText, ["cotton", "floral", "print"]);
  const looksSilk = hasAnyKeyword(seedText, ["silk", "festive", "party"]);
  const looksRayon = hasAnyKeyword(seedText, ["rayon", "flow", "soft"]);
  const looksLinen = hasAnyKeyword(seedText, ["linen", "comfort"]);

  const type = looksSilk
    ? "silk"
    : looksRayon
      ? "rayon"
      : looksLinen
        ? "linen"
        : looksCotton
          ? "cotton"
          : productType === "piece"
            ? "party"
            : "cotton";

  const name = productType === "fabric" ? buildFabricName(type) : buildPieceName(type);

  const description = productType === "fabric"
    ? `Soft ${type} fabric with premium look, perfect for kurtis and daily wear.`
    : `Ready-made ${type} suit set with stylish finish, ideal for outings and festive use.`;

  const suggestedPrice = productType === "fabric"
    ? type === "silk"
      ? 550
      : type === "rayon"
        ? 320
        : 260
    : type === "silk"
      ? 2400
      : type === "party"
        ? 1800
        : 1200;

  const confidenceBase = productType === "fabric" ? fabricScore : pieceScore;
  const confidence = Math.max(68, Math.min(96, 72 + confidenceBase * 8));

  const recommendedUsage = productType === "fabric"
    ? "Kurti ke liye 2.5 meter recommended"
    : "Ready to wear";

  const matchingItems = productType === "fabric"
    ? ["Matching Dupatta", "Cotton Lining", "Lace Border"]
    : ["Matching Dupatta", "Alteration Service", "Fall-Pico Finish"];

  await new Promise((resolve) => setTimeout(resolve, 900));

  return normalizeDetectedProduct({
    name,
    productType,
    category,
    type,
    description,
    suggestedPrice,
    confidence,
    recommendedUsage,
    matchingItems,
  });
};

export const analyzeProductImageWithVisionAPI = async (file: File): Promise<AiDetectedProduct> => {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/ai/product-detect", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as {
    result?: Partial<AiDetectedProduct>;
    error?: string;
  };

  if (!response.ok || !payload.result) {
    throw new Error(payload.error || "Vision AI detection failed.");
  }

  return normalizeDetectedProduct(payload.result);
};
