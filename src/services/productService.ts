import {
  addDoc,
  collection,
  DocumentData,
  deleteDoc,
  getDocs,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  QueryDocumentSnapshot,
  query,
  serverTimestamp,
  startAfter,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { dupattaProducts, fabricProducts } from "@/data/mockProducts";
import { getFirebaseDb, getFirebaseStorage } from "@/services/firebase";
import { getEnvBool } from "@/utils/env";

export type ProductCategory = "fabric" | "dupatta";

const normalizeCategory = (value: unknown): ProductCategory => {
  if (typeof value !== "string") {
    return "fabric";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.includes("dupatta") || normalized.includes("dupata") || normalized.includes("chunni") || normalized.includes("stole")) {
    return "dupatta";
  }

  return "fabric";
};

const getCategoryVariants = (category: ProductCategory): string[] => {
  const base = category.trim();
  const capitalized = `${base.charAt(0).toUpperCase()}${base.slice(1)}`;
  const upper = base.toUpperCase();

  return Array.from(new Set([base, capitalized, upper]));
};

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  marketPrice: number;
  pricingType: "meter" | "piece";
  pricePerUnit: number;
  discountPercentage: number;
  advancePercentage: number;
  productType: "fabric" | "piece";
  type: string;
  category: ProductCategory;
  image: string;
  imageUrl?: string;
  tag: string;
  isActive: boolean;
  createdAt: Timestamp | null;
  description?: string;
  inStock?: boolean;
  suggestion?: string;
  discountPercent?: number;
  rating?: number;
};

type ProductInput = {
  name: string;
  price: number;
  marketPrice?: number;
  pricingType?: "meter" | "piece";
  pricePerUnit?: number;
  discountPercentage?: number;
  advancePercentage?: number;
  productType?: "fabric" | "piece";
  type: string;
  category: ProductCategory;
  image: string;
  imageUrl?: string;
  tag: string;
  isActive?: boolean;
  description?: string;
  discountPercent?: number;
  rating?: number;
};

const toProduct = (id: string, data: Partial<CatalogProduct>): CatalogProduct => ({
  id,
  name: data.name || "Untitled product",
  price: typeof data.price === "number" ? data.price : Number(data.price || 0),
  marketPrice:
    typeof data.marketPrice === "number"
      ? data.marketPrice
      : typeof data.price === "number"
        ? data.price
        : Number(data.price || 0),
  pricingType:
    data.pricingType === "meter" || data.pricingType === "piece"
      ? data.pricingType
      : data.productType === "fabric"
        ? "meter"
        : "piece",
  pricePerUnit:
    typeof data.pricePerUnit === "number"
      ? data.pricePerUnit
      : typeof data.price === "number"
        ? data.price
        : Number(data.price || 0),
  discountPercentage:
    typeof data.discountPercentage === "number"
      ? data.discountPercentage
      : typeof data.discountPercent === "number"
        ? data.discountPercent
        : 5,
  advancePercentage:
    typeof data.advancePercentage === "number"
      ? data.advancePercentage
      : 20,
  productType:
    data.productType === "fabric" || data.productType === "piece"
      ? data.productType
      : ((data.category as ProductCategory) || "fabric") === "fabric"
        ? "fabric"
        : "piece",
  type: data.type || "general",
  category: normalizeCategory(data.category),
  image: data.image || data.imageUrl || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
  imageUrl: data.image || data.imageUrl || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
  tag: data.tag || "daily wear",
  isActive: data.isActive !== false,
  createdAt: (data.createdAt as Timestamp) || null,
  description: data.description || `${data.tag || "daily wear"} ${data.type || "general"} product`,
  inStock: data.inStock ?? true,
  suggestion: data.suggestion,
  discountPercent: typeof data.discountPercent === "number" ? data.discountPercent : 0,
  rating: typeof data.rating === "number" ? data.rating : 4.5,
});

