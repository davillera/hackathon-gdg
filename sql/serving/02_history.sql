-- Últimos 90 días de consumo, para la línea sólida del gráfico principal.
CREATE OR REPLACE VIEW `supply_chain.v_history_90d` AS
SELECT
  id_insumo,
  fecha AS date,
  cantidad_consumida AS consumption
FROM `supply_chain.historical_inventory`
WHERE fecha > DATE_SUB((SELECT MAX(fecha) FROM `supply_chain.historical_inventory`), INTERVAL 90 DAY);
