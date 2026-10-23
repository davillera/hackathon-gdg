-- Tablas de resultados y procedimiento de backtest del equipo de ML.
-- Correr una vez (o cada vez que cambie el procedimiento). Es idempotente.

CREATE TABLE IF NOT EXISTS `supply_chain.ml_backtest_points` (
  experimento  STRING,
  id_insumo    STRING,
  fecha        DATE,
  real         FLOAT64,
  pronostico   FLOAT64,
  ejecutado_en TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `supply_chain.ml_experiments` (
  experimento   STRING,
  opciones      STRING,
  id_insumo     STRING,
  mape_semanal  FLOAT64,  -- métrica oficial: MAPE (%) sobre bloques de 7 días
  smape_diario  FLOAT64,  -- referencia: sMAPE diario de ML.EVALUATE
  mae_diario    FLOAT64,  -- referencia: MAE diario de ML.EVALUATE
  inicio_test   DATE,
  fin_test      DATE,
  ejecutado_en  TIMESTAMP
);

-- Backtest de una configuración de ARIMA_PLUS.
--
-- 1. Entrena `supply_chain.eval_<experimento>` sin las últimas 4 semanas del histórico.
-- 2. Pronostica esas 4 semanas y guarda real vs. pronóstico en ml_backtest_points.
-- 3. Calcula el MAPE semanal por insumo: se suman real y pronóstico en 4 bloques
--    de 7 días (cada bloque tiene un día de cada tipo, así los domingos con consumo
--    casi nulo no inflan el error) y se promedia el error porcentual de los bloques.
-- 4. Agrega las métricas diarias de ML.EVALUATE como referencia y guarda todo en ml_experiments.
--
-- p_experimento: nombre corto en minúsculas, se usa como sufijo del modelo.
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

  DELETE FROM `supply_chain.ml_backtest_points` WHERE experimento = p_experimento;
  DELETE FROM `supply_chain.ml_experiments` WHERE experimento = p_experimento;

  EXECUTE IMMEDIATE FORMAT("""
    INSERT INTO `supply_chain.ml_backtest_points`
      (experimento, id_insumo, fecha, real, pronostico, ejecutado_en)
    SELECT @experimento, h.id_insumo, h.fecha, h.cantidad_consumida,
           GREATEST(0, f.forecast_value), CURRENT_TIMESTAMP()
    FROM ML.FORECAST(MODEL `supply_chain.eval_%s`, STRUCT(%d AS horizon)) AS f
    JOIN `supply_chain.historical_inventory` AS h
      ON h.id_insumo = f.id_insumo AND h.fecha = DATE(f.forecast_timestamp)
    WHERE h.fecha BETWEEN @inicio_test AND @fin_test
  """, p_experimento, dias_test)
  USING p_experimento AS experimento, inicio_test AS inicio_test, fin_test AS fin_test;

  EXECUTE IMMEDIATE FORMAT("""
    INSERT INTO `supply_chain.ml_experiments`
    WITH bloques AS (
      SELECT id_insumo,
             DIV(DATE_DIFF(fecha, @inicio_test, DAY), 7) AS bloque,
             SUM(real) AS real,
             SUM(pronostico) AS pronostico
      FROM `supply_chain.ml_backtest_points`
      WHERE experimento = @experimento
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
         WHERE fecha BETWEEN @inicio_test AND @fin_test),
        STRUCT(TRUE AS perform_aggregation, %d AS horizon))
    )
    SELECT @experimento, @opciones, s.id_insumo, s.mape_semanal,
           d.smape_diario, d.mae_diario, @inicio_test, @fin_test, CURRENT_TIMESTAMP()
    FROM semanal AS s
    LEFT JOIN diario AS d USING (id_insumo)
  """, p_experimento, dias_test)
  USING p_experimento AS experimento, p_opciones AS opciones,
        inicio_test AS inicio_test, fin_test AS fin_test;
END;
