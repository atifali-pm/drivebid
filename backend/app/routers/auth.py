import secrets
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, hash_password, require_role, verify_password
from ..database import get_db
from ..firebase import is_available as firebase_available, verify_firebase_token
from ..models import OTP, User, UserRole
from ..schemas import (
    DriverVerification,
    PhoneOTPRequest,
    PhoneOTPVerify,
    Token,
    UserCreate,
    UserLogin,
    UserOut,
)


class FirebasePhoneAuth(BaseModel):
    """Client sends the Firebase ID token after completing phone auth on the client side."""
    firebase_id_token: str
    full_name: str = ""
    role: UserRole = UserRole.rider
    referral_code_used: str | None = None

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5


def _generate_referral_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "DB-" + "".join(secrets.choice(chars) for _ in range(6))


def _generate_otp() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(OTP_LENGTH))


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    referred_by = None
    if payload.referral_code_used:
        referrer = (
            db.query(User)
            .filter(User.referral_code == payload.referral_code_used)
            .first()
        )
        if referrer:
            referred_by = referrer.id

    referral_code = _generate_referral_code()
    while db.query(User).filter(User.referral_code == referral_code).first():
        referral_code = _generate_referral_code()

    user = User(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        referral_code=referral_code,
        referred_by=referred_by,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/otp/request")
def request_otp(payload: PhoneOTPRequest, db: Session = Depends(get_db)):
    code = _generate_otp()
    expires = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    otp = OTP(phone=payload.phone, code=code, expires_at=expires)
    db.add(otp)
    db.commit()
    # In production: send via SMS (Twilio, local SMS gateway).
    # For now, return it in the response for development/testing.
    return {
        "message": f"OTP sent to {payload.phone}",
        "dev_otp": code,
        "expires_in_seconds": OTP_EXPIRY_MINUTES * 60,
    }


@router.post("/otp/verify", response_model=Token)
def verify_otp(payload: PhoneOTPVerify, db: Session = Depends(get_db)):
    otp = (
        db.query(OTP)
        .filter(
            OTP.phone == payload.phone,
            OTP.code == payload.code,
            OTP.used == False,
            OTP.expires_at > datetime.utcnow(),
        )
        .order_by(OTP.id.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    otp.used = True

    user = db.query(User).filter(User.phone == payload.phone).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No account with this phone number. Register first.",
        )
    db.commit()
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/toggle-online", response_model=UserOut)
def toggle_online(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    user.is_online = not user.is_online
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/verify-driver", response_model=UserOut)
def verify_driver(
    payload: DriverVerification,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    user.cnic_number = payload.cnic_number
    user.license_number = payload.license_number
    user.vehicle_plate = payload.vehicle_plate
    user.vehicle_model = payload.vehicle_model
    user.vehicle_color = payload.vehicle_color
    user.is_verified = True
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/firebase-phone", response_model=Token)
def firebase_phone_auth(payload: FirebasePhoneAuth, db: Session = Depends(get_db)):
    """
    Authenticate or register via Firebase Phone Auth.

    Flow:
    1. Client completes Firebase phone verification (reCAPTCHA + SMS)
       and gets a Firebase ID token.
    2. Client sends the ID token to this endpoint.
    3. Backend verifies it with Firebase Admin SDK.
    4. If user exists (by phone), log them in.
    5. If new phone, create an account.
    """
    if not firebase_available():
        raise HTTPException(
            status_code=503,
            detail="Firebase not configured. Phone auth unavailable.",
        )
    try:
        decoded = verify_firebase_token(payload.firebase_id_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")

    phone = decoded.get("phone_number")
    if not phone:
        raise HTTPException(
            status_code=400, detail="Firebase token does not contain a phone number"
        )

    user = db.query(User).filter(User.phone == phone).first()
    if user:
        # Existing user — log in
        token = create_access_token(user.id)
        return Token(access_token=token, user=UserOut.model_validate(user))

    # New user — register
    if not payload.full_name:
        raise HTTPException(
            status_code=400,
            detail="full_name is required for first-time phone registration",
        )

    referred_by = None
    if payload.referral_code_used:
        referrer = (
            db.query(User)
            .filter(User.referral_code == payload.referral_code_used)
            .first()
        )
        if referrer:
            referred_by = referrer.id

    referral_code = _generate_referral_code()
    while db.query(User).filter(User.referral_code == referral_code).first():
        referral_code = _generate_referral_code()

    user = User(
        email=f"{phone.replace('+', '')}@phone.drivebid.local",
        phone=phone,
        full_name=payload.full_name,
        hashed_password=hash_password(secrets.token_hex(16)),
        role=payload.role,
        referral_code=referral_code,
        referred_by=referred_by,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))
