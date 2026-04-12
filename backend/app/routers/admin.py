from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..auth import require_role
from ..database import get_db
from ..models import Bid, Ride, RideStatus, User, UserRole
from ..schemas import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(UserRole.admin)),
):
    total_users = db.query(func.count(User.id)).scalar()
    total_riders = (
        db.query(func.count(User.id)).filter(User.role == UserRole.rider).scalar()
    )
    total_drivers = (
        db.query(func.count(User.id)).filter(User.role == UserRole.driver).scalar()
    )
    total_rides = db.query(func.count(Ride.id)).scalar()
    open_rides = (
        db.query(func.count(Ride.id))
        .filter(Ride.status == RideStatus.open)
        .scalar()
    )
    active_rides = (
        db.query(func.count(Ride.id))
        .filter(Ride.status.in_([RideStatus.accepted, RideStatus.in_progress]))
        .scalar()
    )
    completed_rides = (
        db.query(func.count(Ride.id))
        .filter(Ride.status == RideStatus.completed)
        .scalar()
    )
    cancelled_rides = (
        db.query(func.count(Ride.id))
        .filter(Ride.status == RideStatus.cancelled)
        .scalar()
    )
    total_bids = db.query(func.count(Bid.id)).scalar()
    total_revenue = (
        db.query(func.sum(Bid.amount))
        .join(Ride, Bid.ride_id == Ride.id)
        .filter(Ride.status == RideStatus.completed, Bid.id == Ride.accepted_bid_id)
        .scalar()
    ) or 0

    return {
        "users": {
            "total": total_users,
            "riders": total_riders,
            "drivers": total_drivers,
        },
        "rides": {
            "total": total_rides,
            "open": open_rides,
            "active": active_rides,
            "completed": completed_rides,
            "cancelled": cancelled_rides,
        },
        "bids": {"total": total_bids},
        "revenue": {"total": round(total_revenue, 2)},
    }


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(UserRole.admin)),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserOut.model_validate(u) for u in users]


@router.get("/rides")
def list_all_rides(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(UserRole.admin)),
):
    from ..routers.rides import _ride_to_out

    rides = (
        db.query(Ride)
        .options(
            joinedload(Ride.rider),
            joinedload(Ride.bids).joinedload(Bid.driver),
        )
        .order_by(Ride.created_at.desc())
        .all()
    )
    return [_ride_to_out(r) for r in rides]
