from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Bid, BidStatus, DriverLocation, HiddenRide, Message, Ride, RideStatus, User, UserRole
from ..schemas import BidCreate, BidOut, RatingCreate, RideCreate, RideOut
from ..pricing import format_money
from ..ws import manager
from ..push import send_to_user as send_push

REFRESH = {"type": "refresh"}


def _accepted_driver_id(ride: Ride) -> int | None:
    if ride.accepted_bid_id is None:
        return None
    for b in ride.bids:
        if b.id == ride.accepted_bid_id:
            return b.driver_id
    return None

router = APIRouter(prefix="/rides", tags=["rides"])


def _driver_stats(driver_id: int, db) -> tuple[float | None, int]:
    """Return (avg_rating, trip_count) for a driver."""
    from sqlalchemy import func
    result = db.query(
        func.avg(Ride.rider_to_driver_stars),
        func.count(Ride.id),
    ).join(Bid, Bid.ride_id == Ride.id).filter(
        Bid.driver_id == driver_id,
        Ride.accepted_bid_id == Bid.id,
        Ride.status == RideStatus.completed,
    ).first()
    avg_rating = round(result[0], 1) if result[0] is not None else None
    trip_count = result[1] or 0
    return avg_rating, trip_count


def _ride_to_out(ride: Ride, db=None) -> RideOut:
    data = RideOut.model_validate(ride)
    data.rider_name = ride.rider.full_name if ride.rider else None
    data.bids = []
    for b in ride.bids:
        rating, trips = (None, 0)
        if db and b.driver:
            rating, trips = _driver_stats(b.driver_id, db)
        data.bids.append(BidOut(
            id=b.id,
            ride_id=b.ride_id,
            driver_id=b.driver_id,
            driver_name=b.driver.full_name if b.driver else None,
            driver_phone=b.driver.phone if b.driver else None,
            driver_vehicle_type=b.driver.vehicle_type if b.driver else None,
            driver_vehicle_model=b.driver.vehicle_model if b.driver else None,
            driver_vehicle_plate=b.driver.vehicle_plate if b.driver else None,
            driver_rating=rating,
            driver_trip_count=trips,
            amount=b.amount,
            eta_minutes=b.eta_minutes,
            message=b.message,
            status=b.status,
            created_at=b.created_at,
        ))
    return data


