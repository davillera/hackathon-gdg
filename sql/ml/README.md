# sql/ml/

**Responsable:** equipo de ML

Entrenamiento, evaluación y diagnóstico del modelo `ARIMA_PLUS`. Se corre en este orden:

| Archivo | Contenido |
|---|---|
| `00_setup.sql` | Tablas `ml_backtest_points` y `ml_experiments`, y el procedimiento `sp_backtest(experimento, opciones)` |
| `01_experiments.sql` | Backtest de 3 configuraciones (sin limpieza, por defecto, feriados `CO`) y su comparación |
| `02_train_final.sql` | Backtest de la configuración ganadora, modelo final `inventory_forecast_model` y tablas `model_metrics` y `model_metrics_by_item` |
| `03_diagnostics.sql` | `ML.ARIMA_EVALUATE`, `ML.EXPLAIN_FORECAST` y real vs. pronóstico del backtest |

## Métrica de precisión

**MAPE semanal:** en las últimas 4 semanas del histórico (que el modelo de evaluación no ve), se suman el consumo real y el pronosticado en bloques de 7 días y se calcula el error porcentual de cada bloque. `precision = 100 − MAPE`.

Se usa en bloques semanales y no por día porque los domingos el consumo es casi 0 y eso dispara el MAPE diario sin que el pronóstico sea malo. Además, la decisión de compra se toma por semana, no por día. El sMAPE diario de `ML.EVALUATE` queda como referencia en `ml_experiments`.

## Salidas

| Objeto | Consumidor |
|---|---|
| `inventory_forecast_model` | Persona A (`sql/serving/01_forecast_30d.sql`) |
| `model_metrics` (una fila: `modelo`, `mape`, `precision`, `evaluado_en`) | Backend del Equipo 2 (`/api/model/metrics`) |
| `model_metrics_by_item` | Presentación y diagnóstico |
| `eval_*` | Modelos de backtest; se pueden borrar al terminar |
