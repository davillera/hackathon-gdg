"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAlerts, getCurrent, getForecast, getHistory, getMetrics, isDemo } from "@/lib/api";
import { fmtDateLong, fmtDays, fmtInt } from "@/lib/format";
import { STATUS, estadoPorDias } from "@/lib/status";
import type { Alerta, ForecastResponse, HistoryResponse, InsumoActual, ModelMetrics } from "@/lib/types";
import { AlertsTable } from "./AlertsTable";
import { ChartLegend, ForecastChart } from "./ForecastChart";
import { Kpis } from "./Kpis";
import { Sidebar } from "./Sidebar";

interface Overview {
  current: InsumoActual[];
  alerts: Alerta[];
  metrics: ModelMetrics;
}

function useAsync<T>(load: (() => Promise<T>) | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: load !== null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (e: unknown) =>
        !cancelled &&
        setState({
          data: null,
          error: e instanceof Error ? e.message : "No se pudo conectar con la API.",
          loading: false,
        }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] bg-crit px-4 py-3 text-white">
      <p className="font-medium">No pudimos cargar los datos. {message}</p>
      <button type="button" onClick={onRetry} className="min-h-10 rounded-[3px] bg-white px-4 font-semibold text-ink">
        Reintentar
      </button>
    </div>
  );
}

export function Dashboard({ userLabel, onSignOut }: { userLabel?: string; onSignOut?: () => void }) {
  const loadOverview = useCallback(
    async (): Promise<Overview> => {
      const [current, alerts, metrics] = await Promise.all([getCurrent(), getAlerts(), getMetrics()]);
      return { current, alerts, metrics };
    },
    [],
  );
  const overview = useAsync(loadOverview);
  const alerts = overview.data?.alerts ?? null;
  const current = overview.data?.current ?? null;

  const [selected, setSelected] = useState<string | null>(null);
  // Por defecto se muestra el insumo que se agota primero.
  const activeId = selected ?? alerts?.[0]?.id_insumo ?? current?.[0]?.id_insumo ?? null;

  const loadSeries = useMemo(
    () =>
      activeId
        ? async () => {
            const [f, h] = await Promise.all([getForecast(activeId), getHistory(activeId)]);
            return { f, h } as { f: ForecastResponse; h: HistoryResponse };
          }
        : null,
    [activeId],
  );
  const series = useAsync(loadSeries);

  const item = current?.find((c) => c.id_insumo === activeId);
  const alert = alerts?.find((a) => a.id_insumo === activeId);
  const estado = item ? (alert?.estado ?? estadoPorDias(item.dias_cobertura)) : null;

  return (
    <div className="md:flex">
      <Sidebar demo={isDemo} userLabel={userLabel} onSignOut={onSignOut} />

      <main className="min-w-0 flex-1 space-y-8 px-4 py-6 md:px-8 md:py-8">
        {overview.error && <ErrorNote message={overview.error} onRetry={overview.retry} />}

        <section id="resumen" className="scroll-mt-4 space-y-4">
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-semibold leading-tight">
            Estado del inventario
          </h1>
          <Kpis
            current={current}
            alerts={alerts}
            metrics={overview.data?.metrics ?? null}
            loading={overview.loading}
          />
        </section>

        <section id="pronostico" className="scroll-mt-4 space-y-4 bg-surface px-4 py-5 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold leading-tight">
                {item ? item.nombre : "Consumo y pronóstico"}
              </h2>
              {item && estado && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-ink-2">
                  <span className={`num rounded-[2px] px-2 py-0.5 text-[13px] font-semibold ${STATUS[estado].bg} ${STATUS[estado].fg}`}>
                    {estado}
                  </span>
                  <span>
                    Stock <span className="num font-semibold text-ink">{fmtInt(item.stock_actual)}</span> {item.unidad}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {alert
                      ? `se agota ${alert.dias_restantes < 1 ? "hoy" : `en ${fmtDays(alert.dias_restantes)}`}, ${fmtDateLong(alert.fecha_agotamiento)}`
                      : `cubre ${fmtDays(item.dias_cobertura)} de consumo`}
                  </span>
                </p>
              )}
            </div>
          </div>

          {current && (
            <div role="group" aria-label="Insumo" className="flex flex-wrap gap-2">
              {current.map((c) => {
                const st = STATUS[alerts?.find((a) => a.id_insumo === c.id_insumo)?.estado ?? estadoPorDias(c.dias_cobertura)];
                const on = c.id_insumo === activeId;
                return (
                  <button
                    key={c.id_insumo}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected(c.id_insumo)}
                    className={`flex min-h-10 items-center gap-2 rounded-[3px] border px-3 text-[14px] font-medium ${
                      on ? "border-ink bg-ink text-white" : "border-rule bg-white/50 hover:border-ink"
                    }`}
                  >
                    <span className={`block size-3 rounded-[2px] ${st.bg}`} aria-hidden="true" />
                    {c.nombre}
                  </button>
                );
              })}
            </div>
          )}

          {series.error ? (
            <ErrorNote message={series.error} onRetry={series.retry} />
          ) : series.loading || !series.data || !item ? (
            <div className="skeleton h-[320px] w-full rounded-[3px] md:h-[360px]" aria-label="Cargando pronóstico" />
          ) : (
            <ForecastChart
              history={series.data.h.history}
              forecast={series.data.f.forecast}
              unidad={item.unidad}
              nombre={item.nombre}
              agotamiento={alert?.fecha_agotamiento}
            />
          )}
          <ChartLegend unidad={item?.unidad ?? "u"} />
        </section>

        <section id="alertas" className="scroll-mt-4 space-y-3 bg-surface py-5">
          <div className="px-4 md:px-6">
            <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold leading-tight">
              Alertas de agotamiento
            </h2>
            <p className="mt-1 text-ink-2">Ordenadas por la fecha en que se agota cada insumo.</p>
          </div>
          <div className="md:px-2">
            <AlertsTable
              alerts={alerts}
              loading={overview.loading}
              selected={activeId ?? ""}
              onSelect={(id) => {
                setSelected(id);
                document.getElementById("pronostico")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
