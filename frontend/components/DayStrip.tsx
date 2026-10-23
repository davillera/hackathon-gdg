import { HORIZON_DAYS } from "@/lib/types";

/**
 * Una ficha por día del horizonte de 30 días.
 * Verde: hay stock. Amarillo: últimos 7 días de cobertura (ventana de compra).
 * Rojo con trama: sin stock. La trama evita depender solo del color.
 */
export function DayStrip({ diasRestantes, nombre }: { diasRestantes: number; nombre: string }) {
  const out = Math.min(diasRestantes, HORIZON_DAYS);
  const label =
    diasRestantes >= HORIZON_DAYS
      ? `${nombre}: stock suficiente durante los próximos ${HORIZON_DAYS} días`
      : `${nombre}: se queda sin stock en el día ${Math.max(out, 1)} de ${HORIZON_DAYS}`;

  return (
    <div role="img" aria-label={label} className="flex h-5 items-end gap-[2px]">
      {Array.from({ length: HORIZON_DAYS }, (_, i) => {
        const kind = i >= out ? "out" : i >= out - 7 ? "warn" : "ok";
        return (
          <span
            key={i}
            style={{ "--i": i } as React.CSSProperties}
            className={`chip block h-full w-[6px] rounded-[1px] ${
              kind === "out"
                ? "bg-crit bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgba(255,255,255,0.55)_2px_3px)]"
                : kind === "warn"
                  ? "bg-warn"
                  : "bg-ok"
            }`}
          />
        );
      })}
    </div>
  );
}
