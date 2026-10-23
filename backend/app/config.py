import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


def load_dotenv(path: Path = ROOT_ENV) -> None:
    """Carga el .env de la raíz del proyecto sin pisar variables ya definidas en el entorno."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        if value:
            os.environ.setdefault(key.strip(), value)


@dataclass(frozen=True)
class Settings:
    bq_project: str = ""
    bq_dataset: str = "supply_chain"
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000"])
    cache_ttl_seconds: int = 60

    @property
    def use_bigquery(self) -> bool:
        return bool(self.bq_project)


def load_settings() -> Settings:
    load_dotenv()
    origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    return Settings(
        bq_project=(os.environ.get("GCP_PROJECT_ID") or os.environ.get("BQ_PROJECT", "")).strip(),
        bq_dataset=os.environ.get("BQ_DATASET", "supply_chain").strip(),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        cache_ttl_seconds=int(os.environ.get("CACHE_TTL_SECONDS", "60")),
    )
