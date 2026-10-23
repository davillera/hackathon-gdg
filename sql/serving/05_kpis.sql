-- Indicadores de las tarjetas. La precisión del modelo sale de la tabla model_metrics.
CREATE OR REPLACE VIEW `supply_chain.v_kpis` AS
SELECT
  (SELECT COUNT(*) FROM `supply_chain.v_alerts`) AS insumos_en_riesgo,
  (SELECT AVG(dias_cobertura) FROM `supply_chain.v_current`) AS dias_inventario_promedio;
