from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Wildfire
from app.schemas import WildfireRead

router = APIRouter(prefix="/api/wildfires", tags=["wildfires"])


@router.get("", response_model=list[WildfireRead])
def list_wildfires(db: Session = Depends(get_db)):
    """Return all wildfire zones."""
    return db.query(Wildfire).order_by(Wildfire.id).all()


@router.get("/{wildfire_id}", response_model=WildfireRead)
def get_wildfire(wildfire_id: int, db: Session = Depends(get_db)):
    """Return a single wildfire zone by ID."""
    wildfire = db.query(Wildfire).filter(Wildfire.id == wildfire_id).first()
    if wildfire is None:
        raise HTTPException(status_code=404, detail=f"Wildfire {wildfire_id} not found")
    return wildfire
