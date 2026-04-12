from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from .models import BidStatus, RideStatus, UserRole


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    created_at: datetime


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
    notes: str = ""


class BidOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ride_id: int
    driver_id: int
    driver_name: str | None = None
    amount: float
    eta_minutes: int
    message: str
    status: BidStatus
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
    notes: str
    status: RideStatus
    accepted_bid_id: int | None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancelled_by: str | None = None
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
