"""Regla de alertas de docs/data_spec.md, sección 5 (la misma de frontend/lib/status.ts).

La implementación real vive en la vista `v_alerts` de BigQuery; esta copia la usan los
datos de demostración y las pruebas para que ambos modos se comporten igual.
"""

HORIZON_DAYS = 30
CRITICAL_DAYS = 7
WARNING_DAYS = 14
ORDER_COVER_DAYS = 30  # días de consumo pronosticado que debe cubrir una orden
ORDER_BUFFER_DAYS = 7  # colchón de seguridad


def classify(dias_restantes: float | None) -> str:
    """Devuelve "Crítico", "Advertencia" o "Estable". `None` = no se agota en el horizonte."""
    if dias_restantes is None:
        return "Estable"
    if dias_restantes <= CRITICAL_DAYS:
        return "Crítico"
    if dias_restantes <= WARNING_DAYS:
        return "Advertencia"
    return "Estable"


def suggested_quantity(consumo_diario: float, stock: float) -> float:
    """Cantidad que cubre 30 días de consumo más el colchón, descontando el stock actual."""
    needed = consumo_diario * (ORDER_COVER_DAYS + ORDER_BUFFER_DAYS) - stock
    return round(max(needed, 0.0), 2)
