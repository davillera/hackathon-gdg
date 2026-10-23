-- Prueba de que todo lo que consulta el backend existe y responde.
-- Correr después de sql/serving/ y sql/ml/02_train_final.sql. Cada fila debe tener filas > 0.

SELECT 'forecast_30d' AS objeto, COUNT(*) AS filas FROM `supply_chain.forecast_30d`
UNION ALL SELECT 'v_history_90d', COUNT(*) FROM `supply_chain.v_history_90d`
UNION ALL SELECT 'v_current', COUNT(*) FROM `supply_chain.v_current`
UNION ALL SELECT 'v_alerts', COUNT(*) FROM `supply_chain.v_alerts`
UNION ALL SELECT 'v_kpis', COUNT(*) FROM `supply_chain.v_kpis`
UNION ALL SELECT 'model_metrics', COUNT(*) FROM `supply_chain.model_metrics`;
