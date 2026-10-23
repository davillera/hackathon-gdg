# data/

**Responsable:** Persona B

Generación de los datos sintéticos que alimentan BigQuery. La especificación está en [`docs/data_spec.md`](../docs/data_spec.md).

| Archivo | Contenido |
|---|---|
| `generate_data.py` | Genera el histórico y el stock actual. Con `--upload` los carga en BigQuery (`WRITE_TRUNCATE`). |
| `requirements.txt` | `numpy`, `pandas`, `holidays`, `google-cloud-bigquery`, `pyarrow`, `matplotlib` |
| `historical_inventory.csv` | Salida: consumo diario por insumo (unas 8 700 filas) |
| `current_inventory.csv` | Salida: stock actual por insumo con los escenarios de demo |

Uso:

```bash
pip install -r data/requirements.txt
python data/generate_data.py            # solo escribe los CSV
python data/generate_data.py --upload   # escribe los CSV y los carga en supply_chain
```
