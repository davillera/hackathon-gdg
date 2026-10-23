# infra/

**Responsable:** Persona A

Configuración de GCP del lado de datos.

| Archivo | Contenido |
|---|---|
| `grant_team_access.sh` | `./infra/grant_team_access.sh <project-id> <correo>`: da a un integrante `BigQuery Data Editor` y `BigQuery Job User` para trabajar en el dataset |
| `service_account.sh` | `./infra/service_account.sh <project-id>`: crea la Service Account `inventory-api` del backend con `BigQuery Data Viewer` y `BigQuery Job User` |
| `test_access.sql` | Comprueba que todos los objetos que consulta el backend existen y tienen filas |

**Nunca subir llaves JSON de Service Accounts al repo** (están en `.gitignore`). Cloud Run usa la Service Account directamente, sin llave.
