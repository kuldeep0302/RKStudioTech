"use client";

import {
  Alert,
  CircularProgress,
  Snackbar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type ToastVariant = "success" | "error" | "loading";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  autoHideDuration?: number;
};

export type ToastApi = {
  showSuccess: (message: string) => string;
  showError: (message: string) => string;
  showLoading: (message: string) => string;
  hideToast: (id: string) => void;
};

let toastApiRef: ToastApi | null = null;

export const getToastApi = () => toastApiRef;

export const setToastApi = (api: ToastApi | null) => {
  toastApiRef = api;
};

const ToastContext = createContext<ToastApi | null>(null);

const createToastId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const hideToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const pushToast = (variant: ToastVariant, message: string, autoHideDuration?: number) => {
    const id = createToastId();

    setToasts((prev) => [
      ...prev,
      {
        id,
        variant,
        message,
        autoHideDuration,
      },
    ]);

    return id;
  };

  const api = useMemo<ToastApi>(() => {
    const nextApi: ToastApi = {
      showSuccess: (message: string) => pushToast("success", message, 3500),
      showError: (message: string) => pushToast("error", message, 3500),
      showLoading: (message: string) => pushToast("loading", message),
      hideToast,
    };

    setToastApi(nextApi);
    return nextApi;
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={toast.autoHideDuration}
          onClose={(_, reason) => {
            if (reason === "clickaway") {
              return;
            }

            hideToast(toast.id);
          }}
          anchorOrigin={{
            vertical: isMobile ? "top" : "bottom",
            horizontal: "center",
          }}
          sx={{ mt: isMobile ? 1 : 0, mb: isMobile ? 0 : 1 }}
        >
          <Alert
            onClose={toast.variant === "loading" ? undefined : () => hideToast(toast.id)}
            severity={toast.variant === "loading" ? "info" : toast.variant}
            icon={toast.variant === "loading" ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ width: "100%", minWidth: { xs: "88vw", sm: 360 } }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return value;
};
