#!/usr/bin/env bash
# Da acceso de trabajo en BigQuery a un integrante del equipo (crear tablas, vistas y modelos).
# Uso: ./infra/grant_team_access.sh <project-id> <correo>
set -euo pipefail

PROJECT_ID="${1:?Uso: $0 <project-id> <correo>}"
EMAIL="${2:?Uso: $0 <project-id> <correo>}"

for ROLE in roles/bigquery.dataEditor roles/bigquery.jobUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "user:${EMAIL}" \
    --role "$ROLE" \
    --condition None \
    --quiet >/dev/null
  echo "Rol $ROLE asignado a $EMAIL"
done
