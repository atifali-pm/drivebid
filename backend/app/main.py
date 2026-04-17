from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt

from .config import settings
from .database import Base, engine, ensure_schema
from .routers import admin as admin_router
from .routers import auth as auth_router
from .routers import disputes as disputes_router
from .routers import rides as rides_router
from .ws import manager

from .firebase import init_firebase

Base.metadata.create_all(bind=engine)
ensure_schema()
init_firebase()

app = FastAPI(title="DriveBid API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|drivebid\.local|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router.router)
app.include_router(auth_router.router)
app.include_router(disputes_router.router)
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
            raw = await ws.receive_text()
            # Handle driver location updates sent over WS for low latency
            try:
                import json
                msg = json.loads(raw)
                if msg.get("type") == "driver_location":
                    lat = msg["lat"]
                    lng = msg["lng"]
                    ride_id = msg.get("ride_id")
                    if ride_id:
                        # Broadcast to rider
                        from .database import SessionLocal
                        from .models import Ride
                        db = SessionLocal()
                        try:
                            ride = db.get(Ride, ride_id)
                            if ride:
                                await manager.send_to_user(
                                    ride.rider_id,
                                    {"type": "driver_location", "lat": lat, "lng": lng},
                                )
                        finally:
                            db.close()
            except (ValueError, KeyError):
                pass
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(user_id, ws)
