from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VeilleSourceCreate(BaseModel):
    name: str
    url: str
    feed_type: str = "rss"
    keywords: str = ""


class VeilleSourceOut(BaseModel):
    id: int
    name: str
    url: str
    feed_type: str
    keywords: str
    active: bool
    last_scan: Optional[datetime] = None

    class Config:
        from_attributes = True


class VeilleEntryOut(BaseModel):
    id: int
    source_id: Optional[int] = None
    title: str
    url: str
    description: str
    published_at: Optional[datetime] = None
    detected_at: datetime
    status: str
    estimated_budget: str
    deadline: str
    country: str
    relevance_score: int

    class Config:
        from_attributes = True


class VeilleEntryPatch(BaseModel):
    status: Optional[str] = None
