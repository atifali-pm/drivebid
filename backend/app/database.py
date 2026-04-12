from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema() -> None:
    """Idempotent lightweight migrations for SQLite prototype.

    SQLAlchemy's create_all doesn't ALTER existing tables, so when we add
    nullable columns we patch them in here rather than dropping the DB.
    """
    expected_columns: dict[str, dict[str, str]] = {
        "rides": {
            "pickup_lat": "FLOAT",
            "pickup_lng": "FLOAT",
            "dropoff_lat": "FLOAT",
            "dropoff_lng": "FLOAT",
            "distance_km": "FLOAT",
            "duration_min": "FLOAT",
            "estimated_fare": "FLOAT",
        },
    }
    with engine.begin() as conn:
        for table, cols in expected_columns.items():
            rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            existing = {row[1] for row in rows}
            for col, col_type in cols.items():
                if col not in existing:
                    conn.exec_driver_sql(
                        f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"
                    )