const dummyCatalogProducts: CatalogProduct[] = [...fabricProducts.slice(0, 3), ...dupattaProducts.slice(0, 3)].map((product) =>
  toProduct(product.id, {
    id: product.id,
    name: product.name,
    price: product.price,
    productType: product.productType,
    type: product.type,
    category: product.category,
    image: product.image,
    tag: product.tag || "popular",
    description: product.description,
    inStock: product.inStock,
    suggestion: product.suggestion,
    discountPercent: product.discountPercent,
    rating: product.rating,
    pricingType: product.productType === "fabric" ? "meter" : "piece",
    pricePerUnit: product.price,
    marketPrice: product.price,
    discountPercentage: typeof product.discountPercent === "number" ? product.discountPercent : 5,
    advancePercentage: 20,
    createdAt: null,
  }),
);

const byNewestFallback = (a: CatalogProduct, b: CatalogProduct) => a.id.localeCompare(b.id);
const allowMockCatalogFallback =
  process.env.NODE_ENV !== "production"
  || getEnvBool(process.env.NEXT_PUBLIC_ENABLE_MOCK_CATALOG_FALLBACK);

export type ProductPageCursor = QueryDocumentSnapshot<DocumentData> | null;

export type ProductPageResult = {
  products: CatalogProduct[];
  cursor: ProductPageCursor;
  hasMore: boolean;
};

const byCreatedAtDesc = (a: CatalogProduct, b: CatalogProduct) => {
  const aMillis = a.createdAt?.toMillis?.() ?? 0;
  const bMillis = b.createdAt?.toMillis?.() ?? 0;

  if (aMillis === bMillis) {
    return a.id.localeCompare(b.id);
  }

  return bMillis - aMillis;
};

export const uploadProductImage = async (file: File) => {
  const storage = getFirebaseStorage();

  if (!storage) {
    throw new Error("Firebase storage is not configured.");
  }

  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const imageRef = ref(storage, `products/${Date.now()}-${safeName}`);

  await uploadBytes(imageRef, file, { contentType: file.type || "image/jpeg" });

  return getDownloadURL(imageRef);
};

export const addProduct = async (input: ProductInput) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  const productRef = doc(collection(db, "products"));

  await setDoc(productRef, {
    id: productRef.id,
    ...input,
    imageUrl: input.imageUrl || input.image,
    isActive: input.isActive !== false,
    createdAt: serverTimestamp(),
  });

  return productRef.id;
};

export const updateProduct = async (id: string, input: ProductInput) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await updateDoc(doc(db, "products", id), {
    ...input,
    imageUrl: input.imageUrl || input.image,
    isActive: input.isActive !== false,
  });
};

export const setProductActiveState = async (id: string, isActive: boolean) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await updateDoc(doc(db, "products", id), {
    isActive,
  });
};

export const getProductById = async (id: string): Promise<CatalogProduct | null> => {
  const db = getFirebaseDb();

  if (!db) {
    return dummyCatalogProducts.find((product) => product.id === id) || null;
  }

  const productRef = doc(db, "products", id);
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    if (allowMockCatalogFallback) {
      return dummyCatalogProducts.find((product) => product.id === id) || null;
    }

    return null;
  }

  return toProduct(productSnap.id, productSnap.data() as Partial<CatalogProduct>);
};

export const removeProduct = async (id: string) => {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase is not configured.");
  }

  await deleteDoc(doc(db, "products", id));
};

export const subscribeToAllProducts = (
  onProducts: (products: CatalogProduct[]) => void,
  onError?: (error: Error) => void,
) => {
  const db = getFirebaseDb();

  if (!db) {
    onProducts(allowMockCatalogFallback ? [...dummyCatalogProducts].sort(byNewestFallback) : []);
    return () => undefined;
  }

  const productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      const firestoreProducts = snapshot.docs.map((productDoc) =>
        toProduct(productDoc.id, productDoc.data() as Partial<CatalogProduct>),
      );
      const activeProducts = firestoreProducts.filter((product) => product.isActive !== false);

      onProducts(
        activeProducts.length
          ? activeProducts.sort(byCreatedAtDesc)
          : allowMockCatalogFallback
            ? [...dummyCatalogProducts].sort(byNewestFallback)
            : [],
      );
    },
    (error) => {
      if (allowMockCatalogFallback) {
        onProducts([...dummyCatalogProducts].sort(byNewestFallback));
        return;
      }

      onError?.(error as Error);
    },
  );
};

