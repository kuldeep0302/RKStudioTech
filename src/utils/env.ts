export const getEnvBool = (value: unknown): boolean => {
  return String(value).trim().toLowerCase() === "true";
};
