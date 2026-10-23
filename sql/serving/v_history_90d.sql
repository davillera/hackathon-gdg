CREATE OR REPLACE VIEW `supply_chain.v_history_90d` AS
SELECT 
  fecha,
  id_insumo,
  cantidad_consumida
FROM `supply_chain.historical_inventory`
WHERE fecha >= DATE_SUB(DATE('2026-10-31'), INTERVAL 90 DAY);