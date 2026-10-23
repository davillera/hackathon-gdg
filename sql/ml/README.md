# sql/ml/

**Responsable:** equipo de ML

Entrenamiento, evaluación y diagnóstico del modelo `ARIMA_PLUS`.

| Archivo | Contenido |
|---|---|
| `01_train.sql` | Entrena `supply_chain.inventory_forecast_model` con la configuración final |
| `02_backtest.sql` | Entrena `inventory_forecast_model_eval` hasta `2026-10-01` y evalúa contra octubre con `ML.EVALUATE` |
| `03_model_metrics.sql` | Calcula sMAPE por insumo y precisión (`100 − sMAPE`) en la tabla `model_metrics` |
| `04_experiments.sql` | Compara configuraciones (`holiday_region`, limpieza de picos, cambios de nivel) y las registra en `ml_experiments` |
| `05_diagnostics.sql` | `ML.ARIMA_EVALUATE` y `ML.EXPLAIN_FORECAST` (estacionalidad y tendencia detectadas) |

**Salida que se entrega a la Persona A:** el modelo `inventory_forecast_model` entrenado y la tabla `model_metrics`.
