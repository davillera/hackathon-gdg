-- 1. Validar fechas de la historia (debe ser 2024-11-01 a 2026-10-31)
SELECT MIN(fecha) as inicio, MAX(fecha) as fin, COUNT(DISTINCT fecha) as dias_totales
FROM `supply_chain.historical_inventory`;

-- 2. Validar que existan los 12 insumos y no haya consumos negativos
SELECT id_insumo, COUNT(*) as registros, MIN(cantidad_consumida) as min_consumo
FROM `supply_chain.historical_inventory`
GROUP BY id_insumo;

-- 3. Validar los estados del stock actual (3 Críticos, 3 Advertencia, 6 OK)
SELECT 
  CASE 
    WHEN stock_actual <= punto_reorden THEN 'Crítico'
    WHEN stock_actual <= punto_reorden * 1.2 THEN 'Advertencia'
    ELSE 'OK'
  END as estado,
  COUNT(*) as cantidad
FROM `supply_chain.current_inventory`
GROUP BY estado;