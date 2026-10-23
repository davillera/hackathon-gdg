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

Sin `BQ_PROJECT` la API responde con datos de demostración que siguen `docs/data_spec.md` (mismos 12 `id_insumo`, mismos escenarios críticos/advertencia/OK). Con `BQ_PROJECT` consulta BigQuery usando las credenciales de la cuenta activa (`gcloud auth application-default login` en local, la Service Account en Cloud Run).

| Variable | Descripción |
|---|---|
| `BQ_PROJECT` | Proyecto de GCP. Vacío = datos de demostración. |
| `BQ_DATASET` | Dataset, por defecto `supply_chain`. |
| `CORS_ORIGINS` | Orígenes del frontend, separados por coma. |
| `CACHE_TTL_SECONDS` | Cache en memoria de las consultas, por defecto 60. |

## Endpoints

| Método | Ruta | Origen en BigQuery |
|---|---|---|
| `GET` | `/health` | n/a |
| `GET` | `/api/inventory/current` | `current_inventory` + consumo de 28 días de `historical_inventory` + `v_alerts` |
| `GET` | `/api/inventory/forecast` | `forecast_30d` |
| `GET` | `/api/inventory/forecast/{item_id}` | `forecast_30d` |
| `GET` | `/api/inventory/history/{item_id}` | `v_history_90d` |
| `GET` | `/api/alerts` | `v_alerts` + `current_inventory` |
| `GET` | `/api/model/metrics` | `v_kpis` |
| `GET` / `POST` | `/api/purchase-orders` | En memoria (ver abajo) |

Las consultas son parametrizadas y el `item_id` se valida contra `current_inventory` antes de usarse.

## Columnas que espera de los objetos del Equipo 1

`sql/serving/README.md` no fija los nombres de columna de las vistas, así que el backend asume estos. **El Equipo 1 debe confirmarlos o avisar para cambiarlos aquí** (`app/repository.py`).

| Objeto | Columnas |
|---|---|
| `current_inventory` | `id_insumo`, `nombre`, `unidad`, `stock_actual`, `punto_reorden`, `lead_time_dias`, `fecha_corte` |
| `historical_inventory` | `fecha`, `id_insumo`, `cantidad_consumida` |
| `forecast_30d` | `id_insumo`, `date`, `predicted_consumption`, `lower_bound`, `upper_bound` |
| `v_history_90d` | `id_insumo`, `fecha`, `cantidad_consumida` |
| `v_alerts` | `id_insumo`, `estado` (`Crítico`, `Advertencia`, `OK`), `dias_restantes`, `fecha_agotamiento` (una fila por insumo, incluidos los `OK` para que `/current` pueda mostrar su estado) |
| `v_kpis` | `modelo`, `mape`, `precision_modelo`, `evaluado_en` |

## Órdenes de compra

`POST /api/purchase-orders` con `{"id_insumo": "ACERO_A36"}` crea una orden con la cantidad que cubre el lead time más 30 días de consumo. Rechaza insumos sin riesgo (409) y no duplica la orden de un insumo que ya tiene una.

Las órdenes **viven en memoria** y se pierden al reiniciar la instancia. La Service Account del backend solo tiene permisos de lectura en BigQuery, así que persistirlas requiere decidir un almacén de escritura (Firestore, por ejemplo). Queda pendiente.

## Despliegue en Cloud Run

```bash
gcloud artifacts repositories create inventario --repository-format=docker --location=us-central1
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT/inventario/api backend
gcloud run deploy inventario-api \
  --image us-central1-docker.pkg.dev/$PROJECT/inventario/api \
  --region us-central1 \
  --service-account <service-account-del-backend> \
  --set-env-vars BQ_PROJECT=$PROJECT,CORS_ORIGINS=https://<tu-sitio>.web.app \
  --allow-unauthenticated
```

La Service Account la crea el Equipo 1 (`infra/service_account.sh`) con `BigQuery Data Viewer` y `BigQuery Job User`.
