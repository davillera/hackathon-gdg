-- Pronóstico de 30 días materializado desde el modelo final.
-- Volver a correr cada vez que el equipo de ML reentrene `inventory_forecast_model`.
-- Todos los valores se recortan a >= 0: ARIMA_PLUS puede dar negativos en domingos.
CREATE OR REPLACE TABLE `supply_chain.forecast_30d` AS
SELECT
  id_insumo,
  DATE(forecast_timestamp) AS date,
  GREATEST(0, forecast_value) AS predicted_consumption,
  GREATEST(0, prediction_interval_lower_bound) AS lower_bound,
  GREATEST(0, prediction_interval_upper_bound) AS upper_bound
FROM ML.FORECAST(
  MODEL `supply_chain.inventory_forecast_model`,
  STRUCT(30 AS horizon, 0.9 AS confidence_level)
);
