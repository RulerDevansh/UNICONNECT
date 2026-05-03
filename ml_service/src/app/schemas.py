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


class LocationRequest(BaseModel):
    latitude: float
    longitude: float
    address: str | None = None


class LocationBasedRecommendationRequest(BaseModel):
    user_location: LocationRequest
    listings: list[dict] = Field(default_factory=list, description="List of listings with location data")
    shares: list[dict] = Field(default_factory=list, description="List of shares with location data")
    max_distance_km: float = Field(default=10.0, ge=1.0, le=10.0, description="Maximum distance in kilometers")
    limit: int = Field(default=5, ge=1, le=20)


class LocationBasedRecommendationResponse(BaseModel):
    type: str  # 'listing' or 'share'
    id: str
    title: str
    distance_km: float
    category: str | None = None
