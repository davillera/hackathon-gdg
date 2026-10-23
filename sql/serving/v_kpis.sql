CREATE OR REPLACE VIEW `supply_chain.v_kpis` AS
SELECT 
  COUNT(DISTINCT id_insumo) AS total_insumos,
  SUM(CASE WHEN stock_actual <= punto_reorden THEN 1 ELSE 0 END) AS insumos_criticos,
  SUM(CASE WHEN stock_actual > punto_reorden AND stock_actual <= (punto_reorden * 1.2) THEN 1 ELSE 0 END) AS insumos_advertencia
FROM `supply_chain.current_inventory`;