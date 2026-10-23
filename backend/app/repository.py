"""Acceso a datos. Dos implementaciones con la misma interfaz:

- `MockRepository`: datos sintéticos locales, para desarrollar sin BigQuery.
- `BigQueryRepository`: solo hace SELECT sobre las tablas y vistas que publica el Equipo 1
  (ver sql/serving/README.md y docs/data_spec.md).
"""

from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Callable, Protocol

from .rules import HORIZON_DAYS, classify
from .schemas import (
    Alerta,
    ForecastPoint,
    ForecastResponse,
    HistoryPoint,
    HistoryResponse,
    InsumoActual,
    ModelMetrics,
)


class ItemNotFound(Exception):
    """El id_insumo no existe en el catálogo."""


class Repository(Protocol):
    def current(self) -> list[InsumoActual]: ...
    def alerts(self) -> list[Alerta]: ...
    def forecast(self, item_id: str) -> ForecastResponse: ...
    def forecast_all(self) -> list[ForecastResponse]: ...
    def history(self, item_id: str) -> HistoryResponse: ...
    def metrics(self) -> ModelMetrics: ...


# --------------------------------------------------------------------------- demo


@dataclass(frozen=True)
class CatalogItem:
    id: str
    nombre: str
    unidad: str
    base: float
    trend: float  # tendencia anual
    amp: float  # amplitud estacional anual
    cv: float  # coeficiente de variación del ruido
    integer: bool
    cover: int  # días de cobertura del stock actual (escenario de demo)


# Catálogo y escenarios de demo de docs/data_spec.md (los id_insumo están congelados).
CATALOG = [
    CatalogItem("ELECTRODO_6013", "Electrodo 6013", "kg", 45, 0.15, 0.15, 0.20, False, 11),
    CatalogItem("ELECTRODO_7018", "Electrodo 7018", "kg", 30, 0.10, 0.15, 0.25, False, 30),
    CatalogItem("ACERO_A36", "Acero A36", "kg", 850, 0.20, 0.20, 0.30, False, 4),
    CatalogItem("ACERO_INOX_304", "Acero Inox 304", "kg", 120, 0.05, 0.10, 0.35, False, 45),
    CatalogItem("ALAMBRE_MIG_ER70S6", "Alambre MIG ER70S-6", "kg", 55, 0.12, 0.15, 0.20, False, 25),
    CatalogItem("DISCO_CORTE_7", 'Disco de corte 7"', "unidades", 70, 0.08, 0.10, 0.20, True, 3),
    CatalogItem("DISCO_DESBASTE_7", 'Disco de desbaste 7"', "unidades", 40, 0.08, 0.10, 0.25, True, 40),
    CatalogItem("GAS_ARGON", "Gas argón", "m3", 25, 0.0, 0.05, 0.15, False, 5),
    CatalogItem("GAS_CO2", "Gas CO2", "m3", 35, 0.05, 0.05, 0.15, False, 35),
    CatalogItem("PINTURA_ANTICORROSIVA", "Pintura anticorrosiva", "galones", 18, -0.10, 0.30, 0.40, False, 12),
    CatalogItem("TORNILLO_M10", "Tornillo M10", "unidades", 400, 0.05, 0.10, 0.45, True, 10),
    CatalogItem("GUANTES_SOLDADOR", "Guantes de soldador", "pares", 12, 0.0, 0.05, 0.50, True, 60),
]

WEEKLY = [1.00, 1.05, 1.05, 1.00, 0.90, 0.45, 0.05]  # lun..dom
ORIGIN = date(2024, 11, 1)
AS_OF = date(2026, 10, 31)  # fecha de corte de la demo; el pronóstico empieza al día siguiente
HISTORY_DAYS = 90


def _expected(item: CatalogItem, d: date) -> float:
    t = (d - ORIGIN).days / 365.25
    annual = 1 + item.amp * math.cos(2 * math.pi * (d.timetuple().tm_yday - 270) / 365.25)
    year_end = d.month == 12 and d.day >= 22 or d.month == 1 and d.day <= 2
    event = 0.25 if year_end else 1.0
    return item.base * (1 + item.trend * t) * WEEKLY[d.weekday()] * annual * event


def _round(item: CatalogItem, value: float) -> float:
    value = max(0.0, value)
    return float(round(value)) if item.integer else round(value, 2)


