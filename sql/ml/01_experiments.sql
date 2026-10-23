-- Compara configuraciones de ARIMA_PLUS con el mismo backtest (últimas 4 semanas).
-- Requiere 00_setup.sql. Cada CALL entrena un modelo (1 a 5 min).

-- Sin limpieza de picos ni ajuste de cambios de nivel: línea base "ingenua".
CALL `supply_chain.sp_backtest`('sin_limpieza',
  "clean_spikes_and_dips = FALSE, adjust_step_changes = FALSE");

-- Valores por defecto de ARIMA_PLUS (limpia picos y ajusta cambios de nivel).
CALL `supply_chain.sp_backtest`('por_defecto', "auto_arima = TRUE");

-- Por defecto + feriados de Colombia.
CALL `supply_chain.sp_backtest`('feriados_co', "holiday_region = 'CO'");

-- Comparación: menor MAPE semanal promedio gana. Mirar también el peor insumo.
SELECT experimento,
       ANY_VALUE(opciones) AS opciones,
       ROUND(AVG(mape_semanal), 2) AS mape_semanal_prom,
       ROUND(100 - AVG(mape_semanal), 1) AS precision_prom,
       ROUND(MAX(mape_semanal), 2) AS mape_semanal_peor,
       ROUND(AVG(smape_diario), 2) AS smape_diario_prom
FROM `supply_chain.ml_experiments`
GROUP BY experimento
ORDER BY mape_semanal_prom;

-- Detalle por insumo de cada experimento.
SELECT id_insumo, experimento, ROUND(mape_semanal, 2) AS mape_semanal, ROUND(smape_diario, 2) AS smape_diario
FROM `supply_chain.ml_experiments`
ORDER BY id_insumo, mape_semanal;
