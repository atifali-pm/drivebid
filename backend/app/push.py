"""
Expo push notification helper.

Sends notifications via Expo's push service (https://exp.host/--/api/v2/push/send).
No Firebase or APNs credentials needed — Expo relays to both platforms.
"""
from __future__ import annotations

import json
import urllib.request
from typing import Iterable

from sqlalchemy.orm import Session

from .models import PushToken

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _tokens_for(db: Session, user_id: int) -> list[str]:
    rows = db.query(PushToken).filter(PushToken.user_id == user_id).all()
    return [r.token for r in rows]


def send_to_user(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    tokens = _tokens_for(db, user_id)
    if not tokens:
        return
    messages = [
        {
            "to": t,
            "title": title,
            "body": body,
            "sound": "default",
            "priority": "high",
            "data": data or {},
        }
        for t in tokens
    ]
    try:
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=json.dumps(messages).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5).read()
    except Exception:
        # Silent fail — don't break the request flow on push errors
        pass
