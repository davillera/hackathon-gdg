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
      Equipo 1                  Equipo 1                    Equipo 2
```

## División en dos equipos

### Equipo 1: Datos, ML y Backend

Responsable de todo lo que ocurre hasta que el JSON sale de la API.

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

**Fase 2: Backend y API (FastAPI)**
- [ ] Entorno Python con `fastapi`, `uvicorn`, `google-cloud-bigquery`, `pandas`.
- [ ] Implementar los endpoints del contrato (ver abajo).
- [ ] Usar consultas parametrizadas de BigQuery (`QueryJobConfig` con `ScalarQueryParameter`) en lugar de interpolar `item_id` en el SQL.
- [ ] Habilitar CORS para el dominio del frontend.

**Fase 4 (parte backend): Despliegue**
- [ ] `Dockerfile` simple para la API.
- [ ] Subir la imagen a Artifact Registry y desplegar en Cloud Run.
- [ ] Asignar a la Service Account los roles `BigQuery Data Viewer` y `BigQuery Job User`.

### Equipo 2: Frontend y UX

Responsable de la experiencia del dashboard, que el jurado evalúa con más peso.

**Fase 3: Frontend (Next.js)**
- [ ] Proyecto Next.js con TailwindCSS y Recharts o Tremor.
- [ ] **Tarjetas de KPIs (arriba):** "Insumos en Riesgo de Quiebre", "Días de Inventario Promedio", "Precisión del Modelo".
- [ ] **Gráfico principal (centro):** línea sólida con el consumo histórico de un insumo (ej. Electrodos 6013) y línea punteada con área de intervalo de confianza para los próximos 30 días.
- [ ] **Tabla de alertas (abajo):** insumos ordenados por fecha proyectada de agotamiento (ej. "Acero A36 - Se agotará en 4 días" con botón "Emitir Orden de Compra").
- [ ] Consumir la API con `fetch` o `axios`, con estados de carga mientras BigQuery procesa, y estados de error.
- [ ] Trabajar contra datos mock con la forma del contrato hasta que la API esté lista.
- [ ] (Opcional) Firebase Auth.

**Fase 4 (parte frontend): Despliegue**
- [ ] `npm run build`.
- [ ] `firebase deploy --only hosting` para obtener una URL pública con SSL.
- [ ] Configurar la URL de la API de Cloud Run en una variable de entorno (`NEXT_PUBLIC_API_URL`).

## Contrato de la API (punto de integración)

Ambos equipos deben acordar y respetar estos endpoints. Cualquier cambio de forma se avisa al otro equipo.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/inventory/current` | Stock actual por insumo. |
| `GET` | `/api/inventory/forecast` | Pronóstico de 30 días para todos los insumos. |
| `GET` | `/api/inventory/forecast/{item_id}` | Pronóstico de 30 días para un insumo. |
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

Para el intervalo de confianza del gráfico, el backend debe agregar `lower_bound` y `upper_bound` a cada punto (`prediction_interval_lower_bound` y `prediction_interval_upper_bound` en `ML.FORECAST`). El equipo 1 define el resto de los campos (forma de `current` y `alerts`) y los publica aquí antes de que el equipo 2 los consuma.

## Puntos de sincronización

1. **Al inicio:** cerrar el contrato de la API (campos y nombres de los insumos).
2. **Cuando el modelo esté entrenado:** el equipo 1 comparte el listado real de `id_insumo` y un ejemplo de respuesta de cada endpoint.
3. **Antes del despliegue:** el equipo 1 entrega la URL de Cloud Run y el equipo 2 la configura en el frontend.
4. **Antes de presentar:** ensayo conjunto del flujo completo con datos reales.
