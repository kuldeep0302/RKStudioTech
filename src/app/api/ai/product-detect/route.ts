import { NextResponse } from "next/server";

type AiDetectedProduct = {
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

const extractJsonObject = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(start, end + 1)) as Partial<AiDetectedProduct>;
  } catch {
    return null;
  }
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

const toDataUrl = async (file: File) => {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type || "image/jpeg"};base64,${base64}`;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large. Max 8MB." }, { status: 400 });
    }

    const imageDataUrl = await toDataUrl(file);

    const prompt = [
      "Analyze this tailoring product image and return STRICT JSON only.",
      "Detect if productType is fabric (meter-based) or piece (ready-made suit).",
      "Rules: folded cloth roll/unstitched => fabric. stitched suit/mannequin => piece.",
      "Return keys exactly:",
      "name, productType, category, type, description, suggestedPrice, confidence, recommendedUsage, matchingItems",
      "Constraints:",
      "- productType: fabric or piece",
      "- category: fabric or dupatta",
      "- suggestedPrice: integer INR value",
      "- confidence: number 1-99",
      "- matchingItems: array of up to 5 short strings",
      "No markdown. JSON only.",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a product analysis engine for tailoring ecommerce.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    const content = payload.choices?.[0]?.message?.content || "";

    if (!response.ok || !content) {
      return NextResponse.json(
        { error: payload.error?.message || "Vision model failed to analyze image." },
        { status: 502 },
      );
    }

    const parsed = extractJsonObject(content);

    if (!parsed) {
      return NextResponse.json({ error: "Model did not return valid JSON." }, { status: 502 });
    }

    return NextResponse.json({ result: normalizeDetectedProduct(parsed) });
  } catch {
    return NextResponse.json({ error: "Unable to analyze image right now." }, { status: 500 });
  }
}
