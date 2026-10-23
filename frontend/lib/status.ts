import type { Estado } from "./types";

export const STATUS: Record<Estado, { ral: string; bg: string; fg: string; text: string; label: string }> = {
  "Crítico": { ral: "RAL 3020", bg: "bg-crit", fg: "text-white", text: "text-crit", label: "Crítico" },
  Advertencia: { ral: "RAL 1023", bg: "bg-warn", fg: "text-ink", text: "text-ink", label: "Advertencia" },
  Estable: { ral: "RAL 6024", bg: "bg-ok", fg: "text-white", text: "text-ok-ink", label: "Estable" },
};

/** Solo para colorear el promedio de días de inventario; el estado de cada insumo lo calcula la API. */
export function estadoPorDias(dias: number): Estado {
  if (dias <= 7) return "Crítico";
  if (dias <= 14) return "Advertencia";
  return "Estable";
}