@router.post("", response_model=RideOut, status_code=201)
def create_ride(
    payload: RideCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.rider)),
):
    ride = Ride(
        rider_id=user.id,
        pickup=payload.pickup,
        dropoff=payload.dropoff,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        dropoff_lat=payload.dropoff_lat,
        dropoff_lng=payload.dropoff_lng,
        distance_km=payload.distance_km,
        duration_min=payload.duration_min,
        estimated_fare=payload.estimated_fare,
        max_budget=payload.max_budget,
        ride_type=payload.ride_type,
        notes=payload.notes,
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    bg.add_task(manager.broadcast, REFRESH)
    return _ride_to_out(ride, db)


@router.get("/open", response_model=list[RideOut])
def list_open_rides(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    hidden_ids = (
        db.query(HiddenRide.ride_id)
        .filter(HiddenRide.driver_id == user.id)
        .subquery()
    )
    rides = (
        db.query(Ride)
        .options(joinedload(Ride.rider), joinedload(Ride.bids).joinedload(Bid.driver))
        .filter(Ride.status == RideStatus.open)
        .filter(Ride.id.notin_(hidden_ids))
        .order_by(Ride.created_at.desc())
        .all()
    )
    return [_ride_to_out(r, db) for r in rides]


@router.post("/{ride_id}/hide")
def hide_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    existing = (
        db.query(HiddenRide)
        .filter(HiddenRide.driver_id == user.id, HiddenRide.ride_id == ride_id)
        .first()
    )
    if not existing:
        db.add(HiddenRide(driver_id=user.id, ride_id=ride_id))
        db.commit()
    return {"status": "hidden"}


@router.delete("/{ride_id}/hide")
def unhide_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    hidden = (
        db.query(HiddenRide)
        .filter(HiddenRide.driver_id == user.id, HiddenRide.ride_id == ride_id)
        .first()
    )
    if hidden:
        db.delete(hidden)
        db.commit()
    return {"status": "restored"}


@router.get("/hidden", response_model=list[RideOut])
def list_hidden_rides(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    hidden_ids = (
        db.query(HiddenRide.ride_id)
        .filter(HiddenRide.driver_id == user.id)
        .subquery()
    )
    rides = (
        db.query(Ride)
        .options(joinedload(Ride.rider), joinedload(Ride.bids).joinedload(Bid.driver))
        .filter(Ride.status == RideStatus.open)
        .filter(Ride.id.in_(hidden_ids))
        .order_by(Ride.created_at.desc())
        .all()
    )
    return [_ride_to_out(r, db) for r in rides]


@router.get("/mine", response_model=list[RideOut])
def list_my_rides(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Ride).options(
        joinedload(Ride.rider), joinedload(Ride.bids).joinedload(Bid.driver)
    )
    if user.role == UserRole.rider:
        query = query.filter(Ride.rider_id == user.id)
    else:
        query = query.join(Bid, Bid.ride_id == Ride.id).filter(Bid.driver_id == user.id)
    rides = query.order_by(Ride.created_at.desc()).all()
    return [_ride_to_out(r, db) for r in rides]


@router.get("/{ride_id}", response_model=RideOut)
def get_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ride = (
        db.query(Ride)
        .options(joinedload(Ride.rider), joinedload(Ride.bids).joinedload(Bid.driver))
        .filter(Ride.id == ride_id)
        .first()
    )
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    return _ride_to_out(ride, db)


@router.post("/{ride_id}/bids", response_model=BidOut, status_code=201)
def place_bid(
    ride_id: int,
    payload: BidCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.status != RideStatus.open:
        raise HTTPException(status_code=400, detail="Ride is no longer open for bidding")
    if payload.amount <= 0 or payload.eta_minutes <= 0:
        raise HTTPException(status_code=400, detail="Invalid bid values")
    if payload.amount > ride.max_budget:
        raise HTTPException(
            status_code=400,
            detail=f"Bid exceeds rider's max budget of {ride.max_budget}",
        )
    bid = Bid(
        ride_id=ride_id,
        driver_id=user.id,
        amount=payload.amount,
        eta_minutes=payload.eta_minutes,
        message=payload.message,
    )
    db.add(bid)
    db.commit()
    db.refresh(bid)
    bg.add_task(manager.send_to_user, ride.rider_id, REFRESH)
    bg.add_task(
        send_push, db, ride.rider_id,
        "New bid!",
        f"{user.full_name} bid Rs {int(bid.amount)} · ETA {bid.eta_minutes} min",
        {"type": "new_bid", "ride_id": ride.id},
    )
    return BidOut(
        id=bid.id,
        ride_id=bid.ride_id,
        driver_id=bid.driver_id,
        driver_name=user.full_name,
        driver_vehicle_type=user.vehicle_type,
        driver_vehicle_model=user.vehicle_model,
        driver_vehicle_plate=user.vehicle_plate,
        amount=bid.amount,
        eta_minutes=bid.eta_minutes,
        message=bid.message,
        status=bid.status,
        created_at=bid.created_at,
    )


@router.post("/{ride_id}/accept/{bid_id}", response_model=RideOut)
def accept_bid(
    ride_id: int,
    bid_id: int,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.rider)),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.rider_id != user.id:
        raise HTTPException(status_code=403, detail="Not your ride")
    if ride.status != RideStatus.open:
        raise HTTPException(status_code=400, detail="Ride is not open")
    bid = db.get(Bid, bid_id)
    if bid is None or bid.ride_id != ride_id:
        raise HTTPException(status_code=404, detail="Bid not found for this ride")

    bid.status = BidStatus.accepted
    ride.accepted_bid_id = bid.id
    ride.status = RideStatus.accepted
    driver_ids = [b.driver_id for b in ride.bids]
    for other in ride.bids:
        if other.id != bid.id:
            other.status = BidStatus.rejected
    db.commit()
    db.refresh(ride)
    bg.add_task(manager.send_to_users, driver_ids, REFRESH)
    bg.add_task(
        send_push, db, bid.driver_id,
        "Your bid was accepted!",
        f"{ride.rider.full_name if ride.rider else 'Rider'} picked you — Rs {int(bid.amount)}",
        {"type": "bid_accepted", "ride_id": ride.id},
    )
    return _ride_to_out(ride, db)


@router.post("/{ride_id}/start", response_model=RideOut)
def start_ride(
    ride_id: int,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if _accepted_driver_id(ride) != user.id:
        raise HTTPException(status_code=403, detail="You are not the accepted driver")
    if ride.status != RideStatus.accepted:
        raise HTTPException(status_code=400, detail="Ride is not in accepted state")
    ride.status = RideStatus.in_progress
    ride.started_at = datetime.utcnow()
    db.commit()
    db.refresh(ride)
    bg.add_task(manager.send_to_user, ride.rider_id, REFRESH)
    return _ride_to_out(ride, db)


@router.post("/{ride_id}/complete", response_model=RideOut)
def complete_ride(
    ride_id: int,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if _accepted_driver_id(ride) != user.id:
        raise HTTPException(status_code=403, detail="You are not the accepted driver")
    if ride.status != RideStatus.in_progress:
        raise HTTPException(status_code=400, detail="Ride is not in progress")
    ride.status = RideStatus.completed
    ride.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(ride)
    bg.add_task(manager.send_to_user, ride.rider_id, REFRESH)
    return _ride_to_out(ride, db)


@router.post("/{ride_id}/cancel", response_model=RideOut)
def cancel_ride(
    ride_id: int,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    is_rider = user.id == ride.rider_id
    is_driver = _accepted_driver_id(ride) == user.id
    if not (is_rider or is_driver):
        raise HTTPException(status_code=403, detail="Not a participant of this ride")
    if ride.status not in (RideStatus.open, RideStatus.accepted):
        raise HTTPException(
            status_code=400, detail="Ride can no longer be cancelled"
        )
    ride.status = RideStatus.cancelled
    ride.cancelled_at = datetime.utcnow()
    ride.cancelled_by = "rider" if is_rider else "driver"
    notify_ids = []
    if is_rider:
        driver = _accepted_driver_id(ride)
        if driver:
            notify_ids.append(driver)
    else:
        notify_ids.append(ride.rider_id)
    db.commit()
    db.refresh(ride)
    bg.add_task(manager.send_to_users, notify_ids, REFRESH)
    bg.add_task(manager.broadcast, REFRESH)
    return _ride_to_out(ride, db)


@router.post("/{ride_id}/rate", response_model=RideOut)
def rate_ride(
    ride_id: int,
    payload: RatingCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.stars < 1 or payload.stars > 5:
        raise HTTPException(status_code=400, detail="Stars must be between 1 and 5")
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.status != RideStatus.completed:
        raise HTTPException(
            status_code=400, detail="Ride must be completed before rating"
        )
    if user.id == ride.rider_id:
        if ride.rider_to_driver_stars is not None:
            raise HTTPException(status_code=400, detail="Already rated")
        ride.rider_to_driver_stars = payload.stars
        ride.rider_to_driver_comment = payload.comment
    elif _accepted_driver_id(ride) == user.id:
        if ride.driver_to_rider_stars is not None:
            raise HTTPException(status_code=400, detail="Already rated")
        ride.driver_to_rider_stars = payload.stars
        ride.driver_to_rider_comment = payload.comment
    else:
        raise HTTPException(status_code=403, detail="Not a participant of this ride")
    other_id = _accepted_driver_id(ride) if user.id == ride.rider_id else ride.rider_id
    db.commit()
    db.refresh(ride)
    if other_id:
        bg.add_task(manager.send_to_user, other_id, REFRESH)
    return _ride_to_out(ride, db)


@router.get("/{ride_id}/receipt")
def get_receipt(
    ride_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.status != RideStatus.completed:
        raise HTTPException(status_code=400, detail="Ride not yet completed")
    if user.id != ride.rider_id and _accepted_driver_id(ride) != user.id:
        raise HTTPException(status_code=403, detail="Not a participant")

    accepted = None
    driver_name = None
    for b in ride.bids:
        if b.id == ride.accepted_bid_id:
            accepted = b
            driver_name = b.driver.full_name if b.driver else None
            break

    fare = accepted.amount if accepted else ride.max_budget
    from ..pricing import PRICING

    commission = round(fare * PRICING["platform_commission_pct"] / 100, 2)
    driver_earnings = round(fare - commission, 2)

    return {
        "ride_id": ride.id,
        "pickup": ride.pickup,
        "dropoff": ride.dropoff,
        "distance_km": ride.distance_km,
        "duration_min": ride.duration_min,
        "rider_name": ride.rider.full_name if ride.rider else None,
        "driver_name": driver_name,
        "fare": fare,
        "fare_formatted": format_money(fare),
        "platform_commission_pct": PRICING["platform_commission_pct"],
        "platform_commission": commission,
        "driver_earnings": driver_earnings,
        "started_at": ride.started_at.isoformat() if ride.started_at else None,
        "completed_at": ride.completed_at.isoformat() if ride.completed_at else None,
        "rider_rating": ride.rider_to_driver_stars,
        "driver_rating": ride.driver_to_rider_stars,
    }


@router.post("/{ride_id}/driver-location")
def update_driver_location(
    ride_id: int,
    lat: float,
    lng: float,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if _accepted_driver_id(ride) != user.id:
        raise HTTPException(status_code=403, detail="Not the accepted driver")
    if ride.status not in (RideStatus.accepted, RideStatus.in_progress):
        raise HTTPException(status_code=400, detail="Ride not active")

    loc = db.get(DriverLocation, user.id)
    if loc:
        loc.lat = lat
        loc.lng = lng
        loc.updated_at = datetime.utcnow()
    else:
        loc = DriverLocation(driver_id=user.id, lat=lat, lng=lng)
        db.add(loc)
    db.commit()

    bg.add_task(
        manager.send_to_user,
        ride.rider_id,
        {"type": "driver_location", "lat": lat, "lng": lng},
    )
    return {"status": "ok"}


@router.get("/{ride_id}/driver-location")
def get_driver_location(
    ride_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user.id != ride.rider_id:
        raise HTTPException(status_code=403, detail="Only the rider can view this")

    driver_id = _accepted_driver_id(ride)
    if not driver_id:
        return {"lat": None, "lng": None}

    loc = db.get(DriverLocation, driver_id)
    if not loc:
        return {"lat": None, "lng": None}
    return {"lat": loc.lat, "lng": loc.lng, "updated_at": loc.updated_at.isoformat()}


# ---------------------------------------------------------------------------
# In-ride messaging
# ---------------------------------------------------------------------------

class MessageCreate(BaseModel):
    content: str
    msg_type: str = "text"


@router.post("/{ride_id}/messages")
def send_message(
    ride_id: int,
    payload: MessageCreate,
    bg: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride.status not in (RideStatus.accepted, RideStatus.in_progress):
        raise HTTPException(status_code=400, detail="Chat only available for active rides")

    # Only rider or accepted driver can send
    accepted_driver = _accepted_driver_id(ride)
    if user.id != ride.rider_id and user.id != accepted_driver:
        raise HTTPException(status_code=403, detail="Not a participant in this ride")

    msg = Message(
        ride_id=ride_id,
        sender_id=user.id,
        content=payload.content,
        msg_type=payload.msg_type,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # Notify the other party via WebSocket
    recipient_id = ride.rider_id if user.id == accepted_driver else accepted_driver
    if recipient_id:
        bg.add_task(
            manager.send_to_user,
            recipient_id,
            {
                "type": "message",
                "ride_id": ride_id,
                "sender_id": user.id,
                "sender_name": user.full_name,
                "content": msg.content,
                "msg_type": msg.msg_type,
                "created_at": msg.created_at.isoformat(),
            },
        )
        preview = (
            "🎤 Voice message"
            if msg.msg_type == "voice"
            else (msg.content[:80] + "…" if len(msg.content) > 80 else msg.content)
        )
        bg.add_task(
            send_push, db, recipient_id,
            user.full_name,
            preview,
            {"type": "message", "ride_id": ride_id},
        )

    return {
        "id": msg.id,
        "ride_id": msg.ride_id,
        "sender_id": msg.sender_id,
        "sender_name": user.full_name,
        "content": msg.content,
        "msg_type": msg.msg_type,
        "created_at": msg.created_at.isoformat(),
    }


@router.get("/{ride_id}/messages")
def list_messages(
    ride_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ride = db.get(Ride, ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")

    accepted_driver = _accepted_driver_id(ride)
    if user.id != ride.rider_id and user.id != accepted_driver:
        raise HTTPException(status_code=403, detail="Not a participant in this ride")

    msgs = (
        db.query(Message)
        .filter(Message.ride_id == ride_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    # Get sender names
    user_ids = {m.sender_id for m in msgs}
    users = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    return [
        {
            "id": m.id,
            "ride_id": m.ride_id,
            "sender_id": m.sender_id,
            "sender_name": users.get(m.sender_id, "Unknown"),
            "content": m.content,
            "msg_type": m.msg_type,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs
    ]


