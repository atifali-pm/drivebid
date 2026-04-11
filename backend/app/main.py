from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, ensure_schema
from .routers import auth as auth_router
from .routers import rides as rides_router

Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(title="DriveBid API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://drivebid.local:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(rides_router.router)


@app.get("/")
def root():
    return {
        "service": "DriveBid API",
        "version": "0.1.0",
        "frontend": "http://drivebid.local:5173",
        "docs": "http://drivebid.local:8050/docs",
        "health": "http://drivebid.local:8050/health",
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "drivebid"}
