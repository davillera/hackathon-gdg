# Equipo 1 (Datos y ML): responsabilidades

Tres frentes en paralelo. Personas A y B no dependen entre sí; el equipo de ML depende de los datos de B y entrega el modelo a A.

```
Persona B (datos)  ──►  Equipo de ML (modelo + métricas)  ──►  Persona A (serving)  ──►  Equipo 2 (API)
```

## Persona A: plataforma y serving

**Carpetas:** `infra/`, `sql/serving/`

- [x] Crear el dataset `supply_chain`.
- [ ] `infra/service_account.sh`: crear la Service Account del backend con los roles `BigQuery Data Viewer` y `BigQuery Job User`.
- [ ] `infra/test_access.sql`: consulta de prueba con esa Service Account. **No subir llaves JSON al repo.**
- [ ] `sql/serving/`: tablas y vistas con los nombres de columna exactos de `sql/serving/README.md`:
  - `forecast_30d` (tabla materializada desde `ML.FORECAST`),
  - `v_history_90d`,
  - `v_current`,
  - `v_alerts` (Crítico ≤ 7 días, Advertencia ≤ 14 días),
  - `v_kpis`.
- [ ] Probar las vistas con datos dummy mientras llega el modelo.
- [ ] Cuando el equipo de ML entregue el modelo final: correr `01_forecast_30d.sql` y avisar al Equipo 2 (punto de sincronización 2 del README).

## Persona B: crear la base (tablas y datos)

**Carpetas:** `data/`, `sql/schema/`, `docs/data_contract.md`
**Guía:** [`docs/data_spec.md`](data_spec.md)

- [ ] `sql/schema/`: crear `historical_inventory` y `current_inventory` con las columnas exactas de la especificación.
- [ ] `data/generate_data.py`: **3 años** de consumo diario (del `2023-11-01` al `2026-10-31`) para los 12 insumos, con la fórmula de la sección 3. Flag `--upload` para cargar a BigQuery con `WRITE_TRUNCATE`.
- [ ] Llenar `current_inventory` con los escenarios de la sección 5 (3 Críticos, 3 en Advertencia, 6 Estables).
- [ ] Correr las validaciones de la sección 7 (`sql/schema/99_validations.sql`) y revisar los gráficos.
- [ ] **Avisar al equipo de ML apenas la primera versión esté cargada (meta: 60 a 90 min).** Es lo que lo desbloquea.
- [ ] `docs/data_contract.md`: esquema y una fila de ejemplo de cada tabla y vista.
- [ ] JSON mock con los `id_insumo` reales para el Equipo 2.

## Equipo de ML

**Carpetas:** `sql/ml/`, `notebooks/`, `docs/data_spec.md`

- [x] Especificación de datos para B (`docs/data_spec.md`).
- [x] SQL de backtest, experimentos, entrenamiento final y diagnóstico (`sql/ml/`).
- [ ] Correr `00_setup.sql` y `01_experiments.sql` con los datos de B y elegir la configuración ganadora.
- [ ] Correr `02_train_final.sql`: modelo `inventory_forecast_model` y tabla `model_metrics` (precisión = 100 − MAPE semanal).
- [ ] Correr `03_diagnostics.sql` y preparar gráficos para la presentación (`notebooks/`).
- [ ] Entregar a A el modelo final y avisar que `model_metrics` está lista para `/api/model/metrics`.

## Reglas comunes

- Los `id_insumo` y los nombres de columna están congelados; cualquier cambio se avisa a los otros dos frentes y al Equipo 2.
- Hacer `git pull` antes de empezar y antes de cada push.
