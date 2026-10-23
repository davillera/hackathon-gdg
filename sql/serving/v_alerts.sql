CREATE OR REPLACE VIEW `supply_chain.v_alerts` AS
SELECT 
  id_insumo,
  nombre,
  stock_actual,
  punto_reorden,
  CASE 
    WHEN stock_actual <= punto_reorden THEN 'Crítico'
    WHEN stock_actual <= (punto_reorden * 1.2) THEN 'Advertencia'
    ELSE 'Estable'
  END AS nivel_alerta
FROM `supply_chain.current_inventory`
WHERE stock_actual <= (punto_reorden * 1.2); -- Solo devuelve alertas críticas y advertencias