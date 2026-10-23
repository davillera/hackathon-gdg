// Datos sintéticos de demostración con la misma forma que la API.
// Se usan solo cuando NEXT_PUBLIC_API_URL está vacío.
import {
  HORIZON_DAYS,
  type Alerta,
  type Estado,
  type ForecastResponse,
  type HistoryResponse,
  type InsumoActual,
  type ModelMetrics,
  type PurchaseOrder,
} from "./types";

interface Seed {
  id: string;
  nombre: string;
  unidad: string;
  base: number; // consumo diario promedio
  trend: number; // variación diaria relativa
  cover: number; // días de cobertura del stock actual
  lead: number; // lead time en días
}

// Catálogo y escenarios de docs/data_spec.md (los id_insumo están congelados).
const SEEDS: Seed[] = [
  { id: "ELECTRODO_6013", nombre: "Electrodo 6013", unidad: "kg", base: 45, trend: 0.15 / 365, cover: 11, lead: 7 },
  { id: "ELECTRODO_7018", nombre: "Electrodo 7018", unidad: "kg", base: 30, trend: 0.1 / 365, cover: 30, lead: 7 },
  { id: "ACERO_A36", nombre: "Acero A36", unidad: "kg", base: 850, trend: 0.2 / 365, cover: 4, lead: 7 },
  { id: "ACERO_INOX_304", nombre: "Acero Inox 304", unidad: "kg", base: 120, trend: 0.05 / 365, cover: 45, lead: 10 },
  { id: "ALAMBRE_MIG_ER70S6", nombre: "Alambre MIG ER70S-6", unidad: "kg", base: 55, trend: 0.12 / 365, cover: 25, lead: 7 },
  { id: "DISCO_CORTE_7", nombre: "Disco de corte 7\"", unidad: "unidades", base: 70, trend: 0.08 / 365, cover: 3, lead: 5 },
  { id: "DISCO_DESBASTE_7", nombre: "Disco de desbaste 7\"", unidad: "unidades", base: 40, trend: 0.08 / 365, cover: 40, lead: 5 },
  { id: "GAS_ARGON", nombre: "Gas argón", unidad: "m3", base: 25, trend: 0, cover: 5, lead: 10 },
  { id: "GAS_CO2", nombre: "Gas CO2", unidad: "m3", base: 35, trend: 0.05 / 365, cover: 35, lead: 10 },
  { id: "PINTURA_ANTICORROSIVA", nombre: "Pintura anticorrosiva", unidad: "galones", base: 18, trend: -0.1 / 365, cover: 12, lead: 7 },
  { id: "TORNILLO_M10", nombre: "Tornillo M10", unidad: "unidades", base: 400, trend: 0.05 / 365, cover: 10, lead: 5 },
  { id: "GUANTES_SOLDADOR", nombre: "Guantes de soldador", unidad: "pares", base: 12, trend: 0, cover: 60, lead: 5 },
];

const HISTORY_DAYS = 120;
const WEEKDAY = [0.05, 1.0, 1.05, 1.05, 1.0, 0.9, 0.45]; // dom..sáb

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function today(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function expected(seed: Seed, dayIndex: number, date: Date): number {
  return seed.base * (1 + seed.trend * dayIndex) * WEEKDAY[date.getDay()];
}

function buildHistory(seed: Seed): HistoryResponse {
  const rand = mulberry32(hash(seed.id));
  const start = addDays(today(), -HISTORY_DAYS);
  const history = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const date = addDays(start, i);
    const noise = 1 + (rand() - 0.5) * 0.28;
    return { date: iso(date), consumption: Math.max(0, Math.round(expected(seed, i, date) * noise * 10) / 10) };
  });
  return { item: seed.id, history };
}

function buildForecast(seed: Seed): ForecastResponse {
  const start = addDays(today(), 1);
  const forecast = Array.from({ length: HORIZON_DAYS }, (_, h) => {
    const date = addDays(start, h);
    const predicted = expected(seed, HISTORY_DAYS + 1 + h, date);
    const sigma = seed.base * 0.15 * Math.sqrt(1 + h / 6);
    return {
      date: iso(date),
      predicted_consumption: Math.round(predicted * 10) / 10,
      lower_bound: Math.max(0, Math.round((predicted - 1.96 * sigma) * 10) / 10),
      upper_bound: Math.round((predicted + 1.96 * sigma) * 10) / 10,
    };
  });
  return { item: seed.id, forecast };
}

