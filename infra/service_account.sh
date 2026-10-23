#!/usr/bin/env bash
# Crea la Service Account del backend (Cloud Run) con permisos de solo lectura en BigQuery.
# Uso: ./infra/service_account.sh <project-id>
set -euo pipefail

PROJECT_ID="${1:?Uso: $0 <project-id>}"
SA_NAME="inventory-api"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --project "$PROJECT_ID" \
    --display-name "API de inventario (Cloud Run)"
fi

# Data Viewer: leer tablas y vistas. Job User: ejecutar consultas.
for ROLE in roles/bigquery.dataViewer roles/bigquery.jobUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "$ROLE" \
    --condition None \
    --quiet >/dev/null
  echo "Rol $ROLE asignado a $SA_EMAIL"
done

echo
echo "Listo. El Equipo 2 debe desplegar Cloud Run con:"
echo "  --service-account ${SA_EMAIL}"