export const subscribeToProductsByCategory = (
  category: ProductCategory,
  onProducts: (products: CatalogProduct[]) => void,
  onError?: (error: Error) => void,
) => {
  const db = getFirebaseDb();

  console.log("Fetching products for category:", category);

  if (!db) {
    onProducts(allowMockCatalogFallback ? dummyCatalogProducts.filter((product) => product.category === category) : []);
    return () => undefined;
  }

  const productsQuery = query(collection(db, "products"), limit(200));

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      const firestoreProducts = snapshot.docs.map((productDoc) =>
        toProduct(productDoc.id, productDoc.data() as Partial<CatalogProduct>),
      );
      const categoryProducts = firestoreProducts.filter((product) => product.category === category);
      const activeCategoryProducts = categoryProducts.filter((product) => product.isActive !== false);

      onProducts(
        activeCategoryProducts.length
          ? activeCategoryProducts.sort(byCreatedAtDesc)
          : allowMockCatalogFallback
            ? dummyCatalogProducts.filter((product) => product.category === category)
            : [],
      );
    },
    (error) => {
      if (allowMockCatalogFallback) {
        onProducts(dummyCatalogProducts.filter((product) => product.category === category));
        return;
      }

      onError?.(error as Error);
    },
  );
};

export const getProductsByCategoryPage = async (
  category: ProductCategory,
  pageSize = 24,
  cursor: ProductPageCursor = null,
): Promise<ProductPageResult> => {
  const db = getFirebaseDb();

  console.log("Fetching products for category:", category);

  if (!db) {
    const all = dummyCatalogProducts.filter((product) => product.category === category);
    const startIndex = 0;
    const endIndex = Math.min(startIndex + pageSize, all.length);

    return {
      products: all.slice(startIndex, endIndex),
      cursor: null,
      hasMore: endIndex < all.length,
    };
  }

  let snapshot;

  try {
    const categoryVariants = getCategoryVariants(category);
    const productsQuery = cursor
      ? query(
        collection(db, "products"),
        where("category", "in", categoryVariants),
        startAfter(cursor),
        limit(pageSize),
      )
      : query(
        collection(db, "products"),
        where("category", "in", categoryVariants),
        limit(pageSize),
      );

    snapshot = await getDocs(productsQuery);
  } catch (queryError) {
    console.error("Firestore fetch error:", queryError);

    try {
      const allProductsSnapshot = await getDocs(collection(db, "products"));
      console.log("ALL PRODUCTS:", allProductsSnapshot.docs.map((snapshotDoc) => snapshotDoc.data()));
    } catch (allProductsError) {
      console.error("Firestore fetch error:", allProductsError);
    }

    const fallbackQuery = cursor
      ? query(collection(db, "products"), startAfter(cursor), limit(pageSize * 2))
      : query(collection(db, "products"), limit(pageSize * 2));

    try {
      snapshot = await getDocs(fallbackQuery);
    } catch (fallbackError) {
      console.error("Firestore fetch error:", fallbackError);

      if (allowMockCatalogFallback) {
        console.warn("[products] firestore page query failed, using mock fallback", {
          category,
          error: fallbackError,
        });

        const fallbackProducts = dummyCatalogProducts.filter((product) => product.category === category);

        return {
          products: fallbackProducts.slice(0, pageSize),
          cursor: null,
          hasMore: fallbackProducts.length > pageSize,
        };
      }

      return {
        products: [],
        cursor,
        hasMore: false,
      };
    }
  }

  const products = snapshot.docs
    .map((productDoc) => toProduct(productDoc.id, productDoc.data() as Partial<CatalogProduct>))
    .filter((product) => product.category === category && product.isActive !== false);
  const nextCursor = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : cursor;

  if (!products.length) {
    // Final fallback: read the whole collection (no index required) and filter client-side.
    // This covers cases where an "in" index is missing or Firestore rules differ per field.
    try {
      const fullSnapshot = await getDocs(collection(db, "products"));
      console.log("[products] Full collection count:", fullSnapshot.size);
      const directProducts = fullSnapshot.docs
        .map((d) => toProduct(d.id, d.data() as Partial<CatalogProduct>))
        .filter((p) => p.category === category && p.isActive !== false);
      console.log("[products] Direct-filtered for category:", category, "count:", directProducts.length);
      if (directProducts.length) {
        return {
          products: directProducts.slice(0, pageSize),
          cursor: null,
          hasMore: directProducts.length > pageSize,
        };
      }
    } catch (directFetchError) {
      console.error("Firestore fetch error:", directFetchError);
    }

    if (allowMockCatalogFallback) {
      return {
        products: dummyCatalogProducts.filter((product) => product.category === category),
        cursor: null,
        hasMore: false,
      };
    }
  }

  return {
    products,
    cursor: nextCursor,
    hasMore: snapshot.docs.length === pageSize,
  };
};

