import { DEFAULT_TIME_ZONE } from "@/lib/constants";

export function formatDateTime(dateValue: Date | string): string {
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;

  const formatter = new Intl.DateTimeFormat("es-CO", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  return formatter.format(date).replace(",", "");
}
