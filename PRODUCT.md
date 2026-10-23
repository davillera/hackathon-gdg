# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (React) + TailwindCSS + Recharts, as set in README.md. Deploy target: Firebase Hosting (static export). Firebase Auth is wanted from the first version. Backend (FastAPI on Cloud Run) is built by the same team later; until then the frontend runs on mock data shaped like the API contract in README.md.

## Users

Warehouse and purchasing managers (jefe de almacén / compras) at an industrial plant. They check daily which supplies (electrodos, acero, etc.) will run out, and decide what to order and when.

## Product Purpose

Predict depletion of industrial supplies from historical daily consumption. A time-series model (BigQuery ML ARIMA_PLUS) forecasts the next 30 days; the dashboard compares the forecast with current stock and flags items at risk (Crítico / Advertencia) so the user can issue a purchase order before a stoppage. Success: the user sees which supplies are at risk and acts in seconds.

## Positioning

Forecasting runs inside BigQuery with plain SQL, with no data exported to PyTorch or TensorFlow. The dashboard shows the model's uncertainty (confidence interval), not just a single line.

## Operating Context

Hackathon project (GDG); the jury weighs UI/UX heavily. Interface language is Spanish. Views, top to bottom: KPI cards ("Insumos en Riesgo de Quiebre", "Días de Inventario Promedio", "Precisión del Modelo"), a main chart (solid historical consumption line + dashed forecast line with confidence-interval area for 30 days, per insumo), and an alerts table sorted by projected depletion date with an "Emitir Orden de Compra" action.

## Capabilities and Constraints

- API contract (README.md): `GET /api/inventory/current`, `GET /api/inventory/forecast`, `GET /api/inventory/forecast/{item_id}`, `GET /api/alerts`. Forecast points: `date`, `predicted_consumption`, plus `lower_bound` and `upper_bound`.
- Alert states: `Crítico`, `Advertencia`.
- Loading and error states are required (BigQuery takes time).
- All data is synthetic until the data team delivers real tables; it must be labeled as demo data.
- "Emitir Orden de Compra" has no backend yet; undecided what it does beyond a front-end confirmation.

## Evidence on Hand

Info.txt and README.md only. No logo, no brand, no real data, no model accuracy figure. Do not invent a company name, customers, or benchmarks.

## Product Principles

1. Risk first: what runs out soonest is the first thing seen.
2. Show the uncertainty: forecast always comes with its interval.
3. One decision per row: every alert ends in an action.
4. Honest data: demo data is labeled; no invented claims.

## Accessibility & Inclusion

Status must never rely on color alone. Keyboard operable; readable contrast in a plant/office setting.
