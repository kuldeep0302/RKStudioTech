import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { dupattaProducts, fabricProducts } from "@/data/mockProducts";
import { getFirebaseDb, getFirebaseStorage } from "@/services/firebase";

export type ProductCategory = "fabric" | "dupatta";

export type CatalogProduct = {
  id: string;
  name: string;
  price: number;
  productType: "fabric" | "piece";
  type: string;
  category: ProductCategory;
  image: string;
  tag: string;
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
  productType?: "fabric" | "piece";
  type: string;
  category: ProductCategory;
  image: string;
  tag: string;
  description?: string;
  discountPercent?: number;
  rating?: number;
};

const toProduct = (id: string, data: Partial<CatalogProduct>): CatalogProduct => ({
  id,
  name: data.name || "Untitled product",
  price: typeof data.price === "number" ? data.price : Number(data.price || 0),
  productType:
    data.productType === "fabric" || data.productType === "piece"
      ? data.productType
      : ((data.category as ProductCategory) || "fabric") === "fabric"
        ? "fabric"
        : "piece",
  type: data.type || "general",
  category: (data.category as ProductCategory) || "fabric",
  image: data.image || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
  tag: data.tag || "daily wear",
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
    createdAt: null,
  }),
);

const byNewestFallback = (a: CatalogProduct, b: CatalogProduct) => a.id.localeCompare(b.id);

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
  });
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
    onProducts([...dummyCatalogProducts].sort(byNewestFallback));
    return () => undefined;
  }

  const productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      const firestoreProducts = snapshot.docs.map((productDoc) =>
        toProduct(productDoc.id, productDoc.data() as Partial<CatalogProduct>),
      );

      onProducts(firestoreProducts.length ? firestoreProducts : [...dummyCatalogProducts].sort(byNewestFallback));
    },
    (error) => onError?.(error as Error),
  );
};

export const subscribeToProductsByCategory = (
  category: ProductCategory,
  onProducts: (products: CatalogProduct[]) => void,
  onError?: (error: Error) => void,
) => {
  const db = getFirebaseDb();

  if (!db) {
    onProducts(dummyCatalogProducts.filter((product) => product.category === category));
    return () => undefined;
  }

  const productsQuery = query(
    collection(db, "products"),
    where("category", "==", category),
    orderBy("createdAt", "desc"),
    limit(100),
  );

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      const firestoreProducts = snapshot.docs.map((productDoc) =>
        toProduct(productDoc.id, productDoc.data() as Partial<CatalogProduct>),
      );

      onProducts(
        firestoreProducts.length
          ? firestoreProducts
          : dummyCatalogProducts.filter((product) => product.category === category),
      );
    },
    (error) => onError?.(error as Error),
  );
};
