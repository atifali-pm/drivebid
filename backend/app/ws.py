import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._conns: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._conns[user_id].add(ws)

    async def disconnect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._conns[user_id].discard(ws)
            if not self._conns[user_id]:
                del self._conns[user_id]

    async def send_to_user(self, user_id: int, data: dict) -> None:
        async with self._lock:
            targets = list(self._conns.get(user_id, set()))
        for ws in targets:
            try:
                await ws.send_json(data)
            except Exception:
                await self.disconnect(user_id, ws)

    async def send_to_users(self, user_ids: list[int], data: dict) -> None:
        for uid in set(user_ids):
            await self.send_to_user(uid, data)

    async def broadcast(self, data: dict) -> None:
        async with self._lock:
            all_ws = [(uid, list(sockets)) for uid, sockets in self._conns.items()]
        for uid, sockets in all_ws:
            for ws in sockets:
                try:
                    await ws.send_json(data)
                except Exception:
                    await self.disconnect(uid, ws)


manager = ConnectionManager()
