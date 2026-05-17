export type FabricCartItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  category: "fabric" | "dupatta";
  product_type: "fabric" | "piece";
  unit_label: "meter" | "piece";
  price_per_unit: number;
  selected_quantity: number;
  total_price: number;
  description?: string;
  type?: string;
  addedAt: number;
};

const STORAGE_KEY = "rk_studio_fabric_cart";

const isBrowser = () => typeof window !== "undefined";

const sanitizeMeter = (meter: number) => {
  if (!Number.isFinite(meter)) {
    return 1;
  }

  return Math.max(1, Math.round(meter * 100) / 100);
};

export const readFabricCart = (): FabricCartItem[] => {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as FabricCartItem[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => Boolean(item?.id && item?.productId));
  } catch {
    return [];
  }
};

const writeFabricCart = (items: FabricCartItem[]) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const addFabricItemToCart = (
  item: Omit<FabricCartItem, "id" | "addedAt" | "selected_quantity" | "total_price" | "unit_label"> & {
    selected_quantity: number;
  },
) => {
  const quantity = sanitizeMeter(item.selected_quantity);
  const totalPrice = Math.round(item.price_per_unit * quantity);

  const nextItem: FabricCartItem = {
    ...item,
    id: `${item.productId}-${Date.now()}`,
    unit_label: item.product_type === "fabric" ? "meter" : "piece",
    selected_quantity: quantity,
    total_price: totalPrice,
    addedAt: Date.now(),
  };

  const existing = readFabricCart();
  writeFabricCart([nextItem, ...existing]);

  return nextItem;
};

export const removeFabricCartItem = (id: string) => {
  const existing = readFabricCart();
  writeFabricCart(existing.filter((item) => item.id !== id));
};

export const removeFabricCartItems = (ids: string[]) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const idSet = new Set(ids);
  const existing = readFabricCart();
  writeFabricCart(existing.filter((item) => !idSet.has(item.id)));
};

export const clearFabricCart = () => {
  writeFabricCart([]);
};
