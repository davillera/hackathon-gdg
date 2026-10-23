-- Insumos en riesgo de agotarse (/api/alerts). Solo trae Crítico y Advertencia.
-- Requiere 01_forecast_30d.sql.
--
-- fecha_agotamiento: primer día del pronóstico en que el consumo acumulado supera el stock.
-- dias_restantes:    días desde fecha_corte hasta fecha_agotamiento (1 = día siguiente al corte).
-- estado:            Crítico si dias_restantes <= 7, Advertencia si <= 14 (igual que frontend/lib/status.ts).
-- Un insumo que no se agota en los 30 días del pronóstico es Estable y no aparece aquí.

CREATE OR REPLACE VIEW `supply_chain.v_alerts` AS
WITH acumulado AS (
  SELECT id_insumo,
         date,
         SUM(predicted_consumption) OVER (PARTITION BY id_insumo ORDER BY date) AS consumo_acumulado
  FROM `supply_chain.forecast_30d`
),
agotamiento AS (
  SELECT c.id_insumo,
         c.nombre,
         c.unidad,
         c.stock_actual,
         c.fecha_corte,
         MIN(IF(a.consumo_acumulado > c.stock_actual, a.date, NULL)) AS fecha_agotamiento
  FROM `supply_chain.current_inventory` AS c
  JOIN acumulado AS a USING (id_insumo)
  GROUP BY c.id_insumo, c.nombre, c.unidad, c.stock_actual, c.fecha_corte
),
clasificado AS (
  SELECT *,
         DATE_DIFF(fecha_agotamiento, fecha_corte, DAY) AS dias_restantes
  FROM agotamiento
  WHERE fecha_agotamiento IS NOT NULL
)
SELECT id_insumo,
       nombre,
       unidad,
       IF(dias_restantes <= 7, 'Crítico', 'Advertencia') AS estado,
       stock_actual,
       dias_restantes,
       fecha_agotamiento
FROM clasificado
WHERE dias_restantes <= 14;
