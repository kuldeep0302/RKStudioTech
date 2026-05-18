"use client";

import { useEffect, useRef } from "react";
import { ensureData } from "@/services/productService";

/**
 * Automatically seeds dummy products into Firestore on first client-side mount
 * if the "products" collection is empty. Safe to call on every load — the seed
 * function is a no-op when data already exists.
 *
 * Usage: call this hook once in a top-level client component (e.g. the admin
 * dashboard or a layout wrapper).
 */
export const useAutoSeed = () => {
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }

    hasRun.current = true;

    void ensureData();
  }, []);
};
