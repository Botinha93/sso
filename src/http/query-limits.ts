export const clampLimit = (raw: unknown, fallback = 100, min = 1, max = 500) => {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
};
