"use client";

import { useState } from "react";
import { DayStrip } from "./DayStrip";
import { fmtDateLong, fmtDays, fmtInt } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { Alerta, PurchaseOrder } from "@/lib/types";

interface Props {
  alerts: Alerta[] | null;
  loading: boolean;
  selected: string;
  onSelect: (id: string) => void;
  orders: Record<string, PurchaseOrder>;
  onOrder: (id: string) => Promise<void>;
}

const COLS =
  "md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1fr)_248px_168px] md:items-center md:gap-4";

export function AlertsTable({ alerts, loading, selected, onSelect, orders, onOrder }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});

  async function emit(id: string) {
    setPending(id);
    setFailed(({ [id]: _, ...rest }) => rest);
    try {
      await onOrder(id);
    } catch (e) {
      setFailed((f) => ({ ...f, [id]: e instanceof Error ? e.message : "No se pudo emitir la orden." }));
    } finally {
      setPending(null);
    }
  }

  return (
    <div role="table" aria-label="Alertas de agotamiento" className="text-[14px]">
      <div role="rowgroup" className="max-md:sr-only">
        <div
          role="row"
          className={`${COLS} border-b border-ink px-4 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-2`}
        >
          <span role="columnheader">Insumo</span>
          <span role="columnheader">Estado</span>
          <span role="columnheader">Stock</span>
          <span role="columnheader">Se agota</span>
          <span role="columnheader">Próximos 30 días</span>
          <span role="columnheader">Acción</span>
        </div>
      </div>
      <div role="rowgroup">
        {loading &&
          Array.from({ length: 4 }, (_, i) => (
            <div key={i} role="row" className="border-b border-rule px-4 py-4">
              <div className="skeleton h-6 w-full rounded-[2px]" />
            </div>
          ))}
        {!loading && alerts?.length === 0 && (
          <p className="px-4 py-10 text-center text-ink-2">Ningún insumo está en riesgo en los próximos 14 días.</p>
        )}
        {!loading &&
          alerts?.map((a) => {
            const st = STATUS[a.estado];
            const done = orders[a.id_insumo];
            const isSel = a.id_insumo === selected;
            const dias = fmtDays(a.dias_restantes);
            return (
              <div
                key={a.id_insumo}
                role="row"
                aria-current={isSel ? "true" : undefined}
                className={`${COLS} grid grid-cols-2 gap-x-4 gap-y-2 border-b border-rule px-4 py-4 md:py-3.5 ${
                  isSel ? "bg-white/55" : ""
                }`}
              >
                <div role="cell" className="col-span-2 md:col-span-1">
                  <button
                    type="button"
                    onClick={() => onSelect(a.id_insumo)}
                    className="text-left font-semibold underline decoration-rule decoration-2 underline-offset-4 hover:decoration-forecast"
                  >
                    {a.nombre}
                  </button>
                  <p className="num text-[12px] text-ink-2">{a.id_insumo.replace(/_/g, " ")}</p>
                </div>
                <div role="cell">
                  <span
                    className={`num inline-flex rounded-[2px] px-2 py-0.5 text-[13px] font-semibold ${st.bg} ${st.fg}`}
                  >
                    {a.estado}
                  </span>
                </div>
                <div role="cell" className="num">
                  {fmtInt(a.stock_actual)} <span className="text-ink-2">{a.unidad}</span>
                </div>
                <div role="cell">
                  <p className="num font-semibold">{dias === "hoy" ? "Hoy" : `En ${dias}`}</p>
                  <p className="text-[12px] text-ink-2">{fmtDateLong(a.fecha_agotamiento)}</p>
                </div>
                <div role="cell" className="col-span-2 md:col-span-1">
                  <DayStrip diasRestantes={a.dias_restantes} nombre={a.nombre} />
                </div>
                <div role="cell" className="col-span-2 md:col-span-1">
                  {done ? (
                    <p className="flex min-h-10 items-center gap-2 font-semibold text-ok-ink" role="status">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
                      </svg>
                      <span>
                        Orden {done.id} emitida
                        <span className="block text-[12px] font-normal text-ink-2">
                          Sugerido: {fmtInt(done.cantidad_sugerida)} {done.unidad}
                        </span>
                      </span>
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={pending === a.id_insumo}
                        onClick={() => void emit(a.id_insumo)}
                        className="min-h-10 w-full rounded-[3px] bg-ink px-3 text-[13px] font-semibold text-white transition-colors hover:bg-forecast active:translate-y-px disabled:opacity-60 max-md:w-auto max-md:px-4"
                      >
                        {pending === a.id_insumo ? "Emitiendo…" : "Emitir orden de compra"}
                      </button>
                      {failed[a.id_insumo] && (
                        <p role="alert" className="mt-1 text-[12px] font-medium text-crit">
                          {failed[a.id_insumo]}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
