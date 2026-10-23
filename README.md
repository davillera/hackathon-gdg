# Hackathon GDG: Predicción de inventario de insumos

Dashboard que anticipa el agotamiento de insumos industriales (electrodos, acero, etc.) a partir de su consumo histórico. El modelo de series temporales se entrena y se consulta con SQL dentro de BigQuery, sin exportar datos a PyTorch o TensorFlow.

## Arquitectura

| Capa | Tecnología | Despliegue |
|---|---|---|
| Datos y ML | BigQuery + BigQuery ML (`ARIMA_PLUS`) | Dataset `supply_chain` |
| Backend / API | FastAPI (Python) | Cloud Run |
| Frontend | Next.js + TailwindCSS + Recharts/Tremor | Firebase Hosting o Cloud Run |
| Autenticación (opcional) | Firebase Auth | n/a |

```
BigQuery (ARIMA_PLUS)  →  FastAPI (Cloud Run)  →  Next.js (Firebase Hosting)
      Equipo 1                        Equipo 2
```

## Estructura del repositorio (Equipo 1)

| Carpeta | Responsable | Contenido |
|---|---|---|
| `data/` | Persona B | Generador de datos sintéticos y CSV de salida |
| `sql/schema/` | Persona B | DDL de `historical_inventory` y `current_inventory` |
| `sql/ml/` | Equipo de ML | Entrenamiento, backtest, métricas y diagnóstico de `ARIMA_PLUS` |
| `sql/serving/` | Persona A | Tablas y vistas que consulta el backend (`forecast_30d`, `v_alerts`, `v_kpis`) |
| `infra/` | Persona A | Service Account y pruebas de acceso |
| `notebooks/` | Equipo de ML | Exploración y gráficos para la presentación |
| `docs/` | Compartido | `data_spec.md` (especificación de datos) y `data_contract.md` (contrato de tablas) |

Cada carpeta tiene un `README.md` con el detalle de sus archivos. Las tareas de cada persona están en [`docs/equipo1_responsabilidades.md`](docs/equipo1_responsabilidades.md).

## División en dos equipos

### Equipo 1: Datos y ML

Responsable de todo lo que vive en BigQuery. Entrega tablas y un modelo listos para consultar.

**Fase 1: Datos y entrenamiento (BigQuery ML)**
- [ ] Crear el dataset `supply_chain` en la consola de GCP.
- [ ] Script en Python que genere un CSV con 1-2 años de consumo diario simulado y lo suba a la tabla `historical_inventory`.
  - Columnas: `fecha` (DATE), `id_insumo` (STRING), `cantidad_consumida` (FLOAT).
- [ ] Crear una tabla de inventario actual (stock por insumo) para alimentar `/api/inventory/current`.
- [ ] Entrenar el modelo `supply_chain.inventory_forecast_model`:

```sql
CREATE OR REPLACE MODEL `supply_chain.inventory_forecast_model`
OPTIONS(
  model_type='ARIMA_PLUS',
  time_series_timestamp_col='fecha',
  time_series_data_col='cantidad_consumida',
  time_series_id_col='id_insumo',
  data_frequency='DAILY'
) AS
SELECT fecha, id_insumo, cantidad_consumida
FROM `supply_chain.historical_inventory`;
```

- [ ] Validar el pronóstico a 30 días:

```sql
SELECT *
FROM ML.FORECAST(MODEL `supply_chain.inventory_forecast_model`, STRUCT(30 AS horizon));
```

- [ ] Evaluar el modelo (`ML.EVALUATE`) y entregar la métrica para la tarjeta "Precisión del Modelo".
- [ ] Dar acceso de lectura al dataset a la Service Account del backend (`BigQuery Data Viewer` y `BigQuery Job User`).

### Equipo 2: Backend, Frontend y UX

Responsable de la API, el dashboard y la experiencia de usuario, que el jurado evalúa con más peso.

