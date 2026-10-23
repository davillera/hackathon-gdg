-- Tarjetas de KPIs del dashboard. Requiere 03_current.sql y 04_alerts.sql.
-- "Precisión del Modelo" sale de supply_chain.model_metrics (equipo de ML).

CREATE OR REPLACE VIEW `supply_chain.v_kpis` AS
SELECT
  (SELECT COUNT(*) FROM `supply_chain.v_alerts`) AS insumos_en_riesgo,
  (SELECT ROUND(AVG(dias_cobertura), 1) FROM `supply_chain.v_current`) AS dias_inventario_promedio;