/**
 * Direct full-collection fetch with client-side category filter.
 * Use this as a diagnostic tool or alternative loader when paginated queries fail.
 */
export const fetchProductsByCategory = async (category: ProductCategory): Promise<CatalogProduct[]> => {
  const db = getFirebaseDb();

  if (!db) {
    console.warn("[products] Firebase not available");
    return allowMockCatalogFallback
      ? dummyCatalogProducts.filter((p) => p.category === category)
      : [];
  }

  try {
    console.log("[products] Direct fetch for category:", category);
    const snapshot = await getDocs(collection(db, "products"));
    console.log("Products count:", snapshot.size);

    if (snapshot.empty) {
      console.warn("[products] No products found in collection");
      return allowMockCatalogFallback
        ? dummyCatalogProducts.filter((p) => p.category === category)
        : [];
    }

    const all = snapshot.docs.map((d) => toProduct(d.id, d.data() as Partial<CatalogProduct>));
    const filtered = all.filter((p) => p.category === category && p.isActive !== false);
    console.log("[products] Filtered for category:", category, "count:", filtered.length);

    if (!filtered.length && allowMockCatalogFallback) {
      return dummyCatalogProducts.filter((p) => p.category === category);
    }

    return filtered;
  } catch (err) {
    console.error("Firestore fetch error:", err);
    return allowMockCatalogFallback
      ? dummyCatalogProducts.filter((p) => p.category === category)
      : [];
  }
};

