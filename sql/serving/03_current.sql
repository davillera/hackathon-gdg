-- Stock actual con consumo y cobertura pronosticados (/api/inventory/current).
-- Requiere 01_forecast_30d.sql.

CREATE OR REPLACE VIEW `supply_chain.v_current` AS
WITH consumo AS (
  SELECT id_insumo, AVG(predicted_consumption) AS consumo_diario_prom
  FROM `supply_chain.forecast_30d`
  GROUP BY id_insumo
)
SELECT c.id_insumo,
       c.nombre,
       c.unidad,
       c.stock_actual,
       ROUND(f.consumo_diario_prom, 2) AS consumo_diario_prom,
       ROUND(SAFE_DIVIDE(c.stock_actual, f.consumo_diario_prom), 1) AS dias_cobertura
FROM `supply_chain.current_inventory` AS c
LEFT JOIN consumo AS f USING (id_insumo);
