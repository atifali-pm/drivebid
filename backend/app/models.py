from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, PyEnum):
    rider = "rider"
    driver = "driver"


class RideStatus(str, PyEnum):
    open = "open"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class BidStatus(str, PyEnum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
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
    max_budget: Mapped[float] = mapped_column(Float, nullable=False)
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
