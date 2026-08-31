from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Satellite
from app.schemas import SatelliteRead

router = APIRouter(prefix="/api/satellites", tags=["satellites"])


@router.get("", response_model=list[SatelliteRead])
def list_satellites(db: Session = Depends(get_db)):
    """Return all satellites."""
    return db.query(Satellite).order_by(Satellite.id).all()


@router.get("/{satellite_id}", response_model=SatelliteRead)
def get_satellite(satellite_id: int, db: Session = Depends(get_db)):
    """Return a single satellite by ID."""
    satellite = db.query(Satellite).filter(Satellite.id == satellite_id).first()
    if satellite is None:
        raise HTTPException(status_code=404, detail=f"Satellite {satellite_id} not found")
    return satellite
