"""Regla de alertas de referencia (docs/data_spec.md, sección 5).

La implementación real vive en la vista `v_alerts` de BigQuery; esta copia la usan los
datos de demostración y las pruebas para que ambos modos se comporten igual.
"""

HORIZON_DAYS = 30


def classify(dias_restantes: float, lead_time_dias: int, stock: float, forecast_7d: float) -> str:
    """Devuelve "Crítico", "Advertencia" u "OK"."""
    if dias_restantes <= lead_time_dias or stock < forecast_7d:
        return "Crítico"
    if dias_restantes <= lead_time_dias + 7:
        return "Advertencia"
    return "OK"


def suggested_quantity(consumo_diario: float, lead_time_dias: int, stock: float) -> float:
    """Cantidad que cubre el tiempo de entrega más un horizonte de 30 días."""
    needed = consumo_diario * (lead_time_dias + HORIZON_DAYS) - stock
    return round(max(needed, 0.0), 2)
