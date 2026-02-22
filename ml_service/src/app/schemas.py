from pydantic import AnyHttpUrl, BaseModel, Field


class RecommendationRequest(BaseModel):
    userId: str | None = Field(default=None, description="User identifier if available")
    recent_item_ids: list[str] = Field(default_factory=list, description="Recent listing identifiers")
    limit: int = Field(default=5, ge=1, le=20)


class RecommendationResponseItem(BaseModel):
    id: str
    score: float
    title: str
    category: str


class ModerationRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    text: str | None = None
    category: str | None = None


class ModerationResponse(BaseModel):
    flagged: bool
    score: float
    reason: str


class AlcoholDetectionRequest(BaseModel):
    image_url: AnyHttpUrl


class AlcoholDetectionResponse(BaseModel):
    filename: AnyHttpUrl
    predicted_class: str
    probability: float
    threshold: float
    blocked: bool
