-- Pronóstico de 30 días materializado para la API (/api/inventory/forecast).
-- Volver a correr cada vez que se reentrena inventory_forecast_model (sql/ml/02_train_final.sql).
-- Se materializa porque ML.FORECAST tarda varios segundos y la API lee esta tabla en cada request.

CREATE OR REPLACE TABLE `supply_chain.forecast_30d` AS
SELECT id_insumo,
       DATE(forecast_timestamp) AS date,
       -- ARIMA puede dar valores negativos en días de consumo casi nulo (domingos).
       ROUND(GREATEST(0, forecast_value), 2) AS predicted_consumption,
       ROUND(GREATEST(0, prediction_interval_lower_bound), 2) AS lower_bound,
       ROUND(GREATEST(0, prediction_interval_upper_bound), 2) AS upper_bound
FROM ML.FORECAST(
  MODEL `supply_chain.inventory_forecast_model`,
  STRUCT(30 AS horizon, 0.9 AS confidence_level));
