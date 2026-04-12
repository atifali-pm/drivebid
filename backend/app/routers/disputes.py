from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Dispute, Ride, User, UserRole
from ..schemas import DisputeCreate, DisputeOut, DisputeResolve

router = APIRouter(prefix="/disputes", tags=["disputes"])


@router.post("", response_model=DisputeOut, status_code=201)
def create_dispute(
    payload: DisputeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ride = db.get(Ride, payload.ride_id)
    if ride is None:
        raise HTTPException(status_code=404, detail="Ride not found")
    dispute = Dispute(
        ride_id=payload.ride_id,
        user_id=user.id,
        category=payload.category,
        description=payload.description,
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)
    return DisputeOut.model_validate(dispute)


@router.get("/mine", response_model=list[DisputeOut])
def list_my_disputes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    disputes = (
        db.query(Dispute)
        .filter(Dispute.user_id == user.id)
        .order_by(Dispute.created_at.desc())
        .all()
    )
    return [DisputeOut.model_validate(d) for d in disputes]


@router.get("/all", response_model=list[DisputeOut])
def list_all_disputes(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(UserRole.admin)),
):
    disputes = db.query(Dispute).order_by(Dispute.created_at.desc()).all()
    return [DisputeOut.model_validate(d) for d in disputes]


@router.post("/{dispute_id}/resolve", response_model=DisputeOut)
def resolve_dispute(
    dispute_id: int,
    payload: DisputeResolve,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(UserRole.admin)),
):
    dispute = db.get(Dispute, dispute_id)
    if dispute is None:
        raise HTTPException(status_code=404, detail="Dispute not found")
    dispute.status = "resolved"
    dispute.admin_response = payload.admin_response
    dispute.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(dispute)
    return DisputeOut.model_validate(dispute)