class MockRepository:
    """Datos sintéticos deterministas con la misma forma que los de BigQuery."""

    def __init__(self) -> None:
        self._by_id = {c.id: c for c in CATALOG}
        self._history = {c.id: self._build_history(c) for c in CATALOG}

    def _item(self, item_id: str) -> CatalogItem:
        if item_id not in self._by_id:
            raise ItemNotFound(item_id)
        return self._by_id[item_id]

    @staticmethod
    def _build_history(item: CatalogItem) -> list[HistoryPoint]:
        rng = random.Random(item.id)
        shape = 1 / item.cv**2
        points = []
        for i in range(HISTORY_DAYS):
            d = AS_OF - timedelta(days=HISTORY_DAYS - 1 - i)
            noise = rng.gammavariate(shape, item.cv**2)
            points.append(HistoryPoint(date=d.isoformat(), consumption=_round(item, _expected(item, d) * noise)))
        return points

    def _build_forecast(self, item: CatalogItem) -> list[ForecastPoint]:
        points = []
        for h in range(HORIZON_DAYS):
            d = AS_OF + timedelta(days=h + 1)
            pred = _expected(item, d)
            sigma = pred * item.cv * math.sqrt(1 + h / 30)
            points.append(
                ForecastPoint(
                    date=d.isoformat(),
                    predicted_consumption=round(pred, 2),
                    lower_bound=round(max(0.0, pred - 1.96 * sigma), 2),
                    upper_bound=round(pred + 1.96 * sigma, 2),
                )
            )
        return points

    def _avg_28d(self, item: CatalogItem) -> float:
        last = [p.consumption for p in self._history[item.id][-28:]]
        return _round(item, sum(last) / len(last))

    def _stock(self, item: CatalogItem) -> float:
        return _round(item, self._avg_28d(item) * item.cover)

    def _days_left(self, item: CatalogItem, forecast: list[ForecastPoint]) -> int | None:
        """Primer día del pronóstico en que el consumo acumulado supera el stock; None si no ocurre en 30 días."""
        stock = self._stock(item)
        acc = 0.0
        for i, p in enumerate(forecast):
            acc += p.predicted_consumption
            if acc > stock:
                return i + 1
        return None

    def _rows(self) -> list[tuple[CatalogItem, float, float, int | None, str]]:
        """(item, stock, consumo_diario_prom, dias_restantes, estado) por insumo."""
        out = []
        for c in CATALOG:
            fc = self._build_forecast(c)
            avg = sum(p.predicted_consumption for p in fc) / len(fc)
            dias = self._days_left(c, fc)
            out.append((c, self._stock(c), avg, dias, classify(dias)))
        return out

    def current(self) -> list[InsumoActual]:
        return [
            InsumoActual(
                id_insumo=c.id,
                nombre=c.nombre,
                unidad=c.unidad,
                stock_actual=stock,
                consumo_diario_prom=round(avg, 2),
                dias_cobertura=round(stock / avg, 1),
                estado=estado,  # type: ignore[arg-type]
            )
            for c, stock, avg, _, estado in self._rows()
        ]

    def alerts(self) -> list[Alerta]:
        out = [
            Alerta(
                id_insumo=c.id,
                nombre=c.nombre,
                unidad=c.unidad,
                estado=estado,  # type: ignore[arg-type]
                stock_actual=stock,
                dias_restantes=float(dias),
                fecha_agotamiento=(AS_OF + timedelta(days=dias)).isoformat(),
            )
            for c, stock, _, dias, estado in self._rows()
            if estado != "Estable" and dias is not None
        ]
        return sorted(out, key=lambda a: a.dias_restantes)

    def forecast(self, item_id: str) -> ForecastResponse:
        item = self._item(item_id)
        return ForecastResponse(item=item.id, forecast=self._build_forecast(item))

    def forecast_all(self) -> list[ForecastResponse]:
        return [self.forecast(c.id) for c in CATALOG]

    def history(self, item_id: str) -> HistoryResponse:
        item = self._item(item_id)
        return HistoryResponse(item=item.id, history=self._history[item.id])

    def metrics(self) -> ModelMetrics:
        return ModelMetrics(modelo="ARIMA_PLUS", mape=8.6, precision=91.4, evaluado_en=AS_OF.isoformat())


# ---------------------------------------------------------------------- BigQuery


class _TTLCache:
    def __init__(self, ttl: int) -> None:
        self.ttl = ttl
        self._store: dict[Any, tuple[float, Any]] = {}

    def get(self, key: Any, load: Callable[[], Any]) -> Any:
        now = time.monotonic()
        hit = self._store.get(key)
        if hit and now - hit[0] < self.ttl:
            return hit[1]
        value = load()
        self._store[key] = (now, value)
        return value


def _iso(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)[:10]


