import math
from typing import List, Dict, Tuple, Optional
import numpy as np


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


def calculate_centroid(points: List[Dict]) -> Dict[str, float]:
    """
    Calculate centroid of a list of coordinates.
    
    Args:
        points: List of dicts with 'latitude' and 'longitude' keys
        
    Returns:
        Dict with centroid 'latitude' and 'longitude'
    """
    if not points:
        return {"latitude": 0.0, "longitude": 0.0}
    
    lat_sum = sum(p.get("latitude", 0) for p in points)
    lon_sum = sum(p.get("longitude", 0) for p in points)
    
    return {
        "latitude": lat_sum / len(points),
        "longitude": lon_sum / len(points),
    }


def kmeans_clustering(
    points: List[Dict],
    k: int = 3,
    max_iterations: int = 10
) -> List[List[Dict]]:
    """
    Simple k-means clustering for geographical points.
    
    Args:
        points: List of dicts with 'id', 'latitude', 'longitude', etc.
        k: Number of clusters
        max_iterations: Maximum iterations
        
    Returns:
        List of clusters, each containing list of points
    """
    if not points or k <= 0:
        return []
    
    num_clusters = min(k, len(points))
    
    # Initialize centroids reproducibly without mutating NumPy's global RNG state.
    rng = np.random.RandomState(42)
    indices = rng.choice(len(points), num_clusters, replace=False)
    centroids = [
        {
            "latitude": points[i]["latitude"],
            "longitude": points[i]["longitude"],
        }
        for i in indices
    ]
    
    previous_centroids = None
    
    for iteration in range(max_iterations):
        # Assign points to nearest centroid
        clusters = [[] for _ in range(num_clusters)]
        
        for point in points:
            min_distance = float("inf")
            nearest_idx = 0
            
            for i, centroid in enumerate(centroids):
                dist = haversine_distance(
                    point["latitude"],
                    point["longitude"],
                    centroid["latitude"],
                    centroid["longitude"],
                )
                if dist < min_distance:
                    min_distance = dist
                    nearest_idx = i
            
            clusters[nearest_idx].append(point)
        
        # Calculate new centroids
        new_centroids = [
            calculate_centroid(cluster) if cluster else centroids[i]
            for i, cluster in enumerate(clusters)
        ]
        
        # Check for convergence
        if previous_centroids:
            converged = all(
                haversine_distance(
                    prev["latitude"],
                    prev["longitude"],
                    new["latitude"],
                    new["longitude"],
                ) < 0.1
                for prev, new in zip(previous_centroids, new_centroids)
            )
            if converged:
                break
        
        centroids = new_centroids
        previous_centroids = [dict(c) for c in new_centroids]
    
    return clusters


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
