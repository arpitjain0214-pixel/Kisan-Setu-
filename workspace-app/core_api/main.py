import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPOSITORY_ROOT / ".env")
for workspace in ("workspace-agent", "workspace-ml"):
    workspace_path = str(REPOSITORY_ROOT / workspace)
    if workspace_path not in sys.path:
        sys.path.insert(0, workspace_path)

from agent_service.main import router as agent_router
from core_api.api.auth import router as auth_router
from core_api.api.market import router as market_router
from core_api.api.prices import router as prices_router
from core_api.api.bids import router as bids_router  # Added bids router import
from core_api.db.session import get_db
from ml_service.api import initialize_model_state, router as ml_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_model_state(app.state)
    yield

app = FastAPI(
    title="KisanSetu API",
    description=(
        "Unified KisanSetu API for market data, crop disease inference, "
        "Firebase-authenticated accounts, and the agricultural assistant."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "KISANSETU_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/")
def root():
    return {
        "message": "Welcome to KisanSetu API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    model_ready = (
        getattr(app.state, "interpreter", None) is not None
        and getattr(app.state, "model_error", None) is None
    )
    agent_ready = bool(os.getenv("GOOGLE_API_KEY") and os.getenv("DATABASE_URL"))
    firebase_credential_path = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    )
    auth_ready = bool(
        firebase_credential_path
        and Path(firebase_credential_path).expanduser().is_file()
    )
    return {
        "status": "ready" if model_ready and agent_ready and auth_ready else "degraded",
        "service": "kisansetu-unified-api",
        "services": {
            "core": {"ready": True},
            "agent": {
                "configured": agent_ready,
                "route": "/agent/v1/chat",
            },
            "authentication": {"configured": auth_ready},
            "disease_model": {
                "ready": model_ready,
                "detail": getattr(app.state, "model_error", None),
            },
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health/db")
def database_health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {
        "status": "healthy",
        "database": "connected",
    }


app.include_router(prices_router)
app.include_router(market_router)
app.include_router(auth_router)
app.include_router(ml_router)
app.include_router(agent_router)
app.include_router(bids_router) # Registered bids router