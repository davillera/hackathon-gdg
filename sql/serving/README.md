# sql/serving/

**Responsable:** Persona A

Tablas y vistas que consulta el backend del Equipo 2. El backend solo debería hacer `SELECT` sobre estos objetos.

| Archivo | Objeto | Alimenta |
|---|---|---|
| `01_forecast_30d.sql` | Tabla `forecast_30d` (`id_insumo`, `date`, `predicted_consumption`, `lower_bound`, `upper_bound`), materializada desde `ML.FORECAST` | `/api/inventory/forecast`, `/api/inventory/forecast/{item_id}` |
| `02_history_90d.sql` | Vista `v_history_90d` (últimos 90 días de consumo) | Línea sólida del gráfico principal |
| `03_alerts.sql` | Vista `v_alerts` (días hasta agotarse, fecha de agotamiento, estado `Crítico` / `Advertencia`) | `/api/alerts` |
| `04_kpis.sql` | Vista `v_kpis` (insumos en riesgo, días de inventario promedio, precisión del modelo) | Tarjetas de KPIs |

`01_forecast_30d.sql` se vuelve a correr cada vez que el equipo de ML reentrena el modelo. La regla de alertas está en `docs/data_spec.md` (sección 5) y la confirma el equipo de ML.
