---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Surface brief: Dashboard de inventario (app/page.tsx)

Mode: Operate. Audience: jefe de almacén / compras. Task: ver qué insumos se agotan primero, entender el pronóstico y emitir una orden de compra. Content: datos sintéticos etiquetados como demo. Constraints: Next.js + Tailwind + Recharts, español, static export a Firebase Hosting, Firebase Auth.

## Direction contract

THESIS: Cada estado del inventario es un color industrial con código (carta RAL) y cada insumo lleva una tira de 30 fichas, una por día del horizonte; refusa el dashboard de tarjetas blancas con acento azul.
OWN-WORLD: Gris RAL 7035 de fondo, negro 9005 de tinta, azul genciana 5010 para pronóstico, rojo 3020 crítico, amarillo 1023 advertencia, verde 6024 estable; fichas de muestra con código, tipografía tipo DIN (Barlow Semi Condensed) con cifras tabulares.
STORY: El usuario ve en segundos cuántos insumos están en riesgo, qué insumo se agota primero y por qué (pronóstico con banda), y emite la orden desde la fila.
FIRST VIEWPORT: Barra lateral oscura a la izquierda con navegación y usuario; arriba tres KPIs como fichas con código; al centro gráfico histórico (línea sólida) y pronóstico (punteada con banda) del insumo elegido; debajo, tabla de alertas por fecha de agotamiento con la tira de 30 fichas y el botón Emitir orden de compra.
FORM: RAL Fan Deck (assigned, candidate 7 of 7), seed:f0d7de7f55fd1335. Raise from Tablero de salidas: tabla de columnas fijas, una fila por insumo, lo urgente arriba.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
