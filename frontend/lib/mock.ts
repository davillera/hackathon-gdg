// Datos sintéticos de demostración con la misma forma que la API.
// Se usan solo cuando NEXT_PUBLIC_API_URL está vacío.
import {
  HORIZON_DAYS,
  type Alerta,
  type ForecastResponse,
  type HistoryResponse,
  type InsumoActual,
  type ModelMetrics,
} from "./types";

interface Seed {
  id: string;
  nombre: string;
  unidad: string;
  base: number; // consumo diario promedio
  trend: number; // variación diaria relativa
  cover: number; // días de cobertura objetivo para el stock actual
}

const SEEDS: Seed[] = [
  { id: "ELECTRODO_6013", nombre: "Electrodos 6013", unidad: "kg", base: 42, trend: 0.0012, cover: 3.4 },
  { id: "ACERO_A36", nombre: "Acero A36 (placa)", unidad: "kg", base: 310, trend: 0.0008, cover: 4.2 },
  { id: "ALAMBRE_MIG", nombre: "Alambre MIG ER70S-6", unidad: "kg", base: 58, trend: 0.0004, cover: 6.4 },
  { id: "DISCO_CORTE", nombre: "Disco de corte 7\"", unidad: "pzas", base: 36, trend: -0.0002, cover: 9.6 },
  { id: "GAS_ARGON", nombre: "Gas argón", unidad: "m³", base: 24, trend: 0.0006, cover: 12.5 },
  { id: "PINTURA_EPOXICA", nombre: "Pintura epóxica", unidad: "L", base: 18, trend: 0.0003, cover: 21 },
  { id: "TORNILLO_M12", nombre: "Tornillo M12 x 50", unidad: "pzas", base: 220, trend: 0, cover: 28 },
  { id: "LIJA_80", nombre: "Lija grano 80", unidad: "pzas", base: 64, trend: -0.0004, cover: 46 },
];

const HISTORY_DAYS = 120;
const WEEKDAY = [0.45, 1.08, 1.12, 1.1, 1.06, 1.04, 0.8]; // dom..sáb

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

export function mockCurrent(): InsumoActual[] {
  return SEEDS.map((s) => {
    const avg = avgForecast(s);
    return {
      id_insumo: s.id,
      nombre: s.nombre,
      unidad: s.unidad,
      stock_actual: stockFor(s),
      consumo_diario_prom: Math.round(avg * 10) / 10,
      dias_cobertura: daysLeft(s),
    };
  });
}

export function mockAlerts(): Alerta[] {
  const alerts: Alerta[] = [];
  for (const s of SEEDS) {
    const dias = daysLeft(s);
    if (dias > 14) continue;
    alerts.push({
      id_insumo: s.id,
      nombre: s.nombre,
      unidad: s.unidad,
      estado: dias <= 7 ? "Crítico" : "Advertencia",
      stock_actual: stockFor(s),
      dias_restantes: dias,
      fecha_agotamiento: iso(addDays(today(), dias)),
    });
  }
  return alerts.sort((a, b) => a.dias_restantes - b.dias_restantes);
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
