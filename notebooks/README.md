# notebooks/

**Responsable:** equipo de ML

Gráficos para la presentación, generados a partir de las salidas de `sql/ml/`. No es código de producción.

| Archivo | Contenido |
|---|---|
| `backtest_charts.ipynb` | Precisión por insumo, comparación de configuraciones, real vs. pronóstico del backtest, pronóstico a 30 días con intervalo, componentes del modelo y diagnóstico de `ML.ARIMA_EVALUATE` |
| `requirements.txt` | Dependencias del notebook |
| `figuras/` | PNG generados por el notebook (se crea al ejecutarlo) |

Uso (requiere haber corrido `sql/ml/00` a `02` y credenciales con `gcloud auth application-default login`):

```bash
python3 -m venv .venv && .venv/bin/pip install -r notebooks/requirements.txt
cd notebooks
GCP_PROJECT=<id-del-proyecto> ../.venv/bin/jupyter nbconvert --to notebook --execute --inplace backtest_charts.ipynb
```

Con `MODO_PRUEBA=1` en lugar de `GCP_PROJECT` usa datos inventados para revisar el diseño sin conectarse a BigQuery (no guarda figuras).
