from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

from .config import settings
from .database import Base, engine, ensure_schema
from .routers import auth as auth_router
from .routers import rides as rides_router
from .ws import manager

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


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await ws.close(code=4001, reason="Invalid token")
        return

    await manager.connect(user_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, ws)
