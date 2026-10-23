# Especificación de datos sintéticos

Responsable de implementarla: **Persona B**. Responsables de la especificación: equipo de ML.

El objetivo es que el histórico tenga patrones que `ARIMA_PLUS` pueda detectar (tendencia, estacionalidad semanal y anual, feriados, picos, cambios de nivel) y que el stock actual genere alertas convincentes en la demo.

## 1. Parámetros globales

| Parámetro | Valor |
|---|---|
| Rango de fechas | `2024-11-01` a `2026-10-31` (730 días, ambos incluidos) |
| Frecuencia | Diaria, una fila por (`fecha`, `id_insumo`) |
| Semilla | `np.random.default_rng(42)` |
| País de feriados | `CO` (debe coincidir con `holiday_region` del modelo) |
| Días faltantes | Eliminar al azar el 0.5 % de las filas (ARIMA_PLUS interpola huecos; así lo probamos) |

El pronóstico de 30 días empezará el `2026-11-01`, igual que el ejemplo del contrato de la API.

## 2. Catálogo de insumos

| `id_insumo` | `nombre` | `unidad` | Base diaria | Tendencia anual | Amplitud anual | CV ruido | Prob. pico | Entero | Notas |
|---|---|---|---|---|---|---|---|---|---|
| `ELECTRODO_6013` | Electrodo 6013 | kg | 45 | +15 % | 0.15 | 0.20 | 0.01 | no | Insumo estrella del gráfico principal |
| `ELECTRODO_7018` | Electrodo 7018 | kg | 30 | +10 % | 0.15 | 0.25 | 0.01 | no | |
| `ACERO_A36` | Acero A36 | kg | 850 | +20 % | 0.20 | 0.30 | 0.02 | no | Escenario crítico en la demo |
| `ACERO_INOX_304` | Acero Inox 304 | kg | 120 | +5 % | 0.10 | 0.35 | 0.02 | no | |
| `ALAMBRE_MIG_ER70S6` | Alambre MIG ER70S-6 | kg | 55 | +12 % | 0.15 | 0.20 | 0.01 | no | Cambio de nivel +30 % desde `2026-03-01` |
| `DISCO_CORTE_7` | Disco de corte 7" | unidades | 70 | +8 % | 0.10 | 0.20 | 0.01 | sí | |
| `DISCO_DESBASTE_7` | Disco de desbaste 7" | unidades | 40 | +8 % | 0.10 | 0.25 | 0.01 | sí | |
| `GAS_ARGON` | Gas argón | m3 | 25 | 0 % | 0.05 | 0.15 | 0.00 | no | Serie estable |
| `GAS_CO2` | Gas CO2 | m3 | 35 | +5 % | 0.05 | 0.15 | 0.00 | no | |
| `PINTURA_ANTICORROSIVA` | Pintura anticorrosiva | galones | 18 | −10 % | 0.30 | 0.40 | 0.02 | no | Estacionalidad anual fuerte |
| `TORNILLO_M10` | Tornillo M10 | unidades | 400 | +5 % | 0.10 | 0.45 | 0.03 | sí | Serie ruidosa |
| `GUANTES_SOLDADOR` | Guantes de soldador | pares | 12 | 0 % | 0.05 | 0.50 | 0.00 | sí | Serie ruidosa y de bajo volumen |

Los `id_insumo` quedan **congelados** después de esta especificación: el Equipo 2 los usa en el frontend.

## 3. Fórmula de consumo

Para cada insumo `i` y fecha `d`:

```
consumo = base_i
        × tendencia_i(d)
        × semanal(d)
        × anual_i(d)
        × evento(d)
        × ruido_i
        × pico_i
        × cambio_nivel_i(d)
```

Después: `max(0, consumo)` y redondeo (a entero si la columna "Entero" es "sí"; si no, a 2 decimales).

### Componentes

- **Tendencia (lineal):** `1 + g_i × t`, donde `t` = años transcurridos desde `2024-11-01` y `g_i` = tendencia anual.
- **Semanal:** multiplicador según el día de la semana.

  | Lun | Mar | Mié | Jue | Vie | Sáb | Dom |
  |---|---|---|---|---|---|---|
  | 1.00 | 1.05 | 1.05 | 1.00 | 0.90 | 0.45 | 0.05 |