export const fetchProducts = async () => {
  const db = getFirebaseDb();

  if (!db) {
    console.warn("[products] Firebase not configured for fetchProducts");
    return [] as CatalogProduct[];
  }

  try {
    console.log("Using project:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const snap = await getDocs(collection(db, "products"));

    console.log("PRODUCT COUNT:", snap.size);

    const products = snap.docs.map((productDoc) => ({
      id: productDoc.id,
      ...productDoc.data(),
    })) as CatalogProduct[];

    snap.forEach((productDoc) => {
      console.log("DOC:", productDoc.id, productDoc.data());
    });

    return products;
  } catch (err) {
    console.error("FIRESTORE ERROR:", err);
    return [] as CatalogProduct[];
  }
};

export const debugFirestore = async (): Promise<number> => {
  const products = await fetchProducts();
  return products.length;
};

export const ensureData = async () => {
  const count = await debugFirestore();

  if (count === 0) {
    console.warn("No data found -> seeding");
    await seedDummyProducts();
    const newCount = await debugFirestore();
    console.log("After seed:", newCount);
  }
};

// ---------------------------------------------------------------------------
// Dummy data seed — for testing when Firestore "products" collection is empty
// ---------------------------------------------------------------------------

type SeedProductInput = Omit<ProductInput, "tag"> & {
  tag: string;
  inStock?: boolean;
};

const SEED_PRODUCTS: SeedProductInput[] = [
  {
    name: "Premium Cotton Fabric",
    category: "fabric",
    price: 450,
    marketPrice: 550,
    pricingType: "meter",
    pricePerUnit: 450,
    productType: "fabric",
    type: "cotton",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=80",
    tag: "bestseller",
    description: "Soft premium cotton fabric ideal for kurtas and shirts.",
    discountPercentage: 18,
    advancePercentage: 20,
    inStock: true,
    rating: 4.7,
  },
  {
    name: "Silk Blend Fabric",
    category: "fabric",
    price: 850,
    marketPrice: 1000,
    pricingType: "meter",
    pricePerUnit: 850,
    productType: "fabric",
    type: "silk",
    image: "https://images.unsplash.com/photo-1590735213920-68192a487bc2?auto=format&fit=crop&w=900&q=80",
    tag: "premium",
    description: "Luxurious silk blend fabric for ethnic wear.",
    discountPercentage: 15,
    advancePercentage: 20,
    inStock: true,
    rating: 4.8,
  },
  {
    name: "Linen Casual Fabric",
    category: "fabric",
    price: 320,
    marketPrice: 380,
    pricingType: "meter",
    pricePerUnit: 320,
    productType: "fabric",
    type: "linen",
    image: "https://images.unsplash.com/photo-1620799139507-2a76f79a2f4d?auto=format&fit=crop&w=900&q=80",
    tag: "casual",
    description: "Breathable linen fabric for daily wear.",
    discountPercentage: 16,
    advancePercentage: 20,
    inStock: true,
    rating: 4.5,
  },
  {
    name: "Embroidered Dupatta",
    category: "dupatta",
    price: 650,
    marketPrice: 800,
    pricingType: "piece",
    pricePerUnit: 650,
    productType: "piece",
    type: "embroidered",
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80",
    tag: "festive",
    description: "Handcrafted embroidered dupatta with mirror work.",
    discountPercentage: 19,
    advancePercentage: 20,
    inStock: true,
    rating: 4.9,
  },
  {
    name: "Chiffon Dupatta",
    category: "dupatta",
    price: 380,
    marketPrice: 450,
    pricingType: "piece",
    pricePerUnit: 380,
    productType: "piece",
    type: "chiffon",
    image: "https://images.unsplash.com/photo-1614432002880-d1e54f14bd67?auto=format&fit=crop&w=900&q=80",
    tag: "light",
    description: "Lightweight chiffon dupatta for casual and formal occasions.",
    discountPercentage: 15,
    advancePercentage: 20,
    inStock: true,
    rating: 4.6,
  },
  {
    name: "Georgette Printed Dupatta",
    category: "dupatta",
    price: 420,
    marketPrice: 500,
    pricingType: "piece",
    pricePerUnit: 420,
    productType: "piece",
    type: "georgette",
    image: "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?auto=format&fit=crop&w=900&q=80",
    tag: "printed",
    description: "Stylish georgette dupatta with floral print.",
    discountPercentage: 16,
    advancePercentage: 20,
    inStock: true,
    rating: 4.4,
  },
];

/**
 * Seeds dummy products into Firestore only if the collection is currently empty.
 * Safe to call on every app load — will skip if data already exists.
 * Returns the number of documents added (0 if skipped).
 */
export const seedDummyProducts = async (): Promise<number> => {
  const db = getFirebaseDb();

  if (!db) {
    console.warn("[seed] Firebase not available — skipping seed");
    return 0;
  }

  try {
    const existing = await getDocs(collection(db, "products"));
    console.log("[seed] Current products count:", existing.size);

    if (existing.size > 0) {
      console.log("[seed] Collection not empty — skipping seed");
      return 0;
    }

    let added = 0;

    for (const product of SEED_PRODUCTS) {
      await addDoc(collection(db, "products"), {
        ...product,
        createdAt: serverTimestamp(),
      });
      added++;
    }

    console.log(`[seed] Seeded ${added} dummy products`);
    return added;
  } catch (err) {
    console.error("[seed] Failed to seed products:", err);
    return 0;
  }
};

/**
 * Deletes ALL documents from the "products" collection.
 * Pass confirmed=true to execute — prevents accidental calls.
 * Returns the number of documents deleted.
 */
export const clearDummyProducts = async (confirmed = false): Promise<number> => {
  if (!confirmed) {
    console.warn("[seed] clearDummyProducts called without confirmed=true — aborting");
    return 0;
  }

  const db = getFirebaseDb();

  if (!db) {
    console.warn("[seed] Firebase not available — cannot clear");
    return 0;
  }

  try {
    const snapshot = await getDocs(collection(db, "products"));
    console.log("[seed] Deleting", snapshot.size, "products...");

    await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, "products", d.id))));
    console.log(`[seed] Deleted ${snapshot.size} products`);
    return snapshot.size;
  } catch (err) {
    console.error("[seed] Failed to clear products:", err);
    return 0;
  }
};
