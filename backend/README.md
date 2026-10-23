# backend/

API en FastAPI que sirve el dashboard. Solo lee de BigQuery; no entrena ni escribe modelos.

## Correr en local

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate      # en Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000           # http://localhost:8000/docs
pytest
```

Sin `GCP_PROJECT_ID` la API responde con datos de demostración que siguen `docs/data_spec.md` (mismos 12 `id_insumo`, mismos escenarios críticos/advertencia/OK). Con `GCP_PROJECT_ID` consulta BigQuery usando las credenciales de la cuenta activa (`gcloud auth application-default login` en local, la Service Account en Cloud Run).

Las variables se leen del `.env` de la raíz del repo (plantilla: `.env.example`). Las del entorno tienen prioridad.

| Variable | Descripción |
|---|---|
| `GCP_PROJECT_ID` | Proyecto de GCP. Vacío = datos de demostración. |
| `BQ_DATASET` | Dataset, por defecto `supply_chain`. |
| `CORS_ORIGINS` | Orígenes del frontend, separados por coma. |
| `CACHE_TTL_SECONDS` | Cache en memoria de las consultas, por defecto 60. |

## Endpoints

| Método | Ruta | Origen en BigQuery |
|---|---|---|
| `GET` | `/health` | n/a |
| `GET` | `/api/inventory/current` | `v_current` + estado desde `v_alerts` (lo que no está en `v_alerts` es `Estable`) |
| `GET` | `/api/inventory/forecast` | `forecast_30d` |
| `GET` | `/api/inventory/forecast/{item_id}` | `forecast_30d` |
| `GET` | `/api/inventory/history/{item_id}` | `v_history_90d` |
| `GET` | `/api/alerts` | `v_alerts` |
| `GET` | `/api/model/metrics` | `model_metrics` |
| `GET` / `POST` | `/api/purchase-orders` | En memoria (ver abajo) |

Las consultas son parametrizadas y el `item_id` se valida contra `current_inventory` antes de usarse.

## Contrato con el Equipo 1

El backend lee los objetos y columnas de `sql/serving/README.md` (sin renombrar nada) y `model_metrics` de `sql/ml/02_train_final.sql`:

| Objeto | Columnas |
|---|---|
| `v_current` | `id_insumo`, `nombre`, `unidad`, `stock_actual`, `consumo_diario_prom`, `dias_cobertura` |
| `v_alerts` | `id_insumo`, `nombre`, `unidad`, `estado` (`Crítico` o `Advertencia`), `stock_actual`, `dias_restantes`, `fecha_agotamiento` |
| `forecast_30d` | `id_insumo`, `date`, `predicted_consumption`, `lower_bound`, `upper_bound` |
| `v_history_90d` | `id_insumo`, `date`, `consumption` |
| `model_metrics` | `modelo`, `mape`, `precision`, `evaluado_en` (una fila) |

`v_kpis` no se consulta: el frontend calcula los indicadores con `/current`, `/alerts` y `/model/metrics`.

Estado: `Crítico` si se agota en 7 días o menos, `Advertencia` hasta 14, `Estable` si no (`app/rules.py` repite la regla para el modo demo). Las pruebas del mapeo con BigQuery usan un cliente falso; **falta correrlas contra el dataset real** cuando el Equipo 1 publique las vistas.

## Órdenes de compra

`POST /api/purchase-orders` con `{"id_insumo": "ACERO_A36"}` crea una orden con la cantidad que cubre 30 días de consumo más 7 de colchón, descontando el stock. Rechaza insumos sin riesgo (409) y no duplica la orden de un insumo que ya tiene una.

Las órdenes **viven en memoria** y se pierden al reiniciar la instancia. La Service Account del backend solo tiene permisos de lectura en BigQuery, así que persistirlas requiere decidir un almacén de escritura (Firestore, por ejemplo). Queda pendiente.

## Despliegue en Cloud Run

```bash
gcloud artifacts repositories create inventario --repository-format=docker --location=us-central1
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT/inventario/api backend
gcloud run deploy inventario-api \
  --image us-central1-docker.pkg.dev/$PROJECT/inventario/api \
  --region us-central1 \
  --service-account <service-account-del-backend> \
  --set-env-vars GCP_PROJECT_ID=$PROJECT,CORS_ORIGINS=https://<tu-sitio>.web.app \
  --allow-unauthenticated
```

La Service Account la crea el Equipo 1 (`infra/service_account.sh`) con `BigQuery Data Viewer` y `BigQuery Job User`.
