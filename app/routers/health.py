from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["system"])
def health_check():
    """Returns service health status. Used to verify the backend is running."""
    return {
        "status": "ok",
        "service": "Orbit911",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
