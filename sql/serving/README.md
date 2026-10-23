# sql/serving/

**Responsable:** Persona A

Tablas y vistas que consulta el backend del Equipo 2. El backend solo debería hacer `SELECT` sobre estos objetos. Los nombres de columna coinciden con los tipos del frontend (`frontend/lib/types.ts`), así el backend no tiene que renombrar nada.

| Archivo | Objeto | Columnas | Endpoint |
|---|---|---|---|
| `01_forecast_30d.sql` | Tabla `forecast_30d`, materializada desde `ML.FORECAST(..., STRUCT(30 AS horizon, 0.9 AS confidence_level))` | `id_insumo`, `date`, `predicted_consumption`, `lower_bound`, `upper_bound` | `/api/inventory/forecast`, `/api/inventory/forecast/{item_id}` |
| `02_history.sql` | Vista `v_history_90d` (últimos 90 días) | `id_insumo`, `date`, `consumption` | `/api/inventory/history/{item_id}` |
| `03_current.sql` | Vista `v_current` | `id_insumo`, `nombre`, `unidad`, `stock_actual`, `consumo_diario_prom`, `dias_cobertura` | `/api/inventory/current` |
| `04_alerts.sql` | Vista `v_alerts` (solo `Crítico` y `Advertencia`, ordenada por `fecha_agotamiento`) | `id_insumo`, `nombre`, `unidad`, `estado`, `stock_actual`, `dias_restantes`, `fecha_agotamiento` | `/api/alerts` |
| `05_kpis.sql` | Vista `v_kpis` | `insumos_en_riesgo`, `dias_inventario_promedio` | Tarjetas de KPIs |

La tabla `model_metrics` (`modelo`, `mape`, `precision`, `evaluado_en`, una sola fila) la genera el equipo de ML en `sql/ml/02_train_final.sql` y alimenta `/api/model/metrics`.

## Reglas

- **Todos los valores del pronóstico se recortan a ≥ 0** (`GREATEST(0, ...)`): ARIMA puede dar valores negativos en domingos.
- **`consumo_diario_prom`:** promedio de `predicted_consumption` de los 30 días de `forecast_30d`.
- **`dias_cobertura`:** `stock_actual / consumo_diario_prom`.
- **`dias_restantes`:** primer día `n` (1 = `2026-11-01`) en que `SUM(predicted_consumption) OVER (PARTITION BY id_insumo ORDER BY date)` supera `stock_actual`. Si no se agota en 30 días, queda en `NULL` y el estado es `Estable`.
- **`fecha_agotamiento`:** `fecha_corte + dias_restantes`.
- **`estado`:** `Crítico` si `dias_restantes` ≤ 7, `Advertencia` si ≤ 14, `Estable` si no. Es la misma regla que `frontend/lib/status.ts`.

`01_forecast_30d.sql` se vuelve a correr cada vez que el equipo de ML reentrena el modelo.
