# infra/

**Responsable:** Persona A

Configuración de GCP del lado de datos.

| Archivo | Contenido |
|---|---|
| `service_account.sh` | Crea la Service Account del backend y le asigna `BigQuery Data Viewer` y `BigQuery Job User` |
| `test_access.sql` | Consulta de prueba que debe correr con la Service Account antes de avisar al Equipo 2 |

**Nunca subir llaves JSON de Service Accounts al repo** (están en `.gitignore`). Cloud Run usa la Service Account directamente, sin llave.