**Fase 2: Backend y API (FastAPI)**
- [ ] Entorno Python con `fastapi`, `uvicorn`, `google-cloud-bigquery`, `pandas`.
- [ ] Implementar los endpoints del contrato (ver abajo).
- [ ] Usar consultas parametrizadas de BigQuery (`QueryJobConfig` con `ScalarQueryParameter`) en lugar de interpolar `item_id` en el SQL.
- [ ] Habilitar CORS para el dominio del frontend.

**Fase 3: Frontend y UX (Next.js)**
- [ ] Proyecto Next.js con TailwindCSS y Recharts o Tremor.
- [ ] **Tarjetas de KPIs (arriba):** "Insumos en Riesgo de Quiebre", "Días de Inventario Promedio", "Precisión del Modelo".
- [ ] **Gráfico principal (centro):** línea sólida con el consumo histórico de un insumo (ej. Electrodos 6013) y línea punteada con área de intervalo de confianza para los próximos 30 días.
- [ ] **Tabla de alertas (abajo):** insumos ordenados por fecha proyectada de agotamiento (ej. "Acero A36 - Se agotará en 4 días" con botón "Emitir Orden de Compra").
- [ ] Consumir la API con `fetch` o `axios`, con estados de carga mientras BigQuery procesa, y estados de error.
- [ ] Trabajar contra datos mock con la forma del contrato hasta que las tablas y el modelo estén listos.
- [ ] (Opcional) Firebase Auth.

**Fase 4: Despliegue**
- [ ] `Dockerfile` simple para la API, imagen en Artifact Registry y despliegue en Cloud Run con la Service Account de BigQuery.
- [ ] Frontend: `npm run build` y `firebase deploy --only hosting` para obtener una URL pública con SSL.
- [ ] Configurar la URL de la API de Cloud Run en `NEXT_PUBLIC_API_URL`.

## Contrato de la API (punto de integración)

