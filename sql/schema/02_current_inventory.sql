CREATE OR REPLACE TABLE `supply_chain.current_inventory` (
  id_insumo STRING,
  nombre STRING,
  unidad STRING,
  stock_actual FLOAT64,
  punto_reorden FLOAT64,
  lead_time_dias INT64,
  fecha_corte DATE
);