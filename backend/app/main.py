from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, load_settings
from .repository import BigQueryRepository, ItemNotFound, MockRepository, Repository
from .rules import suggested_quantity
from .schemas import (
    Alerta,
    ForecastResponse,
    HistoryResponse,
    InsumoActual,
    ModelMetrics,
    PurchaseOrder,
    PurchaseOrderIn,
)


class OrderBook:
    """Órdenes de compra en memoria.

    Es una simplificación para la demo: se pierden al reiniciar la instancia de Cloud Run.
    Para persistirlas hay que elegir un almacén de escritura (la cuenta del backend solo lee BigQuery).
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._orders: dict[str, PurchaseOrder] = {}

    def add(self, order: PurchaseOrder) -> PurchaseOrder:
        with self._lock:
            existing = next((o for o in self._orders.values() if o.id_insumo == order.id_insumo), None)
            if existing:
                return existing  # una orden abierta por insumo: emitir dos veces no duplica
            self._orders[order.id] = order
            return order

    def all(self) -> list[PurchaseOrder]:
        with self._lock:
            return sorted(self._orders.values(), key=lambda o: o.creada_en, reverse=True)


def build_repository(settings: Settings) -> Repository:
    if settings.use_bigquery:
        return BigQueryRepository(settings.bq_project, settings.bq_dataset, settings.cache_ttl_seconds)
    return MockRepository()


def create_app(settings: Settings | None = None, repository: Repository | None = None) -> FastAPI:
    settings = settings or load_settings()
    app = FastAPI(title="API de pronóstico de inventario", version="0.1.0")
    app.state.repo = repository or build_repository(settings)
    app.state.orders = OrderBook()
    app.state.source = "bigquery" if settings.use_bigquery else "demo"

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    def repo(request: Request) -> Repository:
        return request.app.state.repo

    @app.exception_handler(ItemNotFound)
    async def not_found(_: Request, exc: ItemNotFound):
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=404, content={"detail": f"No existe el insumo '{exc}'."})

    @app.get("/health")
    def health(request: Request):
        return {"status": "ok", "source": request.app.state.source}

    @app.get("/api/inventory/current", response_model=list[InsumoActual])
    def inventory_current(r: Repository = Depends(repo)):
        return r.current()

    @app.get("/api/inventory/forecast", response_model=list[ForecastResponse])
    def inventory_forecast(r: Repository = Depends(repo)):
        return r.forecast_all()

    @app.get("/api/inventory/forecast/{item_id}", response_model=ForecastResponse)
    def inventory_forecast_item(item_id: str, r: Repository = Depends(repo)):
        return r.forecast(item_id)

    @app.get("/api/inventory/history/{item_id}", response_model=HistoryResponse)
    def inventory_history(item_id: str, r: Repository = Depends(repo)):
        return r.history(item_id)

    @app.get("/api/alerts", response_model=list[Alerta])
    def alerts(r: Repository = Depends(repo)):
        return r.alerts()

    @app.get("/api/model/metrics", response_model=ModelMetrics)
    def model_metrics(r: Repository = Depends(repo)):
        return r.metrics()

    @app.get("/api/purchase-orders", response_model=list[PurchaseOrder])
    def list_orders(request: Request):
        return request.app.state.orders.all()

    @app.post("/api/purchase-orders", response_model=PurchaseOrder, status_code=201)
    def create_order(body: PurchaseOrderIn, request: Request, r: Repository = Depends(repo)):
        item = next((c for c in r.current() if c.id_insumo == body.id_insumo), None)
        if item is None:
            raise HTTPException(status_code=404, detail=f"No existe el insumo '{body.id_insumo}'.")
        if item.estado == "OK":
            raise HTTPException(status_code=409, detail=f"{item.nombre} no está en riesgo; no hace falta ordenar.")
        order = PurchaseOrder(
            id=uuid.uuid4().hex[:8].upper(),
            id_insumo=item.id_insumo,
            nombre=item.nombre,
            unidad=item.unidad,
            cantidad_sugerida=suggested_quantity(item.consumo_diario_prom, item.lead_time_dias, item.stock_actual),
            creada_en=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            estado="Emitida",
        )
        return request.app.state.orders.add(order)

    return app


app = create_app()
