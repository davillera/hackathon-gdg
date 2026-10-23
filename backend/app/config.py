import os
from dataclasses import dataclass, field


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
    origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    return Settings(
        bq_project=os.environ.get("BQ_PROJECT", "").strip(),
        bq_dataset=os.environ.get("BQ_DATASET", "supply_chain").strip(),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        cache_ttl_seconds=int(os.environ.get("CACHE_TTL_SECONDS", "60")),
    )
