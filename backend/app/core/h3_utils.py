"""
Uber H3 Geospatial Utility Library for Naija Pulse.

Concepts explained:
1. Discrete Global Grid System (DGGS):
   Instead of working with arbitrary lat/lng floating-point coordinates and complex
   polygon mathematics, H3 tiles the entire Earth into uniform hexagonal cells.
2. Multi-Resolution Hierarchy:
   - Resolution 7 (~1.2 km edge, ~5 km² area): Regional summaries, macro heatmaps.
   - Resolution 8 (~460 m edge, ~0.7 km² area): Local community zones, deduplication.
   - Resolution 9 (~174 m edge, ~0.1 km² area): Street / junction level precision.
3. K-Ring (Disk) Neighbors:
   Every hexagon has exactly 6 neighbors. Finding everything in the immediate neighborhood
   takes O(1) integer arithmetic, requiring no expensive geometric distance math.
"""

from typing import List, Tuple, Set

try:
    import h3
except (ImportError, OSError):
    # Some managed Windows environments block native extension DLLs. Keep the
    # local API usable with a deterministic coarse grid; production should use
    # the real H3 package for spatial accuracy and interoperability.
    h3 = None


def _fallback_encode(lat: float, lng: float, resolution: int) -> str:
    lat_i = max(0, min(360000, round((lat + 90.0) * 1000)))
    lng_i = max(0, min(720000, round((lng + 180.0) * 1000)))
    return f"f{resolution:x}{lat_i:04x}{lng_i:05x}".ljust(15, "0")[:15]


def _fallback_decode(index: str) -> Tuple[float, float, int]:
    try:
        resolution = int(index[1], 16)
        lat_i = int(index[2:6], 16)
        lng_i = int(index[6:11], 16)
        return lat_i / 1000.0 - 90.0, lng_i / 1000.0 - 180.0, resolution
    except (ValueError, IndexError):
        return 0.0, 0.0, 8


def latlng_to_h3(lat: float, lng: float, resolution: int = 8) -> str:
    """Convert (latitude, longitude) to an H3 index string."""
    if h3 is None:
        return _fallback_encode(lat, lng, resolution)
    # h3 v4 uses latlng_to_cell, v3 uses geo_to_h3
    if hasattr(h3, "latlng_to_cell"):
        return h3.latlng_to_cell(lat, lng, resolution)
    return h3.geo_to_h3(lat, lng, resolution)


def h3_to_latlng(h3_index: str) -> Tuple[float, float]:
    """Convert an H3 index back to its centroid (latitude, longitude)."""
    if h3 is None:
        lat, lng, _ = _fallback_decode(h3_index)
        return lat, lng
    if hasattr(h3, "cell_to_latlng"):
        return h3.cell_to_latlng(h3_index)
    return h3.h3_to_geo(h3_index)


def get_h3_neighbors(h3_index: str, k: int = 1) -> List[str]:
    """
    Get the hexagon and all its surrounding neighbors up to distance k.
    k=1 returns 7 hexes (center + 6 immediate neighbors).
    k=2 returns 19 hexes.
    """
    if h3 is None:
        lat, lng, resolution = _fallback_decode(h3_index)
        step = 0.01 * max(1, k)
        cells = {h3_index}
        for dx, dy in ((step, 0), (-step, 0), (0, step), (0, -step), (step, step), (-step, -step)):
            cells.add(_fallback_encode(lat + dx, lng + dy, resolution))
        return sorted(cells)
    if hasattr(h3, "grid_disk"):
        return list(h3.grid_disk(h3_index, k))
    return list(h3.k_ring(h3_index, k))


def get_h3_boundary(h3_index: str) -> List[Tuple[float, float]]:
    """
    Returns the list of (lat, lng) vertices representing the polygon of the hexagon.
    Useful for rendering hex overlays on Leaflet/MapLibre.
    """
    if h3 is None:
        lat, lng, _ = _fallback_decode(h3_index)
        step = 0.005
        return [(lat + step, lng), (lat + step / 2, lng + step), (lat - step / 2, lng + step),
                (lat - step, lng), (lat - step / 2, lng - step), (lat + step / 2, lng - step)]
    if hasattr(h3, "cell_to_boundary"):
        return h3.cell_to_boundary(h3_index)
    return h3.h3_to_geo_boundary(h3_index)


def route_to_h3_corridor(
    coordinates: List[Tuple[float, float]],
    resolution: int = 8,
    corridor_ring_buffer: int = 1
) -> List[str]:
    """
    Given a series of route points [(lat1, lng1), (lat2, lng2), ...],
    computes the set of H3 hexagons covering the route plus a buffer ring.
    
    This turns an entire commute route into a fast discrete array of hex keys!
    """
    hex_set: Set[str] = set()
    for lat, lng in coordinates:
        center_hex = latlng_to_h3(lat, lng, resolution)
        neighbors = get_h3_neighbors(center_hex, k=corridor_ring_buffer)
        hex_set.update(neighbors)
    return sorted(list(hex_set))