- **Anual:** `1 + A_i × cos(2π × (día_del_año − 270) / 365.25)`. El pico cae a finales de septiembre (proyectos del 2.º semestre) y el valle a finales de marzo.
- **Eventos** (no se multiplican entre sí; se aplica el menor):
  - Cierre de fin de año, del 22 de diciembre al 2 de enero: × 0.25.
  - Semana Santa (`2025-04-13` a `2025-04-20` y `2026-03-29` a `2026-04-05`): × 0.50.
  - Feriados nacionales de `CO` (paquete `holidays`, `holidays.country_holidays("CO")`): × 0.10.
- **Ruido:** multiplicativo, `rng.gamma(shape=1/CV², scale=CV²)`. Tiene media 1 y el coeficiente de variación de la tabla.
- **Picos:** con probabilidad `p_i` por día, multiplicar por `rng.uniform(2, 4)`. Simulan pedidos grandes. Nunca en domingo ni en evento.
- **Cambio de nivel:** solo en `ALAMBRE_MIG_ER70S6`, × 1.30 desde `2026-03-01`. Sirve para mostrar `adjust_step_changes`.

**Importante para el backtest:** los últimos 30 días (octubre de 2026) siguen el mismo proceso que el resto, sin cambios de nivel ni eventos nuevos. Si no, la evaluación queda sesgada.

## 4. Tabla `historical_inventory`

| Columna | Tipo |
|---|---|
| `fecha` | `DATE` |
| `id_insumo` | `STRING` |
| `cantidad_consumida` | `FLOAT64` (también para los insumos enteros) |

Unas 8 700 filas (12 × 730 − 0.5 %). Se guarda también en `data/historical_inventory.csv`.

## 5. Tabla `current_inventory`

| Columna | Tipo | Cálculo |
|---|---|---|
| `id_insumo` | `STRING` | Catálogo |
| `nombre` | `STRING` | Catálogo |
| `unidad` | `STRING` | Catálogo |
| `stock_actual` | `FLOAT64` | `consumo_prom_28d × dias_cobertura` |
| `punto_reorden` | `FLOAT64` | `consumo_prom_28d × (lead_time_dias + 7)` |
| `lead_time_dias` | `INT64` | Tabla de abajo |
| `fecha_corte` | `DATE` | `2026-10-31` |

`consumo_prom_28d` = promedio diario de los últimos 28 días **calendario** (incluye fines de semana), redondeado igual que el consumo.

### Escenarios de demo

| `id_insumo` | `dias_cobertura` | `lead_time_dias` | Estado esperado |
|---|---|---|---|
| `ACERO_A36` | 4 | 7 | Crítico |
| `DISCO_CORTE_7` | 3 | 5 | Crítico |
| `GAS_ARGON` | 5 | 10 | Crítico |
| `ELECTRODO_6013` | 11 | 7 | Advertencia |
| `TORNILLO_M10` | 10 | 5 | Advertencia |
| `PINTURA_ANTICORROSIVA` | 12 | 7 | Advertencia |
| `ELECTRODO_7018` | 30 | 7 | OK |
| `ACERO_INOX_304` | 45 | 10 | OK |
| `ALAMBRE_MIG_ER70S6` | 25 | 7 | OK |
| `DISCO_DESBASTE_7` | 40 | 5 | OK |
| `GAS_CO2` | 35 | 10 | OK |
| `GUANTES_SOLDADOR` | 60 | 5 | OK |

Regla de alerta de referencia (la confirma el equipo de ML después del backtest):
- **Crítico:** días hasta agotarse ≤ `lead_time_dias`, o stock < consumo pronosticado de 7 días.
- **Advertencia:** días hasta agotarse ≤ `lead_time_dias` + 7.
- **OK:** el resto.

## 6. Carga a BigQuery

- `client.load_table_from_dataframe(df, "supply_chain.historical_inventory", job_config=...)` con el esquema explícito y `write_disposition="WRITE_TRUNCATE"`, para poder regenerar sin duplicar.
- Igual con `supply_chain.current_inventory`.
- El script acepta `--upload`. Sin el flag, solo escribe los CSV en `data/`.

## 7. Validaciones antes de avisar al equipo de ML

```sql
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
```

Además, hacer un gráfico rápido (matplotlib) por insumo y revisar a ojo que se vean la tendencia, la estacionalidad anual, el cierre de diciembre y el cambio de nivel del alambre MIG.
