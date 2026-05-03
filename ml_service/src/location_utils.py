import math
from typing import List, Dict


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two geographic coordinates using Haversine formula.
    Returns distance in kilometers.
    
    Args:
        lat1: Latitude of point 1
        lon1: Longitude of point 1
        lat2: Latitude of point 2
        lon2: Longitude of point 2
        
    Returns:
        Distance in kilometers
    """
    R = 6371  # Earth's radius in kilometers
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def find_nearest_by_location(
    user_location: Dict[str, float],
    items: List[Dict],
    max_distance_km: float = 10.0
) -> List[Dict]:
    """
    Find items nearest to user location.
    
    Args:
        user_location: Dict with 'latitude', 'longitude'
        items: List of items with 'location' field containing 'latitude', 'longitude'
        max_distance_km: Maximum distance to consider (default 10km)
        
    Returns:
        Sorted list of items by distance (nearest first), filtered by max_distance_km
    """
    if not user_location or "latitude" not in user_location or "longitude" not in user_location:
        return []
    
    items_with_distance = []
    user_lat = user_location["latitude"]
    user_lon = user_location["longitude"]
    
    for item in items:
        item_loc = item.get("location", {})
        if not item_loc or "latitude" not in item_loc or "longitude" not in item_loc:
            continue
        
        distance = haversine_distance(
            user_lat,
            user_lon,
            item_loc["latitude"],
            item_loc["longitude"],
        )
        
        if distance <= max_distance_km:
            items_with_distance.append({
                **item,
                "distance_km": round(distance, 2),
            })
    
    # Sort by distance
    items_with_distance.sort(key=lambda x: x["distance_km"])
    return items_with_distance
