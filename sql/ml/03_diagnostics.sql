-- Diagnóstico del modelo final, para validar y para la presentación.
-- Requiere 02_train_final.sql.

-- 1. Qué detectó ARIMA_PLUS en cada serie: orden ARIMA, estacionalidades,
--    efecto de feriados, picos y cambios de nivel.
SELECT id_insumo,
       non_seasonal_p, non_seasonal_d, non_seasonal_q, has_drift,
       seasonal_periods, has_holiday_effect, has_spikes_and_dips, has_step_changes,
       ROUND(AIC, 1) AS aic
FROM ML.ARIMA_EVALUATE(MODEL `supply_chain.inventory_forecast_model`, STRUCT(FALSE AS show_all_candidate_models))
ORDER BY id_insumo;

-- Chequeos esperados según docs/data_spec.md:
--   - seasonal_periods incluye WEEKLY y YEARLY en todos los insumos.
--   - has_step_changes = TRUE en ALAMBRE_MIG_ER70S6 (+30 % desde 2026-03-01).
--   - has_spikes_and_dips = TRUE en los insumos con prob. de pico > 0.
--   - has_holiday_effect = TRUE si se usó holiday_region.

-- 2. Descomposición histórico + pronóstico de un insumo (tendencia, estacionalidad,
--    feriados). Sirve para el gráfico "qué aprendió el modelo".
SELECT DATE(time_series_timestamp) AS fecha,
       time_series_type,
       ROUND(time_series_data, 2) AS valor,
       ROUND(trend, 2) AS tendencia,
       ROUND(seasonal_period_weekly, 2) AS estacionalidad_semanal,
       ROUND(seasonal_period_yearly, 2) AS estacionalidad_anual,
       ROUND(holiday_effect, 2) AS efecto_feriado,
       ROUND(prediction_interval_lower_bound, 2) AS lower_bound,
       ROUND(prediction_interval_upper_bound, 2) AS upper_bound
FROM ML.EXPLAIN_FORECAST(
  MODEL `supply_chain.inventory_forecast_model`,
  STRUCT(30 AS horizon, 0.9 AS confidence_level))
WHERE id_insumo = 'ELECTRODO_6013'
ORDER BY fecha;

-- 3. Real vs. pronóstico del backtest final (gráfico de validación).
SELECT id_insumo, fecha, real, ROUND(pronostico, 2) AS pronostico
FROM `supply_chain.ml_backtest_points`
WHERE experimento = 'final'
ORDER BY id_insumo, fecha;

-- 4. Precisión por insumo, de mejor a peor.
SELECT * FROM `supply_chain.model_metrics_by_item` ORDER BY mape;
