-- Validaciones de docs/data_spec.md (sección 7). Correr después de cargar los datos.

-- 1. Rango, conteo y unicidad por insumo.
--    Esperado: 12 insumos, de 2023-11-01 a 2026-10-31, unas 1 090 filas cada uno
--    (1 096 días menos el 0.5 % eliminado al azar) y fechas_unicas = TRUE.
SELECT id_insumo,
       COUNT(*) AS filas,
       MIN(fecha) AS desde,
       MAX(fecha) AS hasta,
       COUNT(DISTINCT fecha) = COUNT(*) AS fechas_unicas
FROM `supply_chain.historical_inventory`
GROUP BY id_insumo
ORDER BY id_insumo;

-- 2. Totales: 12 insumos, sin nulos ni negativos. Esperado: insumos = 12 y el resto en 0.
SELECT COUNT(DISTINCT id_insumo) AS insumos,
       COUNTIF(cantidad_consumida < 0) AS negativos,
       COUNTIF(cantidad_consumida IS NULL OR fecha IS NULL OR id_insumo IS NULL) AS nulos
FROM `supply_chain.historical_inventory`;

-- 3. Perfil semanal de ELECTRODO_6013. Esperado: domingo ≈ 5 % del lunes, sábado ≈ 45 %.
--    DAYOFWEEK: 1 = domingo, 2 = lunes, ..., 7 = sábado.
SELECT EXTRACT(DAYOFWEEK FROM fecha) AS dia_semana,
       ROUND(AVG(cantidad_consumida), 1) AS promedio
FROM `supply_chain.historical_inventory`
WHERE id_insumo = 'ELECTRODO_6013'
GROUP BY dia_semana
ORDER BY dia_semana;

-- 4. Escenarios de demo de current_inventory (sección 5).
--    dias_cobertura = stock_actual / consumo promedio de los últimos 28 días calendario.
--    Regla: Crítico ≤ 7 días, Advertencia ≤ 14, Estable el resto.
--    Esperado: coincide = TRUE en las 12 filas (3 Críticos, 3 Advertencia, 6 Estables).
WITH esperado AS (
  SELECT * FROM UNNEST([
    STRUCT('ACERO_A36' AS id_insumo, 'Crítico' AS estado_esperado),
    ('DISCO_CORTE_7', 'Crítico'),
    ('GAS_ARGON', 'Crítico'),
    ('ELECTRODO_6013', 'Advertencia'),
    ('TORNILLO_M10', 'Advertencia'),
    ('PINTURA_ANTICORROSIVA', 'Advertencia'),
    ('ELECTRODO_7018', 'Estable'),
    ('ACERO_INOX_304', 'Estable'),
    ('ALAMBRE_MIG_ER70S6', 'Estable'),
    ('DISCO_DESBASTE_7', 'Estable'),
    ('GAS_CO2', 'Estable'),
    ('GUANTES_SOLDADOR', 'Estable')
  ])
),
cobertura AS (
  SELECT c.id_insumo,
         c.stock_actual,
         SUM(h.cantidad_consumida) / 28 AS consumo_prom_28d
  FROM `supply_chain.current_inventory` AS c
  JOIN `supply_chain.historical_inventory` AS h
    ON h.id_insumo = c.id_insumo
   AND h.fecha BETWEEN DATE_SUB(c.fecha_corte, INTERVAL 27 DAY) AND c.fecha_corte
  GROUP BY c.id_insumo, c.stock_actual
),
estados AS (
  SELECT id_insumo,
         ROUND(SAFE_DIVIDE(stock_actual, consumo_prom_28d), 1) AS dias_cobertura,
         CASE
           WHEN SAFE_DIVIDE(stock_actual, consumo_prom_28d) <= 7 THEN 'Crítico'
           WHEN SAFE_DIVIDE(stock_actual, consumo_prom_28d) <= 14 THEN 'Advertencia'
           ELSE 'Estable'
         END AS estado
  FROM cobertura
)
SELECT e.id_insumo, s.dias_cobertura, s.estado, e.estado_esperado,
       s.estado = e.estado_esperado AS coincide
FROM esperado AS e
LEFT JOIN estados AS s USING (id_insumo)
ORDER BY e.estado_esperado, e.id_insumo;