class BigQueryRepository:
    """Solo SELECT. Columnas esperadas por objeto en backend/README.md."""

    def __init__(self, project: str, dataset: str, cache_ttl: int = 60) -> None:
        from google.cloud import bigquery  # import diferido: el modo demo no lo necesita

        self._bq = bigquery
        self._client = bigquery.Client(project=project)
        self._ref = f"{project}.{dataset}"
        self._cache = _TTLCache(cache_ttl)

    def _query(self, sql: str, **params: str) -> list[dict[str, Any]]:
        config = self._bq.QueryJobConfig(
            query_parameters=[self._bq.ScalarQueryParameter(k, "STRING", v) for k, v in params.items()]
        )
        return [dict(row) for row in self._client.query(sql, job_config=config).result()]

    def _assert_item(self, item_id: str) -> None:
        rows = self._cache.get(("items",), lambda: self._query(f"SELECT id_insumo FROM `{self._ref}.v_current`"))
        if item_id not in {r["id_insumo"] for r in rows}:
            raise ItemNotFound(item_id)

    def current(self) -> list[InsumoActual]:
        sql = f"""
            SELECT id_insumo, nombre, unidad, stock_actual, consumo_diario_prom, dias_cobertura
            FROM `{self._ref}.v_current`
            ORDER BY id_insumo
        """
        rows = self._cache.get(("current",), lambda: self._query(sql))
        estados = {a.id_insumo: a.estado for a in self.alerts()}  # v_alerts solo trae Crítico y Advertencia
        return [
            InsumoActual(
                id_insumo=r["id_insumo"],
                nombre=r["nombre"],
                unidad=r["unidad"],
                stock_actual=float(r["stock_actual"]),
                consumo_diario_prom=round(float(r["consumo_diario_prom"]), 2),
                dias_cobertura=round(float(r["dias_cobertura"]), 1),
                estado=estados.get(r["id_insumo"], "Estable"),
            )
            for r in rows
        ]

    def alerts(self) -> list[Alerta]:
        sql = f"""
            SELECT id_insumo, nombre, unidad, estado, stock_actual, dias_restantes, fecha_agotamiento
            FROM `{self._ref}.v_alerts`
            ORDER BY fecha_agotamiento, id_insumo
        """
        rows = self._cache.get(("alerts",), lambda: self._query(sql))
        return [
            Alerta(
                id_insumo=r["id_insumo"],
                nombre=r["nombre"],
                unidad=r["unidad"],
                estado=r["estado"],
                stock_actual=float(r["stock_actual"]),
                dias_restantes=float(r["dias_restantes"]),
                fecha_agotamiento=_iso(r["fecha_agotamiento"]),
            )
            for r in rows
            if r["estado"] in ("Crítico", "Advertencia")
        ]

    @staticmethod
    def _points(rows: list[dict[str, Any]]) -> list[ForecastPoint]:
        return [
            ForecastPoint(
                date=_iso(r["date"]),
                predicted_consumption=round(float(r["predicted_consumption"]), 2),
                lower_bound=round(float(r["lower_bound"]), 2),
                upper_bound=round(float(r["upper_bound"]), 2),
            )
            for r in rows
        ]

    def forecast(self, item_id: str) -> ForecastResponse:
        self._assert_item(item_id)
        sql = f"""
            SELECT date, predicted_consumption, lower_bound, upper_bound
            FROM `{self._ref}.forecast_30d`
            WHERE id_insumo = @item_id
            ORDER BY date
        """
        rows = self._cache.get(("forecast", item_id), lambda: self._query(sql, item_id=item_id))
        return ForecastResponse(item=item_id, forecast=self._points(rows))

    def forecast_all(self) -> list[ForecastResponse]:
        sql = f"""
            SELECT id_insumo, date, predicted_consumption, lower_bound, upper_bound
            FROM `{self._ref}.forecast_30d`
            ORDER BY id_insumo, date
        """
        rows = self._cache.get(("forecast_all",), lambda: self._query(sql))
        grouped: dict[str, list[dict[str, Any]]] = {}
        for r in rows:
            grouped.setdefault(r["id_insumo"], []).append(r)
        return [ForecastResponse(item=i, forecast=self._points(rs)) for i, rs in grouped.items()]

    def history(self, item_id: str) -> HistoryResponse:
        self._assert_item(item_id)
        sql = f"""
            SELECT date, consumption
            FROM `{self._ref}.v_history_90d`
            WHERE id_insumo = @item_id
            ORDER BY date
        """
        rows = self._cache.get(("history", item_id), lambda: self._query(sql, item_id=item_id))
        return HistoryResponse(
            item=item_id,
            history=[HistoryPoint(date=_iso(r["date"]), consumption=float(r["consumption"])) for r in rows],
        )

    def metrics(self) -> ModelMetrics:
        sql = f"SELECT modelo, mape, `precision`, evaluado_en FROM `{self._ref}.model_metrics` LIMIT 1"
        rows = self._cache.get(("metrics",), lambda: self._query(sql))
        if not rows:
            raise ItemNotFound("model_metrics")
        r = rows[0]
        return ModelMetrics(
            modelo=r["modelo"],
            mape=round(float(r["mape"]), 1),
            precision=round(float(r["precision"]), 1),
            evaluado_en=_iso(r["evaluado_en"]),
        )
