-- 1. Conteo, rango y unicidad
SELECT id_insumo, COUNT(*) AS filas, MIN(fecha) AS desde, MAX(fecha) AS hasta,
       COUNT(DISTINCT fecha) = COUNT(*) AS fechas_unicas
FROM `supply_chain.historical_inventory`
GROUP BY id_insumo ORDER BY id_insumo;

-- 2. Sin negativos ni nulos
SELECT COUNTIF(cantidad_consumida < 0) AS negativos,
       COUNTIF(cantidad_consumida IS NULL OR fecha IS NULL OR id_insumo IS NULL) AS nulos
FROM `supply_chain.historical_inventory`;

-- 3. Perfil semanal (domingo ≈ 5 % del lunes)
SELECT EXTRACT(DAYOFWEEK FROM fecha) AS dow, ROUND(AVG(cantidad_consumida), 1) AS promedio
FROM `supply_chain.historical_inventory`
WHERE id_insumo = 'ELECTRODO_6013'
GROUP BY dow ORDER BY dow;