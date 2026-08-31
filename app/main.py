from fastapi import FastAPI

from app.config import settings
from app.database import Base, engine
from app.routers import health, wildfires, satellites, recommendation, ai

# Create all database tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-assisted decision-support system for wildfire satellite observation.",
)

# Routers
app.include_router(health.router)
app.include_router(wildfires.router)
app.include_router(satellites.router)
app.include_router(recommendation.router)
app.include_router(ai.router)
