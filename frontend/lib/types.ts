// Formas de respuesta de la API (ver "Contrato de la API" en el README).

export type Estado = "Crítico" | "Advertencia" | "OK";

export interface InsumoActual {
  id_insumo: string;
  nombre: string;
  unidad: string;
  stock_actual: number;
  consumo_diario_prom: number;
  dias_cobertura: number;
  punto_reorden: number;
  lead_time_dias: number;
  estado: Estado;
}

export interface ForecastPoint {
  date: string; // YYYY-MM-DD
  predicted_consumption: number;
  lower_bound: number;
  upper_bound: number;
}

export interface ForecastResponse {
  item: string;
  forecast: ForecastPoint[];
}

export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  consumption: number;
}

export interface HistoryResponse {
  item: string;
  history: HistoryPoint[];
}

export interface Alerta {
  id_insumo: string;
  nombre: string;
  unidad: string;
  estado: Exclude<Estado, "OK">;
  stock_actual: number;
  dias_restantes: number;
  fecha_agotamiento: string; // YYYY-MM-DD
}

export interface ModelMetrics {
  modelo: string;
  mape: number; // porcentaje
  precision: number; // 100 - mape
  evaluado_en: string; // YYYY-MM-DD
}

export interface PurchaseOrder {
  id: string;
  id_insumo: string;
  nombre: string;
  unidad: string;
  cantidad_sugerida: number;
  creada_en: string; // ISO 8601
  estado: "Emitida";
}

export const HORIZON_DAYS = 30;
