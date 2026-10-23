import re

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from datetime import date

from app.repository import CATALOG, BigQueryRepository, ItemNotFound, MockRepository, _TTLCache
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
        assert estados[ok] == "Estable"


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
    assert classify(3) == "Crítico"
    assert classify(7) == "Crítico"
    assert classify(8) == "Advertencia"
    assert classify(14) == "Advertencia"
    assert classify(15) == "Estable"
    assert classify(None) == "Estable"  # no se agota en 30 días


def test_suggested_quantity_never_negative():
    assert suggested_quantity(10, 10_000) == 0
    assert suggested_quantity(10, 100) == 270  # 10 x 37 días - 100


def test_current_matches_alerts(client):
    current = {r["id_insumo"]: r for r in client.get("/api/inventory/current").json()}
    for a in client.get("/api/alerts").json():
        assert current[a["id_insumo"]]["estado"] == a["estado"]
    assert all("lead_time_dias" not in r for r in current.values())


# ---- BigQuery: se prueba el mapeo de filas con un cliente falso (no hay credenciales en CI)


def fake_bq_repo(tables):
    repo = object.__new__(BigQueryRepository)
    repo._ref = "p.supply_chain"
    repo._cache = _TTLCache(60)
    calls = []

    def query(sql, **params):
        calls.append((sql, params))
        for name, rows in tables.items():
            if re.search(rf"\.{name}", sql):
                return rows
        raise AssertionError(f"consulta inesperada: {sql}")

    repo._query = query
    repo.calls = calls
    return repo


def bq_tables():
    return {
        "v_current": [
            {"id_insumo": "A", "nombre": "Ac", "unidad": "kg", "stock_actual": 100, "consumo_diario_prom": 25.0, "dias_cobertura": 4.0},
            {"id_insumo": "B", "nombre": "Bo", "unidad": "kg", "stock_actual": 900, "consumo_diario_prom": 30.0, "dias_cobertura": 30.0},
        ],
        "v_alerts": [
            {"id_insumo": "A", "nombre": "Ac", "unidad": "kg", "estado": "Crítico", "stock_actual": 100, "dias_restantes": 4,
             "fecha_agotamiento": date(2026, 11, 4)},
        ],
        "forecast_30d": [
            {"id_insumo": "A", "date": date(2026, 11, 1), "predicted_consumption": 25.0, "lower_bound": 10.0, "upper_bound": 40.0},
        ],
        "v_history_90d": [{"date": date(2026, 10, 31), "consumption": 22.5}],
        "model_metrics": [{"modelo": "ARIMA_PLUS", "mape": 8.6, "precision": 91.4, "evaluado_en": date(2026, 11, 2)}],
    }


def test_bigquery_repository_maps_serving_views():
    repo = fake_bq_repo(bq_tables())
    current = repo.current()
    assert [(c.id_insumo, c.estado) for c in current] == [("A", "Crítico"), ("B", "Estable")]
    alerts = repo.alerts()
    assert alerts[0].fecha_agotamiento == "2026-11-04" and alerts[0].dias_restantes == 4.0
    assert repo.forecast("A").forecast[0].date == "2026-11-01"
    assert repo.history("A").history[0].consumption == 22.5
    assert repo.metrics().precision == 91.4
    with pytest.raises(ItemNotFound):
        repo.history("ZZZ")


def test_bigquery_repository_passes_item_id_as_parameter():
    repo = fake_bq_repo(bq_tables())
    repo.forecast("A")
    sql, params = next(c for c in repo.calls if "forecast_30d" in c[0])
    assert params == {"item_id": "A"} and "'A'" not in sql
