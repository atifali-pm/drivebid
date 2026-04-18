from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, PyEnum):
    rider = "rider"
    driver = "driver"
    admin = "admin"


class RideStatus(str, PyEnum):
    open = "open"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class VehicleType(str, PyEnum):
    car = "car"
    motorcycle = "motorcycle"
    rickshaw = "rickshaw"
    van = "van"


class BidStatus(str, PyEnum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_online: Mapped[bool] = mapped_column(Integer, default=False, server_default="0")
    is_verified: Mapped[bool] = mapped_column(Integer, default=False, server_default="0")
    cnic_number: Mapped[str | None] = mapped_column(String, nullable=True)
    license_number: Mapped[str | None] = mapped_column(String, nullable=True)
    vehicle_plate: Mapped[str | None] = mapped_column(String, nullable=True)
    vehicle_model: Mapped[str | None] = mapped_column(String, nullable=True)
    vehicle_color: Mapped[str | None] = mapped_column(String, nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(String, nullable=True)
    min_fare: Mapped[float | None] = mapped_column(Float, nullable=True)
    rate_per_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    rate_per_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    referral_code: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    referred_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    rides: Mapped[list["Ride"]] = relationship(back_populates="rider", foreign_keys="Ride.rider_id")
    bids: Mapped[list["Bid"]] = relationship(back_populates="driver")


class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rider_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    pickup: Mapped[str] = mapped_column(String, nullable=False)
    dropoff: Mapped[str] = mapped_column(String, nullable=False)
    pickup_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    pickup_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    dropoff_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    dropoff_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    duration_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    estimated_fare: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_budget: Mapped[float] = mapped_column(Float, nullable=False)
    ride_type: Mapped[str] = mapped_column(String, default="car")
    notes: Mapped[str] = mapped_column(String, default="")
    status: Mapped[RideStatus] = mapped_column(Enum(RideStatus), default=RideStatus.open)
    accepted_bid_id: Mapped[int | None] = mapped_column(ForeignKey("bids.id"), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_by: Mapped[str | None] = mapped_column(String, nullable=True)
    rider_to_driver_stars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rider_to_driver_comment: Mapped[str | None] = mapped_column(String, nullable=True)
    driver_to_rider_stars: Mapped[int | None] = mapped_column(Integer, nullable=True)
    driver_to_rider_comment: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    rider: Mapped["User"] = relationship(back_populates="rides", foreign_keys=[rider_id])
    bids: Mapped[list["Bid"]] = relationship(
        back_populates="ride",
        foreign_keys="Bid.ride_id",
        cascade="all, delete-orphan",
    )


class Bid(Base):
    __tablename__ = "bids"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    eta_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str] = mapped_column(String, default="")
    status: Mapped[BidStatus] = mapped_column(Enum(BidStatus), default=BidStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ride: Mapped["Ride"] = relationship(back_populates="bids", foreign_keys=[ride_id])
    driver: Mapped["User"] = relationship(back_populates="bids")


class DriverLocation(Base):
    __tablename__ = "driver_locations"

    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="open")
    admin_response: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    msg_type: Mapped[str] = mapped_column(String, default="text")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PushToken(Base):
    __tablename__ = "push_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    platform: Mapped[str] = mapped_column(String, default="expo")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HiddenRide(Base):
    __tablename__ = "hidden_rides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OTP(Base):
    __tablename__ = "otps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    code: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Integer, default=False)
