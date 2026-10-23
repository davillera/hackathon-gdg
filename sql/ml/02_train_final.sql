-- Entrena el modelo final y publica sus métricas.
-- Requiere 00_setup.sql. La configuración vive solo aquí: se usa tanto para el
-- backtest que mide la precisión como para el modelo que consume la Persona A.

-- Configuración ganadora de 01_experiments.sql (actualizar si gana otra).
-- Resultado con los datos de data/generate_data.py (semilla 42), MAPE semanal promedio:
--   sin_limpieza 6.56 %  |  por_defecto 8.25 %  |  feriados_co 9.88 %
DECLARE opciones STRING DEFAULT "clean_spikes_and_dips = FALSE, adjust_step_changes = FALSE";

-- 1. Backtest de la configuración final (precisión que se muestra en el dashboard).
CALL `supply_chain.sp_backtest`('final', opciones);

-- 2. Modelo final con todo el histórico. Lo usa sql/serving/01_forecast_30d.sql.
EXECUTE IMMEDIATE FORMAT("""
  CREATE OR REPLACE MODEL `supply_chain.inventory_forecast_model`
  OPTIONS(
    model_type = 'ARIMA_PLUS',
    time_series_timestamp_col = 'fecha',
    time_series_data_col = 'cantidad_consumida',
    time_series_id_col = 'id_insumo',
    data_frequency = 'DAILY',
    horizon = 60,
    %s
  ) AS
  SELECT fecha, id_insumo, cantidad_consumida
  FROM `supply_chain.historical_inventory`
""", opciones);

-- 3. Métricas por insumo (detalle para el equipo y la presentación).
CREATE OR REPLACE TABLE `supply_chain.model_metrics_by_item` AS
SELECT id_insumo,
       ROUND(mape_semanal, 1) AS mape,
       ROUND(GREATEST(0, 100 - mape_semanal), 1) AS `precision`,
       ROUND(smape_diario, 1) AS smape_diario,
       inicio_test,
       fin_test
FROM `supply_chain.ml_experiments`
WHERE experimento = 'final';

-- 4. Métrica global: una sola fila con la forma de /api/model/metrics
--    (modelo, mape, precision, evaluado_en). Promedio simple entre insumos.
CREATE OR REPLACE TABLE `supply_chain.model_metrics` AS
SELECT 'ARIMA_PLUS' AS modelo,
       ROUND(AVG(mape_semanal), 1) AS mape,
       ROUND(GREATEST(0, 100 - AVG(mape_semanal)), 1) AS `precision`,
       CURRENT_DATE() AS evaluado_en
FROM `supply_chain.ml_experiments`
WHERE experimento = 'final';

SELECT * FROM `supply_chain.model_metrics`;
