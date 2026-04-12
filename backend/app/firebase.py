"""
Firebase Admin SDK initialization and helpers.

In production, set FIREBASE_SERVICE_ACCOUNT_PATH env var to the path of
your Firebase service account JSON file. The file is gitignored.

If the service account file is missing, Firebase features are disabled
gracefully — the app still starts, but phone auth endpoints will return
503 Service Unavailable.
"""

import os
from pathlib import Path

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

_initialized = False

SERVICE_ACCOUNT_PATH = os.environ.get(
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    str(Path(__file__).resolve().parent.parent / "firebase-service-account.json"),
)


def init_firebase() -> bool:
    """Initialize Firebase Admin SDK. Returns True if successful."""
    global _initialized
    if _initialized:
        return True
    if not Path(SERVICE_ACCOUNT_PATH).exists():
        print(
            f"[firebase] Service account not found at {SERVICE_ACCOUNT_PATH}. "
            "Phone auth will be unavailable. See README for setup instructions."
        )
        return False
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        _initialized = True
        print("[firebase] Initialized successfully.")
        return True
    except Exception as e:
        print(f"[firebase] Init failed: {e}")
        return False


def is_available() -> bool:
    return _initialized


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token from the client.
    Returns the decoded token dict with uid, phone_number, etc.
    Raises ValueError if Firebase is not initialized.
    Raises firebase_auth.InvalidIdTokenError if token is invalid.
    """
    if not _initialized:
        raise ValueError("Firebase not initialized")
    return firebase_auth.verify_id_token(id_token)
