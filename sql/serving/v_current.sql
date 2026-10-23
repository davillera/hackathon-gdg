CREATE OR REPLACE VIEW `supply_chain.v_current` AS
SELECT 
  id_insumo,
  nombre,
  unidad,
  stock_actual,
  punto_reorden,
  lead_time_dias,
  fecha_corte
FROM `supply_chain.current_inventory`;