function avgForecast(seed: Seed): number {
  const f = buildForecast(seed).forecast;
  return f.reduce((s, p) => s + p.predicted_consumption, 0) / f.length;
}

function stockFor(seed: Seed): number {
  return Math.round(avgForecast(seed) * seed.cover);
}

function daysLeft(seed: Seed): number {
  const stock = stockFor(seed);
  const forecast = buildForecast(seed).forecast;
  let acc = 0;
  for (let i = 0; i < forecast.length; i++) {
    const next = acc + forecast[i].predicted_consumption;
    if (next >= stock) return Math.floor(i + (stock - acc) / forecast[i].predicted_consumption);
    acc = next;
  }
  return Math.round(stock / avgForecast(seed));
}

function estadoDe(seed: Seed): Estado {
  const dias = daysLeft(seed);
  const f7 = buildForecast(seed).forecast.slice(0, 7).reduce((t, p) => t + p.predicted_consumption, 0);
  if (dias <= seed.lead || stockFor(seed) < f7) return "Crítico";
  if (dias <= seed.lead + 7) return "Advertencia";
  return "OK";
}

export function mockCurrent(): InsumoActual[] {
  return SEEDS.map((s) => {
    const avg = avgForecast(s);
    return {
      id_insumo: s.id,
      nombre: s.nombre,
      unidad: s.unidad,
      stock_actual: stockFor(s),
      punto_reorden: Math.round(avg * (s.lead + 7)),
      lead_time_dias: s.lead,
      consumo_diario_prom: Math.round(avg * 10) / 10,
      dias_cobertura: daysLeft(s),
      estado: estadoDe(s),
    };
  });
}

export function mockAlerts(): Alerta[] {
  const alerts: Alerta[] = [];
  for (const s of SEEDS) {
    const estado = estadoDe(s);
    if (estado === "OK") continue;
    const dias = daysLeft(s);
    alerts.push({
      id_insumo: s.id,
      nombre: s.nombre,
      unidad: s.unidad,
      estado,
      stock_actual: stockFor(s),
      dias_restantes: dias,
      fecha_agotamiento: iso(addDays(today(), dias)),
    });
  }
  return alerts.sort((a, b) => a.dias_restantes - b.dias_restantes);
}

let demoOrders: PurchaseOrder[] = [];

export function mockOrders(): PurchaseOrder[] {
  return demoOrders;
}

export function mockCreateOrder(id: string): PurchaseOrder {
  const existing = demoOrders.find((o) => o.id_insumo === id);
  if (existing) return existing;
  const seed = SEEDS.find((s) => s.id === id);
  if (!seed) throw new Error(`No existe el insumo '${id}'.`);
  const order: PurchaseOrder = {
    id: Math.random().toString(16).slice(2, 10).toUpperCase(),
    id_insumo: seed.id,
    nombre: seed.nombre,
    unidad: seed.unidad,
    cantidad_sugerida: Math.max(0, Math.round(avgForecast(seed) * (seed.lead + HORIZON_DAYS) - stockFor(seed))),
    creada_en: new Date().toISOString(),
    estado: "Emitida",
  };
  demoOrders = [order, ...demoOrders];
  return order;
}

export function mockForecast(id: string): ForecastResponse {
  const seed = SEEDS.find((s) => s.id === id) ?? SEEDS[0];
  return buildForecast(seed);
}

export function mockHistory(id: string): HistoryResponse {
  const seed = SEEDS.find((s) => s.id === id) ?? SEEDS[0];
  return buildHistory(seed);
}

export function mockMetrics(): ModelMetrics {
  return { modelo: "ARIMA_PLUS", mape: 8.6, precision: 91.4, evaluado_en: iso(addDays(today(), -1)) };
}
