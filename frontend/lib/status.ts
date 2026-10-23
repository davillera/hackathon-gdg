import type { Estado } from "./types";

export const STATUS: Record<Estado, { ral: string; bg: string; fg: string; text: string }> = {
  "Crítico": { ral: "RAL 3020", bg: "bg-crit", fg: "text-white", text: "text-crit" },
  Advertencia: { ral: "RAL 1023", bg: "bg-warn", fg: "text-ink", text: "text-ink" },
  Estable: { ral: "RAL 6024", bg: "bg-ok", fg: "text-white", text: "text-ok-ink" },
};

/** Misma regla que la API: crítico si se agota en 7 días o menos, advertencia hasta 14. */
export function estadoPorDias(dias: number): Estado {
  if (dias <= 7) return "Crítico";
  if (dias <= 14) return "Advertencia";
  return "Estable";
}
