from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Bid, BidStatus, Ride, RideStatus, User, UserRole
from ..schemas import BidCreate, BidOut, RatingCreate, RideCreate, RideOut


def _accepted_driver_id(ride: Ride) -> int | None:
    if ride.accepted_bid_id is None:
        return None
    for b in ride.bids:
        if b.id == ride.accepted_bid_id:
            return b.driver_id
    return None

router = APIRouter(prefix="/rides", tags=["rides"])


def _ride_to_out(ride: Ride) -> RideOut:
    data = RideOut.model_validate(ride)
    data.rider_name = ride.rider.full_name if ride.rider else None
    data.bids = [
        BidOut(
            id=b.id,
            ride_id=b.ride_id,
            driver_id=b.driver_id,
            driver_name=b.driver.full_name if b.driver else None,
            amount=b.amount,
            eta_minutes=b.eta_minutes,
            message=b.message,
            status=b.status,
            created_at=b.created_at,
        )
        for b in ride.bids
    ]
    return data


@router.post("", response_model=RideOut, status_code=201)
def create_ride(
    payload: RideCreate,
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
        notes=payload.notes,
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    return _ride_to_out(ride)


@router.get("/open", response_model=list[RideOut])
def list_open_rides(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.driver)),
):
    rides = (
        db.query(Ride)
        .options(joinedload(Ride.rider), joinedload(Ride.bids).joinedload(Bid.driver))
        .filter(Ride.status == RideStatus.open)
        .order_by(Ride.created_at.desc())
        .all()
    )
    return [_ride_to_out(r) for r in rides]


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
    return [_ride_to_out(r) for r in rides]


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
    return _ride_to_out(ride)


@router.post("/{ride_id}/bids", response_model=BidOut, status_code=201)
def place_bid(
    ride_id: int,
    payload: BidCreate,
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
    return BidOut(
        id=bid.id,
        ride_id=bid.ride_id,
        driver_id=bid.driver_id,
        driver_name=user.full_name,
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
    for other in ride.bids:
        if other.id != bid.id:
            other.status = BidStatus.rejected
    db.commit()
    db.refresh(ride)
    return _ride_to_out(ride)


@router.post("/{ride_id}/start", response_model=RideOut)
def start_ride(
    ride_id: int,
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
    return _ride_to_out(ride)


@router.post("/{ride_id}/complete", response_model=RideOut)
def complete_ride(
    ride_id: int,
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
    return _ride_to_out(ride)


@router.post("/{ride_id}/cancel", response_model=RideOut)
def cancel_ride(
    ride_id: int,
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
    db.commit()
    db.refresh(ride)
    return _ride_to_out(ride)


@router.post("/{ride_id}/rate", response_model=RideOut)
def rate_ride(
    ride_id: int,
    payload: RatingCreate,
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
    db.commit()
    db.refresh(ride)
    return _ride_to_out(ride)
