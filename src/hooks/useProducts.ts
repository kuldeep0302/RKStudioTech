"use client";

import { useEffect, useState } from "react";
import {
  CatalogProduct,
  getProductsByCategoryPage,
  ProductPageCursor,
  ProductCategory,
  subscribeToAllProducts,
  subscribeToProductsByCategory,
} from "@/services/productService";
import { useAutoSeed } from "@/hooks/useAutoSeed";

type UseProductsParams = {
  category?: ProductCategory;
  paginated?: boolean;
  pageSize?: number;
};

export const useProducts = ({ category, paginated = false, pageSize = 24 }: UseProductsParams = {}) => {
  useAutoSeed();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<ProductPageCursor>(null);
  const [error, setError] = useState("");

  const loadMore = async () => {
    if (!category || !paginated || loadingMore || !hasMore) {
      return;
    }

    try {
      setLoadingMore(true);
      setError("");

      const page = await getProductsByCategoryPage(category, pageSize, cursor);
      setProducts((prev) => [...prev, ...page.products]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch {
      setError("Could not load products.");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    setProducts([]);
    setCursor(null);
    setHasMore(false);

    if (paginated && category) {
      let cancelled = false;

      const loadInitial = async () => {
        try {
          const page = await getProductsByCategoryPage(category, pageSize, null);

          if (cancelled) {
            return;
          }

          setProducts(page.products);
          setCursor(page.cursor);
          setHasMore(page.hasMore);
        } catch {
          if (!cancelled) {
            setError("Could not load products.");
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      void loadInitial();

      return () => {
        cancelled = true;
      };
    }

    const unsubscribe = category
      ? subscribeToProductsByCategory(
          category,
          (nextProducts) => {
            setProducts(nextProducts);
            setLoading(false);
          },
          () => {
            setError("Could not load products.");
            setLoading(false);
          },
        )
      : subscribeToAllProducts(
          (nextProducts) => {
            setProducts(nextProducts);
            setLoading(false);
          },
          () => {
            setError("Could not load products.");
            setLoading(false);
          },
        );

    return () => unsubscribe();
  }, [category, paginated, pageSize]);

  return { products, loading, error, loadMore, hasMore, loadingMore };
};
