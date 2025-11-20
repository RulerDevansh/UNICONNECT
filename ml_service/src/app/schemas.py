from pydantic import BaseModel, Field
from typing import List, Optional


class RecommendationRequest(BaseModel):
    userId: Optional[str] = Field(default=None, description="User identifier if available")
    recent_item_ids: List[str] = Field(default_factory=list, description="Recent listing identifiers")
    limit: int = Field(default=5, ge=1, le=20)


class RecommendationResponseItem(BaseModel):
    id: str
    score: float
    title: str
    category: str


class ModerationRequest(BaseModel):
    title: str
    description: str
    category: Optional[str] = None


class ModerationResponse(BaseModel):
    flagged: bool
    score: float
    reason: str
