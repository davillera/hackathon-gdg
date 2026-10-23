const dateShort = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const dateLong = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" });
const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

// Las fechas llegan como YYYY-MM-DD; se fijan a mediodía local para evitar saltos de zona horaria.
export function parseDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export const fmtDateShort = (iso: string) => dateShort.format(parseDate(iso)).replace(".", "");
export const fmtDateLong = (iso: string) => dateLong.format(parseDate(iso)).replace(/\./g, "");
export const fmtInt = (n: number) => number.format(n);
export const fmtDec = (n: number) => decimal.format(n);

export function fmtDays(n: number): string {
  if (n < 1) return "hoy";
  if (n === 1) return "1 día";
  return `${fmtInt(n)} días`;
}
