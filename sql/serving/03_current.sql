-- Inventario actual con el consumo diario pronosticado y los días de cobertura.
--   consumo_diario_prom: promedio de predicted_consumption de los 30 días de forecast_30d.
--   dias_cobertura:      stock_actual / consumo_diario_prom.
CREATE OR REPLACE VIEW `supply_chain.v_current` AS
SELECT
  c.id_insumo,
  c.nombre,
  c.unidad,
  c.stock_actual,
  f.consumo_diario_prom,
  SAFE_DIVIDE(c.stock_actual, f.consumo_diario_prom) AS dias_cobertura
FROM `supply_chain.current_inventory` AS c
JOIN (
  SELECT id_insumo, AVG(predicted_consumption) AS consumo_diario_prom
  FROM `supply_chain.forecast_30d`
  GROUP BY id_insumo
) AS f USING (id_insumo);
