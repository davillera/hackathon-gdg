"use client";

import { STATUS } from "@/lib/status";
import type { Estado } from "@/lib/types";

const NAV = [
  { href: "#resumen", label: "Resumen" },
  { href: "#pronostico", label: "Pronóstico" },
  { href: "#alertas", label: "Alertas" },
];

const LEGEND: Estado[] = ["Crítico", "Advertencia", "OK"];

interface Props {
  demo: boolean;
  userLabel?: string;
  onSignOut?: () => void;
}

export function Sidebar({ demo, userLabel, onSignOut }: Props) {
  return (
    <aside className="on-rail bg-rail text-rail-ink md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col">
      <div className="flex items-center justify-between gap-4 px-5 py-4 md:block md:py-6">
        <p className="font-[family-name:var(--font-display)] text-[20px] font-semibold leading-tight text-white">
          Pronóstico de
          <br className="max-md:hidden" /> inventario
        </p>
        <span
          className={`mt-0 inline-block rounded-[2px] px-2 py-0.5 text-[12px] font-semibold md:mt-3 ${
            demo ? "bg-warn text-ink" : "bg-ok text-white"
          }`}
        >
          {demo ? "Datos de demostración" : "API conectada"}
        </span>
      </div>

      <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:pb-0">
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="block whitespace-nowrap rounded-[3px] px-3 py-2 text-[14px] font-medium text-rail-ink hover:bg-white/10 md:py-2.5"
          >
            {n.label}
          </a>
        ))}
      </nav>

      <div className="mt-auto hidden px-5 pb-5 md:block">
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-rail-dim">Código de color</p>
        <ul className="space-y-1.5 text-[13px]">
          {LEGEND.map((e) => (
            <li key={e} className="flex items-center gap-2.5">
              <span className={`block size-3.5 rounded-[2px] ${STATUS[e].bg}`} aria-hidden="true" />
              <span className="flex-1">{STATUS[e].label}</span>
              <span className="num text-rail-dim">{STATUS[e].ral}</span>
            </li>
          ))}
        </ul>
        {userLabel && (
          <div className="mt-5 border-t border-white/15 pt-4 text-[13px]">
            <p className="truncate text-rail-dim">{userLabel}</p>
            {onSignOut && (
              <button type="button" onClick={onSignOut} className="mt-1 font-semibold text-white underline underline-offset-4">
                Cerrar sesión
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
