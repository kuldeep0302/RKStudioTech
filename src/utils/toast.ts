import { getToastApi } from "@/context/ToastContext";

const warnIfMissingProvider = () => {
  if (process.env.NODE_ENV !== "production") {
    console.warn("ToastProvider is not mounted yet.");
  }
};

export const showSuccess = (message: string) => {
  const api = getToastApi();

  if (!api) {
    warnIfMissingProvider();
    return "";
  }

  return api.showSuccess(message);
};

export const showError = (message: string) => {
  const api = getToastApi();

  if (!api) {
    warnIfMissingProvider();
    return "";
  }

  return api.showError(message);
};

export const showLoading = (message: string) => {
  const api = getToastApi();

  if (!api) {
    warnIfMissingProvider();
    return "";
  }

  return api.showLoading(message);
};

export const hideToast = (id: string) => {
  const api = getToastApi();

  if (!api || !id) {
    return;
  }

  api.hideToast(id);
};
