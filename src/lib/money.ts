export const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCop(value: number | string): string {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numericValue)) return copFormatter.format(0);
  return copFormatter.format(numericValue);
}

export function parseCopInput(raw: string): number | null {
  if (!raw) return null;

  const cleaned = raw.trim().replace(/\s/g, "").replace(/\$/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;

  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  normalized = normalized.replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return roundToTwo(parsed);
}

export function formatCopInput(value: string): string {
  const parsed = parseCopInput(value);
  if (parsed === null) return value;

  const [integerPart, decimalPart = "00"] = parsed.toFixed(2).split(".");
  const withThousands = Number(integerPart).toLocaleString("es-CO");
  return `$ ${withThousands},${decimalPart}`;
}
