-- Insumos que se agotan pronto. Solo Crítico (<= 7 días) y Advertencia (<= 14 días).
--   dias_restantes:    primer día n (1 = día siguiente a la fecha de corte) en que el consumo
--                      pronosticado acumulado supera el stock. Si no pasa en 30 días no hay fila (Estable).
--   fecha_agotamiento: fecha de corte + dias_restantes. La fecha de corte es el último día del histórico.
-- Es la misma regla que frontend/lib/status.ts y backend/app/rules.py.
CREATE OR REPLACE VIEW `supply_chain.v_alerts` AS
WITH corte AS (
  SELECT MAX(fecha) AS fecha_corte FROM `supply_chain.historical_inventory`
),
acumulado AS (
  SELECT
    f.id_insumo,
    DATE_DIFF(f.date, corte.fecha_corte, DAY) AS dia,
    SUM(f.predicted_consumption) OVER (PARTITION BY f.id_insumo ORDER BY f.date) AS consumo_acumulado
  FROM `supply_chain.forecast_30d` AS f
  CROSS JOIN corte
),
agotamiento AS (
  SELECT a.id_insumo, MIN(a.dia) AS dias_restantes
  FROM acumulado AS a
  JOIN `supply_chain.current_inventory` AS c USING (id_insumo)
  WHERE a.consumo_acumulado > c.stock_actual
  GROUP BY a.id_insumo
)
SELECT
  c.id_insumo,
  c.nombre,
  c.unidad,
  IF(g.dias_restantes <= 7, 'Crítico', 'Advertencia') AS estado,
  c.stock_actual,
  g.dias_restantes,
  DATE_ADD((SELECT fecha_corte FROM corte), INTERVAL g.dias_restantes DAY) AS fecha_agotamiento
FROM agotamiento AS g
JOIN `supply_chain.current_inventory` AS c USING (id_insumo)
WHERE g.dias_restantes <= 14
ORDER BY fecha_agotamiento, c.id_insumo;
