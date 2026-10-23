# Contrato de Datos - Equipo de Datos (Persona B)

Este documento define la estructura de las tablas de inventario que consumirán los modelos de ML y el frontend.

## Tabla: `historical_inventory`
| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `fecha` | DATE | Fecha del registro | 2023-11-01 |
| `id_insumo` | STRING | Identificador único del insumo | ELECTRODO_6013 |
| `cantidad_consumida` | FLOAT64 | Consumo diario simulado | 48.52 |

## Tabla: `current_inventory`
| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `id_insumo` | STRING | Identificador único del insumo | ACERO_A36 |
| `nombre` | STRING | Nombre comercial del insumo | Acero A36 |
| `unidad` | STRING | Unidad de medida | kg |
| `stock_actual` | FLOAT64 | Inventario disponible hoy | 3400.0 |
| `punto_reorden` | FLOAT64 | Límite para disparar alerta | 11900.0 |
| `lead_time_dias` | INT64 | Días que tarda el proveedor | 7 |
| `fecha_corte` | DATE | Fecha de cálculo (2026-10-31) | 2026-10-31 |