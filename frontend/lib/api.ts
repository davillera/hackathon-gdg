import { mockAlerts, mockCreateOrder, mockCurrent, mockForecast, mockHistory, mockMetrics, mockOrders } from "./mock";
import type { Alerta, ForecastResponse, HistoryResponse, InsumoActual, ModelMetrics, PurchaseOrder } from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** true cuando no hay API configurada y se muestran datos de demostración. */
export const isDemo = BASE === "";

async function get<T>(path: string, fallback: () => T): Promise<T> {
  if (isDemo) {
    // Latencia simulada para ver los estados de carga mientras BigQuery procesa.
    await new Promise((r) => setTimeout(r, 450 + Math.random() * 400));
    return fallback();
  }
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`La API respondió ${res.status} en ${path}`);
  return (await res.json()) as T;
}

async function post<T>(path: string, body: unknown, fallback: () => T): Promise<T> {
  if (isDemo) {
    await new Promise((r) => setTimeout(r, 400));
    return fallback();
  }
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().then((j: { detail?: string }) => j.detail, () => undefined);
    throw new Error(detail ?? `La API respondió ${res.status} en ${path}`);
  }
  return (await res.json()) as T;
}

export const getCurrent = () => get<InsumoActual[]>("/api/inventory/current", mockCurrent);
export const getAlerts = () => get<Alerta[]>("/api/alerts", mockAlerts);
export const getMetrics = () => get<ModelMetrics>("/api/model/metrics", mockMetrics);
export const getForecast = (id: string) =>
  get<ForecastResponse>(`/api/inventory/forecast/${encodeURIComponent(id)}`, () => mockForecast(id));
export const getHistory = (id: string) =>
  get<HistoryResponse>(`/api/inventory/history/${encodeURIComponent(id)}`, () => mockHistory(id));
export const getOrders = () => get<PurchaseOrder[]>("/api/purchase-orders", mockOrders);
export const createOrder = (id: string) =>
  post<PurchaseOrder>("/api/purchase-orders", { id_insumo: id }, () => mockCreateOrder(id));
