export const getFriendlyErrorMessage = (error: unknown, fallback = "Something went wrong. Please try again.") => {
  const message = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message || "")
    : "";

  const normalized = message.toLowerCase();

  if (normalized.includes("network") || normalized.includes("failed to fetch") || normalized.includes("timeout")) {
    return "Network issue detected. Please try again.";
  }

  if (normalized.includes("permission") || normalized.includes("unauthorized") || normalized.includes("forbidden")) {
    return "You do not have permission for this action.";
  }

  if (normalized.includes("not found")) {
    return "Requested data was not found.";
  }

  return fallback;
};

export const uiDevLogError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.error(...args);
  }
};
