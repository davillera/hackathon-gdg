# sql/schema/

**Responsable:** Persona B

DDL de las tablas base del dataset `supply_chain` (el dataset ya existe).

| Archivo | Contenido |
|---|---|
| `01_historical_inventory.sql` | `CREATE TABLE` de `historical_inventory` (`fecha`, `id_insumo`, `cantidad_consumida`) |
| `02_current_inventory.sql` | `CREATE TABLE` de `current_inventory` (stock, punto de reorden, lead time, fecha de corte) |
| `99_validations.sql` | Consultas de validación de la sección 7 de `docs/data_spec.md` |

Los esquemas deben coincidir exactamente con `docs/data_spec.md`. Cualquier cambio de columnas se avisa al equipo de ML y al Equipo 2.
