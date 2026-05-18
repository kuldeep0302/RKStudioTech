export type ProductFilters = {
  maxPrice: number | null;
  type: string;
};

export const defaultFilters: ProductFilters = {
  maxPrice: null,
  type: "all",
};

export const applyProductFilters = <T extends { price: number; type: string }>(
  products: T[],
  filters: ProductFilters,
): T[] => {
  return products.filter((product) => {
    const maxPrice = filters.maxPrice;
    const byPrice = maxPrice === null || !Number.isFinite(maxPrice) || product.price <= maxPrice;
    const byType = filters.type === "all" || product.type === filters.type;

    return byPrice && byType;
  });
};
