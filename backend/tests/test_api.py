import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.repository import CATALOG, MockRepository
from app.rules import classify, suggested_quantity


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app(Settings(), MockRepository()))


def test_health_reports_demo_source(client):
    assert client.get("/health").json() == {"status": "ok", "source": "demo"}


def test_current_lists_all_catalog_items(client):
    rows = client.get("/api/inventory/current").json()
    assert [r["id_insumo"] for r in rows] == [c.id for c in CATALOG]
    assert all(r["stock_actual"] > 0 for r in rows)


def test_demo_scenarios_match_data_spec(client):
    estados = {r["id_insumo"]: r["estado"] for r in client.get("/api/inventory/current").json()}
    for criticos in ("ACERO_A36", "DISCO_CORTE_7", "GAS_ARGON"):
        assert estados[criticos] == "Crítico"
    for ok in ("ELECTRODO_7018", "ACERO_INOX_304", "GAS_CO2", "GUANTES_SOLDADOR"):
        assert estados[ok] == "OK"


def test_alerts_sorted_and_only_at_risk(client):
    alerts = client.get("/api/alerts").json()
    assert alerts and {a["estado"] for a in alerts} <= {"Crítico", "Advertencia"}
    days = [a["dias_restantes"] for a in alerts]
    assert days == sorted(days)


def test_forecast_has_30_days_with_interval(client):
    body = client.get("/api/inventory/forecast/ELECTRODO_6013").json()
    assert body["item"] == "ELECTRODO_6013"
    assert len(body["forecast"]) == 30
    assert body["forecast"][0]["date"] == "2026-11-01"
    for p in body["forecast"]:
        assert p["lower_bound"] <= p["predicted_consumption"] <= p["upper_bound"]


def test_forecast_all_covers_every_item(client):
    assert len(client.get("/api/inventory/forecast").json()) == len(CATALOG)


def test_history_is_90_days_ending_at_cutoff(client):
    h = client.get("/api/inventory/history/ACERO_A36").json()["history"]
    assert len(h) == 90 and h[-1]["date"] == "2026-10-31"


def test_unknown_item_returns_404(client):
    assert client.get("/api/inventory/forecast/NO_EXISTE").status_code == 404
    assert client.get("/api/inventory/history/NO_EXISTE").status_code == 404


def test_metrics_shape(client):
    m = client.get("/api/model/metrics").json()
    assert m["precision"] == pytest.approx(100 - m["mape"])


def test_purchase_order_flow(client):
    created = client.post("/api/purchase-orders", json={"id_insumo": "ACERO_A36"})
    assert created.status_code == 201
    body = created.json()
    assert body["estado"] == "Emitida" and body["cantidad_sugerida"] > 0
    again = client.post("/api/purchase-orders", json={"id_insumo": "ACERO_A36"})
    assert again.json()["id"] == body["id"]  # no duplica
    assert any(o["id"] == body["id"] for o in client.get("/api/purchase-orders").json())


def test_purchase_order_rejects_healthy_and_unknown_items(client):
    assert client.post("/api/purchase-orders", json={"id_insumo": "GUANTES_SOLDADOR"}).status_code == 409
    assert client.post("/api/purchase-orders", json={"id_insumo": "NO_EXISTE"}).status_code == 404


def test_cors_allows_configured_origin():
    app = create_app(Settings(cors_origins=["https://front.example"]), MockRepository())
    r = TestClient(app).get("/health", headers={"Origin": "https://front.example"})
    assert r.headers["access-control-allow-origin"] == "https://front.example"


def test_classify_rule():
    assert classify(5, 7, 100, 50) == "Crítico"  # se agota antes de que llegue el pedido
    assert classify(30, 7, 40, 50) == "Crítico"  # menos stock que 7 días de consumo
    assert classify(12, 7, 100, 50) == "Advertencia"
    assert classify(30, 7, 100, 50) == "OK"


def test_suggested_quantity_never_negative():
    assert suggested_quantity(10, 7, 10_000) == 0
    assert suggested_quantity(10, 7, 100) == 270
