from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from .models import BidStatus, RideStatus, UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole
    phone: str | None = None
    referral_code_used: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PhoneOTPRequest(BaseModel):
    phone: str


class PhoneOTPVerify(BaseModel):
    phone: str
    code: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    phone: str | None = None
    full_name: str
    role: UserRole
    is_online: bool = False
    is_verified: bool = False
    vehicle_type: str | None = None
    vehicle_model: str | None = None
    vehicle_color: str | None = None
    vehicle_plate: str | None = None
    min_fare: float | None = None
    rate_per_km: float | None = None
    rate_per_min: float | None = None
    referral_code: str | None = None
    created_at: datetime


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    vehicle_type: str | None = None
    vehicle_model: str | None = None
    vehicle_color: str | None = None
    vehicle_plate: str | None = None
    min_fare: float | None = None
    rate_per_km: float | None = None
    rate_per_min: float | None = None


class DriverVerification(BaseModel):
    cnic_number: str
    license_number: str
    vehicle_plate: str
    vehicle_model: str
    vehicle_color: str


class DisputeCreate(BaseModel):
    ride_id: int
    category: str
    description: str


class DisputeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ride_id: int
    user_id: int
    category: str
    description: str
    status: str
    admin_response: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class DisputeResolve(BaseModel):
    admin_response: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RideCreate(BaseModel):
    pickup: str
    dropoff: str
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None
    distance_km: float | None = None
    duration_min: float | None = None
    estimated_fare: float | None = None
    max_budget: float
    ride_type: str = "car"
    notes: str = ""
    pool_ok: bool = False
    scheduled_for: datetime | None = None


class BidOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ride_id: int
    driver_id: int
    driver_name: str | None = None
    driver_phone: str | None = None
    driver_vehicle_type: str | None = None
    driver_vehicle_model: str | None = None
    driver_vehicle_plate: str | None = None
    driver_rating: float | None = None
    driver_trip_count: int = 0
    driver_trust_score: float | None = None
    driver_lat: float | None = None
    driver_lng: float | None = None
    amount: float
    eta_minutes: int
    message: str
    status: BidStatus
    pool_key: str | None = None
    created_at: datetime


class RideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    rider_id: int
    rider_name: str | None = None
    pickup: str
    dropoff: str
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None
    distance_km: float | None = None
    duration_min: float | None = None
    estimated_fare: float | None = None
    max_budget: float
    ride_type: str = "car"
    notes: str
    status: RideStatus
    accepted_bid_id: int | None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancelled_by: str | None = None
    auction_ends_at: datetime | None = None
    scheduled_for: datetime | None = None
    pool_ok: bool = False
    rider_to_driver_stars: int | None = None
    rider_to_driver_comment: str | None = None
    driver_to_rider_stars: int | None = None
    driver_to_rider_comment: str | None = None
    created_at: datetime
    bids: list[BidOut] = []


class BidCreate(BaseModel):
    amount: float
    eta_minutes: int
    message: str = ""


class RatingCreate(BaseModel):
    stars: int
    comment: str = ""
