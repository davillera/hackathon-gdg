"use client";

import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDateLong, fmtDateShort, fmtDec } from "@/lib/format";
import type { ForecastPoint, HistoryPoint } from "@/lib/types";

const HISTORY_SHOWN = 60;

interface Row {
  date: string;
  consumo?: number;
  pronostico?: number;
  banda?: [number, number];
}

function buildRows(history: HistoryPoint[], forecast: ForecastPoint[]): Row[] {
  const rows: Row[] = history.slice(-HISTORY_SHOWN).map((h) => ({ date: h.date, consumo: h.consumption }));
  // El último punto histórico une la línea sólida con la punteada.
  const last = rows[rows.length - 1];
  if (last?.consumo !== undefined) {
    last.pronostico = last.consumo;
    last.banda = [last.consumo, last.consumo];
  }
  for (const f of forecast) {
    rows.push({ date: f.date, pronostico: f.predicted_consumption, banda: [f.lower_bound, f.upper_bound] });
  }
  return rows;
}

function ChartTooltip({ active, payload, unidad }: { active?: boolean; payload?: { payload: Row }[]; unidad: string }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-[3px] bg-rail px-3 py-2 text-[13px] text-rail-ink shadow-[0_4px_12px_rgba(14,14,16,0.3)]">
      <p className="num mb-1 font-semibold text-white">{fmtDateLong(row.date)}</p>
      {row.consumo !== undefined && (
        <p>
          Consumo: <span className="num font-semibold text-white">{fmtDec(row.consumo)}</span> {unidad}
        </p>
      )}
      {row.consumo === undefined && row.pronostico !== undefined && (
        <>
          <p>
            Pronóstico: <span className="num font-semibold text-white">{fmtDec(row.pronostico)}</span> {unidad}
          </p>
          {row.banda && (
            <p className="text-rail-dim">
              Intervalo: {fmtDec(row.banda[0])} a {fmtDec(row.banda[1])}
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface Props {
  history: HistoryPoint[];
  forecast: ForecastPoint[];
  unidad: string;
  nombre: string;
  agotamiento?: string;
}

export function ForecastChart({ history, forecast, unidad, nombre, agotamiento }: Props) {
  const rows = useMemo(() => buildRows(history, forecast), [history, forecast]);
  const hoy = history[history.length - 1]?.date;
  const inForecast = agotamiento && forecast.some((f) => f.date === agotamiento);

  return (
    <div
      className="h-[320px] w-full md:h-[360px]"
      role="img"
      aria-label={`Gráfico de consumo histórico y pronóstico a ${forecast.length} días de ${nombre}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#b3b9b5" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDateShort}
            tick={{ fill: "#3a3f42", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#3a3f42" }}
            minTickGap={36}
          />
          <YAxis
            tick={{ fill: "#3a3f42", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => String(Math.round(v))}
          />
          <Tooltip content={<ChartTooltip unidad={unidad} />} cursor={{ stroke: "#0e0e10", strokeWidth: 1 }} />
          <Area dataKey="banda" stroke="none" fill="#0e4c92" fillOpacity={0.16} isAnimationActive={false} activeDot={false} />
          <Line
            dataKey="consumo"
            stroke="#0e0e10"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#0e0e10" }}
            isAnimationActive={false}
          />
          <Line
            dataKey="pronostico"
            stroke="#0e4c92"
            strokeWidth={2.5}
            strokeDasharray="7 5"
            dot={false}
            activeDot={{ r: 4, fill: "#0e4c92" }}
            isAnimationActive={false}
          />
          {hoy && (
            <ReferenceLine
              x={hoy}
              stroke="#0e0e10"
              strokeWidth={1}
              label={{ value: "Hoy", position: "insideTopLeft", dx: -4, fill: "#0e0e10", fontSize: 12, fontWeight: 600 }}
            />
          )}
          {inForecast && (
            <ReferenceLine
              x={agotamiento}
              stroke="#cc0605"
              strokeWidth={2}
              label={{ value: "Se agota", position: "insideTopRight", dx: 6, fill: "#cc0605", fontSize: 12, fontWeight: 600 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ unidad }: { unidad: string }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-2">
      <li className="flex items-center gap-2">
        <svg width="28" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="28" y2="4" stroke="#0e0e10" strokeWidth="2" />
        </svg>
        Consumo histórico ({unidad}/día)
      </li>
      <li className="flex items-center gap-2">
        <svg width="28" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="28" y2="4" stroke="#0e4c92" strokeWidth="2.5" strokeDasharray="7 5" />
        </svg>
        Pronóstico a 30 días
      </li>
      <li className="flex items-center gap-2">
        <span className="block h-3 w-7 bg-forecast/20" aria-hidden="true" />
        Intervalo de confianza 95 %
      </li>
    </ul>
  );
}
