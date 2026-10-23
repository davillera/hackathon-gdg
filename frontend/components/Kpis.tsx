import { STATUS, estadoPorDias } from "@/lib/status";
import type { Alerta, InsumoActual, ModelMetrics } from "@/lib/types";
import { fmtDec } from "@/lib/format";

interface Props {
  current: InsumoActual[] | null;
  alerts: Alerta[] | null;
  metrics: ModelMetrics | null;
  loading: boolean;
}

function Ficha({
  swatch,
  ral,
  label,
  children,
  note,
  loading,
}: {
  swatch: string;
  ral: string;
  label: string;
  children: React.ReactNode;
  note: string;
  loading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[3px] bg-surface shadow-[0_1px_2px_rgba(14,14,16,0.18)]">
      <div className={`flex h-9 items-center justify-between px-3 ${swatch}`}>
        <span className="num text-[12px] font-semibold uppercase tracking-[0.08em]">{ral}</span>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="text-[13px] font-medium text-ink-2">{label}</p>
        {loading ? (
          <div className="skeleton mt-2 h-9 w-28 rounded-[2px]" aria-label="Cargando" />
        ) : (
          <p className="num mt-1 text-[34px] font-semibold leading-none">{children}</p>
        )}
        <p className="mt-2 min-h-5 text-[13px] text-ink-2">{loading ? "" : note}</p>
      </div>
    </div>
  );
}

export function Kpis({ current, alerts, metrics, loading }: Props) {
  const total = current?.length ?? 0;
  const atRisk = alerts?.length ?? 0;
  const crit = alerts?.filter((a) => a.estado === "Crítico").length ?? 0;
  const warn = atRisk - crit;
  const avgDays = total ? current!.reduce((s, c) => s + c.dias_cobertura, 0) / total : 0;

  const riskState = crit > 0 ? STATUS["Crítico"] : atRisk > 0 ? STATUS.Advertencia : STATUS.OK;
  const daysState = STATUS[estadoPorDias(avgDays)];

  return (
    <section aria-label="Indicadores" className="grid gap-3 md:grid-cols-3">
      <Ficha
        swatch={`${riskState.bg} ${riskState.fg}`}
        ral={riskState.ral}
        label="Insumos en riesgo de quiebre"
        loading={loading}
        note={`${crit} críticos · ${warn} en advertencia`}
      >
        {atRisk}
        <span className="ml-1.5 text-[18px] font-medium text-ink-2">de {total}</span>
      </Ficha>
      <Ficha
        swatch={`${daysState.bg} ${daysState.fg}`}
        ral={daysState.ral}
        label="Días de inventario promedio"
        loading={loading}
        note={`Promedio de ${total} insumos`}
      >
        {fmtDec(avgDays)}
        <span className="ml-1.5 text-[18px] font-medium text-ink-2">días</span>
      </Ficha>
      <Ficha
        swatch="bg-forecast text-white"
        ral="RAL 5010"
        label="Precisión del modelo"
        loading={loading}
        note={metrics ? `${metrics.modelo} · error medio ${fmtDec(metrics.mape)} %` : ""}
      >
        {metrics ? fmtDec(metrics.precision) : "–"}
        <span className="ml-1 text-[18px] font-medium text-ink-2">%</span>
      </Ficha>
    </section>
  );
}