Lo implementa y consume el equipo 2. El equipo 1 define el esquema de las tablas que lo alimentan, y cualquier cambio de columnas se avisa al otro equipo.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/inventory/current` | Stock actual por insumo. |
| `GET` | `/api/inventory/forecast` | Pronóstico de 30 días para todos los insumos. |
| `GET` | `/api/inventory/forecast/{item_id}` | Pronóstico de 30 días para un insumo. |
| `GET` | `/api/inventory/history/{item_id}` | Consumo diario histórico de un insumo (`history: [{date, consumption}]`). Lo usa el gráfico principal. |
| `GET` | `/api/model/metrics` | Métricas del modelo (`modelo`, `mape`, `precision`, `evaluado_en`). Alimenta la tarjeta "Precisión del Modelo". |
| `GET` | `/api/purchase-orders` | Órdenes de compra emitidas. |
| `POST` | `/api/purchase-orders` | Emite una orden para un insumo en riesgo (`{"id_insumo": "..."}`). Detalles en [`backend/README.md`](backend/README.md). |
| `GET` | `/api/alerts` | Insumos en riesgo de agotarse según stock actual vs. pronóstico de 7 días. Estado `Crítico` o `Advertencia`. |

Ejemplo de respuesta de `/api/inventory/forecast/{item_id}`:

```json
{
  "item": "ELECTRODO_6013",
  "forecast": [
    { "date": "2026-11-01", "predicted_consumption": 42.5 }
  ]
}
```

Para el intervalo de confianza del gráfico, el backend debe agregar `lower_bound` y `upper_bound` a cada punto (`prediction_interval_lower_bound` y `prediction_interval_upper_bound` en `ML.FORECAST`). El equipo 2 define la forma de `current` y `alerts`; el equipo 1 se asegura de que las tablas tengan las columnas necesarias.

## Puntos de sincronización

1. **Al inicio:** acordar el esquema de las tablas (`historical_inventory`, stock actual) y la lista de `id_insumo`.
2. **Cuando el modelo esté entrenado:** el equipo 1 avisa, entrega la métrica de precisión y confirma el acceso de la Service Account.
3. **Antes del despliegue:** el equipo 2 prueba la API contra datos reales y conecta el frontend a la URL de Cloud Run.
4. **Antes de presentar:** ensayo conjunto del flujo completo con datos reales.

## Frontend (`frontend/`)

Next.js + TailwindCSS + Recharts, exportado como sitio estático para Firebase Hosting.

```bash
cd frontend
npm install
npm run dev                  # http://localhost:3000
npm run build                # genera frontend/out para Firebase Hosting
```

- Las variables se leen del `.env` de la raíz (`cp .env.example .env`), compartido con el backend.
- Sin `NEXT_PUBLIC_API_URL` usa datos de demostración con la forma del contrato (etiquetados como tal en la barra lateral).
- Sin variables `NEXT_PUBLIC_FIREBASE_*` omite el inicio de sesión; con ellas pide acceso con correo/contraseña o Google.
- Una alerta es `Crítico` si el insumo se agota en 7 días o menos y `Advertencia` hasta 14 días. La API es la fuente de verdad; el frontend usa la misma regla solo para colorear insumos estables.
- "Emitir orden de compra" solo marca la fila en pantalla; falta definir el endpoint de órdenes.

## Backend (`backend/`)

API en FastAPI. Sin `GCP_PROJECT_ID` responde con datos de demostración que siguen `docs/data_spec.md`; con él lee de BigQuery. Cómo correrla, variables, columnas que espera de los objetos del Equipo 1 y despliegue en Cloud Run: [`backend/README.md`](backend/README.md).

La regla de estado de los insumos (`Crítico`, `Advertencia`, `OK`) es la de `docs/data_spec.md`, sección 5: la calcula la vista `v_alerts` y el frontend solo la muestra.

## Datos reales en BigQuery

Proyecto `prueba-gdg-512521`, dataset `supply_chain` (US). Estado actual:

- `historical_inventory` y `current_inventory`: cargadas con `DATA-ALT/gen-data.txt` (5 insumos, 730 días; esquema de `DATA-ALT/diseño-modelo-datos.txt`).
- Modelo `inventory_forecast_model` y `model_metrics`: entrenados con `sql/ml/00_setup.sql` y `sql/ml/02_train_final.sql` (precisión 92,2 %).
- `forecast_30d` y las vistas `v_current`, `v_history_90d`, `v_alerts`, `v_kpis`: creadas con `sql/serving/01` a `05`. El intervalo de confianza es de 90 %.

Para usarlos en local: `GCP_PROJECT_ID` y `GOOGLE_APPLICATION_CREDENTIALS` en el `.env` (inicia sesión antes con `gcloud auth application-default login`). Cuando cambie el histórico o el stock hay que reentrenar (`02_train_final.sql`) y volver a correr `sql/serving/01_forecast_30d.sql`.

## Despliegue en Cloud Run

Región `us-central1`, proyecto `prueba-gdg-512521`. Imágenes en Artifact Registry (`inventario/api` y `inventario/web`).

| Servicio | URL |
|---|---|
| `inventario-api` (FastAPI) | https://inventario-api-711193083059.us-central1.run.app |
| `inventario-web` (Next.js estático con nginx) | https://inventario-web-711193083059.us-central1.run.app |

Para volver a desplegar:

```bash
P=prueba-gdg-512521; R=us-central1
# Backend
gcloud builds submit backend --tag $R-docker.pkg.dev/$P/inventario/api
gcloud run deploy inventario-api --image $R-docker.pkg.dev/$P/inventario/api --region $R --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=$P,BQ_DATASET=supply_chain,CORS_ORIGINS=https://inventario-web-711193083059.$R.run.app
# Frontend (NEXT_PUBLIC_* se escriben en el build)
gcloud builds submit frontend --config frontend/cloudbuild.yaml \
  --substitutions _IMAGE=$R-docker.pkg.dev/$P/inventario/web,_API_URL=https://inventario-api-711193083059.$R.run.app
gcloud run deploy inventario-web --image $R-docker.pkg.dev/$P/inventario/web --region $R --allow-unauthenticated
```

El backend corre con la cuenta de servicio `inventory-api@prueba-gdg-512521.iam.gserviceaccount.com` (solo lectura en BigQuery, creada con `infra/service_account.sh`). Ambos servicios son públicos y la API no tiene autenticación.
