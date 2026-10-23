"""Modelos de respuesta. Reflejan el contrato de la API del README y los tipos del frontend."""

from typing import Literal

from pydantic import BaseModel

Estado = Literal["Crítico", "Advertencia", "OK"]


class InsumoActual(BaseModel):
    id_insumo: str
    nombre: str
    unidad: str
    stock_actual: float
    punto_reorden: float
    lead_time_dias: int
    consumo_diario_prom: float
    dias_cobertura: float
    estado: Estado


class ForecastPoint(BaseModel):
    date: str  # YYYY-MM-DD
    predicted_consumption: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    item: str
    forecast: list[ForecastPoint]


class HistoryPoint(BaseModel):
    date: str  # YYYY-MM-DD
    consumption: float


class HistoryResponse(BaseModel):
    item: str
    history: list[HistoryPoint]


class Alerta(BaseModel):
    id_insumo: str
    nombre: str
    unidad: str
    estado: Literal["Crítico", "Advertencia"]
    stock_actual: float
    dias_restantes: float
    fecha_agotamiento: str  # YYYY-MM-DD


class ModelMetrics(BaseModel):
    modelo: str
    mape: float  # porcentaje
    precision: float  # 100 - mape
    evaluado_en: str  # YYYY-MM-DD


class PurchaseOrderIn(BaseModel):
    id_insumo: str


class PurchaseOrder(BaseModel):
    id: str
    id_insumo: str
    nombre: str
    unidad: str
    cantidad_sugerida: float
    creada_en: str  # ISO 8601, UTC
    estado: Literal["Emitida"]
