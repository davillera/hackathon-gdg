-- Procedimiento de backtest del equipo de ML. Correr una vez (o cada vez que cambie).
--
-- No usa INSERT ni DELETE: el modo gratuito de BigQuery (sandbox, sin facturación) no
-- permite DML. Cada experimento escribe sus propias tablas y dos vistas las unen:
--   ml_bt_points_<experimento>  →  vista ml_backtest_points (real vs. pronóstico por día)
--   ml_bt_metrics_<experimento> →  vista ml_experiments     (métricas por insumo)

-- Backtest de una configuración de ARIMA_PLUS.
--
-- 1. Entrena `supply_chain.eval_<experimento>` sin las últimas 4 semanas del histórico.
-- 2. Pronostica esas 4 semanas y guarda real vs. pronóstico en ml_bt_points_<experimento>.
-- 3. Calcula el MAPE semanal por insumo: se suman real y pronóstico en 4 bloques
--    de 7 días (cada bloque tiene un día de cada tipo, así los domingos con consumo
--    casi nulo no inflan el error) y se promedia el error porcentual de los bloques.
-- 4. Agrega las métricas diarias de ML.EVALUATE como referencia y guarda todo en
--    ml_bt_metrics_<experimento>.
--
-- p_experimento: nombre corto en minúsculas, se usa como sufijo del modelo y las tablas.
-- p_opciones:    opciones extra de ARIMA_PLUS, por ejemplo "holiday_region='CO'".
CREATE OR REPLACE PROCEDURE `supply_chain.sp_backtest`(p_experimento STRING, p_opciones STRING)
BEGIN
  DECLARE dias_test INT64 DEFAULT 28;
  DECLARE fin_test DATE DEFAULT (SELECT MAX(fecha) FROM `supply_chain.historical_inventory`);
  DECLARE inicio_test DATE DEFAULT DATE_SUB(fin_test, INTERVAL dias_test - 1 DAY);

  IF NOT REGEXP_CONTAINS(p_experimento, r'^[a-z0-9_]+$') THEN
    RAISE USING MESSAGE = 'experimento solo admite minúsculas, números y guion bajo';
  END IF;

  EXECUTE IMMEDIATE FORMAT("""
    CREATE OR REPLACE MODEL `supply_chain.eval_%s`
    OPTIONS(
      model_type = 'ARIMA_PLUS',
      time_series_timestamp_col = 'fecha',
      time_series_data_col = 'cantidad_consumida',
      time_series_id_col = 'id_insumo',
      data_frequency = 'DAILY',
      horizon = %d,
      %s
    ) AS
    SELECT fecha, id_insumo, cantidad_consumida
    FROM `supply_chain.historical_inventory`
    WHERE fecha < %T
  """, p_experimento, dias_test, p_opciones, inicio_test);

  EXECUTE IMMEDIATE FORMAT("""
    CREATE OR REPLACE TABLE `supply_chain.ml_bt_points_%s` AS
    SELECT %T AS experimento,
           h.id_insumo,
           h.fecha,
           h.cantidad_consumida AS real,
           GREATEST(0, f.forecast_value) AS pronostico,
           CURRENT_TIMESTAMP() AS ejecutado_en
    FROM ML.FORECAST(MODEL `supply_chain.eval_%s`, STRUCT(%d AS horizon)) AS f
    JOIN `supply_chain.historical_inventory` AS h
      ON h.id_insumo = f.id_insumo AND h.fecha = DATE(f.forecast_timestamp)
    WHERE h.fecha BETWEEN %T AND %T
  """, p_experimento, p_experimento, p_experimento, dias_test, inicio_test, fin_test);

  EXECUTE IMMEDIATE FORMAT("""
    CREATE OR REPLACE TABLE `supply_chain.ml_bt_metrics_%s` AS
    WITH bloques AS (
      SELECT id_insumo,
             DIV(DATE_DIFF(fecha, %T, DAY), 7) AS bloque,
             SUM(real) AS real,
             SUM(pronostico) AS pronostico
      FROM `supply_chain.ml_bt_points_%s`
      GROUP BY id_insumo, bloque
    ),
    semanal AS (
      SELECT id_insumo,
             AVG(SAFE_DIVIDE(ABS(real - pronostico), real)) * 100 AS mape_semanal
      FROM bloques
      GROUP BY id_insumo
    ),
    diario AS (
      SELECT id_insumo,
             symmetric_mean_absolute_percentage_error AS smape_diario,
             mean_absolute_error AS mae_diario
      FROM ML.EVALUATE(
        MODEL `supply_chain.eval_%s`,
        (SELECT fecha, id_insumo, cantidad_consumida
         FROM `supply_chain.historical_inventory`
         WHERE fecha BETWEEN %T AND %T),
        STRUCT(TRUE AS perform_aggregation, %d AS horizon))
    )
    SELECT %T AS experimento,
           %T AS opciones,
           s.id_insumo,
           s.mape_semanal,   -- métrica oficial: MAPE (%%) sobre bloques de 7 días
           d.smape_diario,   -- referencia: sMAPE diario de ML.EVALUATE
           d.mae_diario,     -- referencia: MAE diario de ML.EVALUATE
           %T AS inicio_test,
           %T AS fin_test,
           CURRENT_TIMESTAMP() AS ejecutado_en
    FROM semanal AS s
    LEFT JOIN diario AS d USING (id_insumo)
  """, p_experimento, inicio_test, p_experimento, p_experimento, inicio_test, fin_test, dias_test,
       p_experimento, p_opciones, inicio_test, fin_test);

  -- Vistas que unen todos los experimentos (se recrean para incluir las tablas nuevas).
  CREATE OR REPLACE VIEW `supply_chain.ml_backtest_points` AS
  SELECT * FROM `supply_chain.ml_bt_points_*`;

  CREATE OR REPLACE VIEW `supply_chain.ml_experiments` AS
  SELECT * FROM `supply_chain.ml_bt_metrics_*`;
END;
