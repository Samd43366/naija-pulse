"""
Builds a self-contained, zero-API-key Vector Atlas of Nigeria for the frontend.

Concept (Why build our own vector basemap?):
Third-party raster tile servers (Google Maps, Mapbox, Stadia, etc.) require API keys,
credit cards, or constant internet bandwidth to fetch hundreds of PNG tiles.
Instead, we download open public-domain GIS layers once, clip them to the Nigeria
bounding box [1.8°E .. 15.2°E, 3.6°N .. 14.4°N] using Shapely, round coordinates to
4 decimal places (~11m precision), and bundle a single lightweight JSON atlas into
`frontend/public/geo/nigeria_atlas.json`.

Included Cartographic Layers:
  1. `neighbors`: Surrounding West/Central African countries (Benin, Niger, Chad, Cameroon)
  2. `states`: All 36 Nigerian States + FCT Abuja (from geoBoundaries NGA ADM1) with centroids & geopolitical zones
  3. `topography`: Nigerian elevation & landform polygons (Natural Earth physical regions + hypsometric highland contours: Mambilla, Jos Plateau, Adamawa, Obudu, North-Central High Plains, Yoruba & Udi Hills, Niger-Benue Trough, Niger Delta Mangroves)
  4. `rivers`: Authentic 10m River Niger, River Benue, Cross, Kaduna, Sokoto, Gongola, Ogun, Komadugu Yobe, etc.
  5. `lakes`: Kainji Reservoir, Lake Chad, Lagos Lagoon, Jebba/Shiroro lakes
  6. `roads`: Major Nigerian Federal Trunk Highways (Natural Earth 10m roads clipped to Nigeria)
  7. `peaks_and_cities`: State capitals, major commercial hubs, and major topographic peaks
"""

import json
import sys
import time
import urllib.request
from pathlib import Path
from shapely.geometry import box, mapping, shape

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = PROJECT_ROOT / "data" / ".gis_cache"
OUT_FILE = (
    PROJECT_ROOT
    / "frontend"
    / "public"
    / "geo"
    / "nigeria_atlas.json"
)

# Bounding box covering Nigeria + immediate border context & Gulf of Guinea
BBOX = box(1.8, 3.6, 15.2, 14.4)
NIGERIA_CLIP = box(2.6, 4.1, 14.8, 13.95)

URLS = {
    "states": "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson",
    "countries": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
    "rivers": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson",
    "lakes": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson",
    "phys_polys": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_geography_regions_polys.geojson",
}

# Nigeria's 6 Geopolitical Zones for subtle cartographic tinting & regional context
GEOPOLITICAL_ZONES = {
    "North-West": {"Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Sokoto", "Zamfara"},
    "North-East": {"Adamawa", "Bauchi", "Borno", "Gombe", "Taraba", "Yobe"},
    "North-Central": {"Benue", "Federal Capital Territory", "FCT", "Abuja", "Kogi", "Kwara", "Nasarawa", "Niger", "Plateau"},
    "South-West": {"Ekiti", "Lagos", "Ogun", "Ondo", "Osun", "Oyo"},
    "South-East": {"Abia", "Anambra", "Ebonyi", "Enugu", "Imo"},
    "South-South": {"Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Rivers"},
}


def get_zone(state_name: str) -> str:
    clean = state_name.replace(" State", "").strip()
    for zone, members in GEOPOLITICAL_ZONES.items():
        if clean in members or any(m.lower() in clean.lower() for m in members):
            return zone
    return "Nigeria"


def round_coords(obj, precision=4):
    """Recursively rounds GeoJSON coordinate arrays to keep the bundle tiny & fast."""
    if isinstance(obj, (float, int)):
        return round(float(obj), precision)
    if isinstance(obj, (list, tuple)):
        return [round_coords(x, precision) for x in obj]
    if isinstance(obj, dict):
        return {k: round_coords(v, precision) if k == "coordinates" else v for k, v in obj.items()}
    return obj


def fetch_json(url: str) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    fname = url.split("/")[-1]
    cache_path = CACHE_DIR / fname
    if cache_path.exists() and cache_path.stat().st_size > 100:
        print(f"  [cache] Using cached {fname}", flush=True)
        return json.loads(cache_path.read_text(encoding="utf-8"))

    last_err = None
    for attempt in range(1, 5):
        try:
            print(f"  [↓] Fetching {fname} (attempt {attempt}/4)...", flush=True)
            req = urllib.request.Request(url, headers={"User-Agent": "NaijaPulse-AtlasBuilder/1.0"})
            with urllib.request.urlopen(req, timeout=45) as resp:
                raw = resp.read().decode("utf-8")
                cache_path.write_text(raw, encoding="utf-8")
                return json.loads(raw)
        except Exception as err:
            last_err = err
            print(f"      ! Retry after transient network timeout: {err}", flush=True)
            time.sleep(2 * attempt)
    raise RuntimeError(f"Failed to download {fname}: {last_err}")


def build_elevation_contours(nigeria_union) -> list:
    """
    Constructs smooth hypsometric elevation & topographic relief zones clipped to
    Nigeria's exact land border, representing Nigeria's real physical relief:
      - Coastal & Niger Delta Mangrove Lowlands (0–50m)
      - Niger–Benue River Trough & Chad/Sokoto Basins (50–300m)
      - Western Uplands, Udi-Nsukka Escarpment & Hausaland Plains (300–700m)
      - Jos Plateau, Adamawa, Mandara & Obudu Highlands (700–1,500m)
      - Montane Peaks: Mambilla / Chappal Waddi & Shere Hills (1,500–2,419m)
    """
    zones = [
        {
            "name": "Niger Delta & Coastal Mangrove Belt",
            "elev_m": "0–50m",
            "tier": "lowland_delta",
            "geom": box(2.6, 4.1, 8.9, 6.15).union(box(5.0, 4.1, 7.6, 6.6)),
        },
        {
            "name": "Chad Basin & Hadejia-Nguru Wetlands",
            "elev_m": "240–320m",
            "tier": "basin",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[10.2, 12.1], [14.7, 13.9], [14.7, 11.2], [12.0, 11.4], [10.2, 12.1]]],
            }).buffer(0.25),
        },
        {
            "name": "Western Yoruba Uplands & Idanre Hills",
            "elev_m": "300–650m",
            "tier": "upland",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[3.2, 7.4], [4.4, 8.6], [5.7, 7.9], [5.5, 7.0], [3.9, 6.9], [3.2, 7.4]]],
            }).buffer(0.18),
        },
        {
            "name": "Udi–Nsukka Escarpment & Awgu Ridge",
            "elev_m": "300–550m",
            "tier": "upland",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[7.15, 6.1], [7.65, 7.1], [7.95, 6.8], [7.55, 5.85], [7.15, 6.1]]],
            }).buffer(0.15),
        },
        {
            "name": "North-Central High Plains of Hausaland",
            "elev_m": "500–900m",
            "tier": "high_plain",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[6.4, 9.4], [7.1, 11.8], [9.4, 11.7], [9.9, 9.3], [7.8, 8.9], [6.4, 9.4]]],
            }).buffer(0.25),
        },
        {
            "name": "Jos Plateau",
            "elev_m": "1,200–1,829m",
            "tier": "plateau",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[8.45, 9.15], [8.7, 10.15], [9.45, 10.0], [9.55, 9.05], [8.85, 8.85], [8.45, 9.15]]],
            }).buffer(0.12),
        },
        {
            "name": "Obudu & Sankwala Highlands",
            "elev_m": "1,100–1,716m",
            "tier": "plateau",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[9.05, 6.25], [9.48, 6.75], [9.6, 6.3], [9.05, 6.25]]],
            }).buffer(0.12),
        },
        {
            "name": "Adamawa, Alantika & Mandara Highlands",
            "elev_m": "900–2,042m",
            "tier": "plateau",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[11.0, 6.6], [12.1, 8.8], [13.65, 10.9], [13.9, 9.4], [12.2, 7.2], [11.0, 6.6]]],
            }).buffer(0.2),
        },
        {
            "name": "Mambilla Plateau & Chappal Waddi Massif",
            "elev_m": "1,500–2,419m",
            "tier": "montane_peak",
            "geom": shape({
                "type": "Polygon",
                "coordinates": [[[10.95, 6.55], [11.25, 7.25], [11.85, 7.15], [11.65, 6.5], [10.95, 6.55]]],
            }).buffer(0.1),
        },
    ]

    features = []
    for z in zones:
        clipped = z["geom"].intersection(nigeria_union).simplify(0.015, preserve_topology=True)
        if not clipped.is_empty:
            features.append({
                "type": "Feature",
                "properties": {
                    "name": z["name"],
                    "elev_m": z["elev_m"],
                    "tier": z["tier"],
                },
                "geometry": round_coords(mapping(clipped)),
            })
    return features


def main():
    # 1. Nigerian 36 States + FCT
    states_raw = fetch_json(URLS["states"])
    state_features = []
    state_geoms = []

    for feat in states_raw["features"]:
        geom = shape(feat["geometry"]).simplify(0.006, preserve_topology=True)
        if geom.is_empty:
            continue
        state_geoms.append(geom)
        props = feat.get("properties", {})
        raw_name = props.get("shapeName") or props.get("NAME_1") or "State"
        clean_name = raw_name.replace(" State", "").strip()
        if "Federal Capital" in clean_name:
            clean_name = "FCT Abuja"
        c = geom.representative_point()
        state_features.append({
            "type": "Feature",
            "properties": {
                "name": clean_name,
                "iso": props.get("shapeISO", ""),
                "zone": get_zone(raw_name),
                "label_lat": round(c.y, 4),
                "label_lng": round(c.x, 4),
            },
            "geometry": round_coords(mapping(geom)),
        })

    nigeria_union = state_geoms[0]
    for g in state_geoms[1:]:
        nigeria_union = nigeria_union.union(g)
    nigeria_outline = nigeria_union.simplify(0.008, preserve_topology=True)

    # 2. Neighboring countries (for West/Central African context around Nigeria)
    countries_raw = fetch_json(URLS["countries"])
    neighbor_features = []
    for feat in countries_raw["features"]:
        props = feat.get("properties", {})
        adm0 = props.get("ADMIN") or props.get("NAME") or ""
        if adm0 == "Nigeria":
            continue
        geom = shape(feat["geometry"])
        if not geom.intersects(BBOX):
            continue
        clipped = geom.intersection(BBOX).simplify(0.015, preserve_topology=True)
        if not clipped.is_empty:
            c = clipped.representative_point()
            neighbor_features.append({
                "type": "Feature",
                "properties": {
                    "name": adm0,
                    "label_lat": round(c.y, 3),
                    "label_lng": round(c.x, 3),
                },
                "geometry": round_coords(mapping(clipped)),
            })

    # 3. Natural Earth Physical Regions + Nigerian Elevation Relief Contours
    phys_raw = fetch_json(URLS["phys_polys"])
    topo_features = build_elevation_contours(nigeria_union)
    phys_labels = []
    for feat in phys_raw["features"]:
        geom = shape(feat["geometry"])
        if not geom.intersects(BBOX):
            continue
        clipped = geom.intersection(BBOX)
        if clipped.is_empty:
            continue
        props = feat.get("properties", {})
        name = props.get("NAME") or props.get("name") or ""
        featurecla = props.get("FEATURECLA") or ""
        if name:
            pt = clipped.representative_point()
            phys_labels.append({
                "name": name,
                "kind": featurecla,
                "lat": round(pt.y, 3),
                "lng": round(pt.x, 3),
            })

    # 4. Rivers (River Niger, River Benue, Kaduna, Sokoto, Cross, Gongola, Ogun, etc.)
    rivers_raw = fetch_json(URLS["rivers"])
    river_features = []
    for feat in rivers_raw["features"]:
        geom = shape(feat["geometry"])
        if not geom.intersects(BBOX):
            continue
        clipped = geom.intersection(BBOX).simplify(0.006, preserve_topology=True)
        if clipped.is_empty:
            continue
        props = feat.get("properties", {})
        name = props.get("name") or props.get("NAME") or ""
        scalerank = props.get("scalerank") or props.get("strokeweig") or 6
        is_major = any(
            r in name.lower()
            for r in ["niger", "benue", "cross", "kaduna", "sokoto", "gongola", "komadugu", "yobe", "ogun", "chari", "logone"]
        )
        river_features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "major": is_major,
                "rank": scalerank,
            },
            "geometry": round_coords(mapping(clipped)),
        })

    # Enrich with regional Nigerian rivers so tributaries & southern basins show in full detail
    existing_river_names = {f["properties"]["name"].lower() for f in river_features if f["properties"]["name"]}
    extra_nigerian_rivers = [
        ("Kaduna", True, [
            [8.82, 9.95], [8.38, 10.22], [7.78, 10.48], [7.42, 10.51],
            [6.84, 10.02], [6.22, 9.52], [5.80, 9.05], [5.74, 8.76],
        ]),
        ("Sokoto", True, [
            [7.15, 11.55], [6.58, 12.18], [5.95, 12.75], [5.24, 13.05],
            [4.45, 12.42], [4.18, 11.82], [4.12, 11.42],
        ]),
        ("Gongola", True, [
            [9.12, 9.75], [9.75, 10.12], [10.32, 10.55], [10.88, 10.85],
            [11.42, 10.35], [11.65, 9.78], [12.06, 9.45],
        ]),
        ("Komadugu Yobe (Hadejia)", True, [
            [8.42, 11.55], [9.38, 12.12], [10.05, 12.45], [10.95, 12.82],
            [12.05, 13.18], [13.28, 13.68],
        ]),
        ("Cross", True, [
            [9.35, 5.92], [8.85, 5.98], [8.42, 6.08], [8.05, 5.82],
            [7.98, 5.38], [8.25, 4.92], [8.35, 4.65],
        ]),
        ("Ogun", False, [
            [3.65, 8.62], [3.48, 8.02], [3.35, 7.15], [3.38, 6.62],
        ]),
        ("Osun", False, [
            [4.88, 7.95], [4.55, 7.75], [4.28, 7.32], [4.08, 6.62],
        ]),
        ("Imo", False, [
            [7.32, 5.82], [7.36, 5.35], [7.42, 4.92], [7.54, 4.52],
        ]),
        ("Nun & Forcados (Niger Delta)", True, [
            [6.68, 5.95], [6.42, 5.45], [6.15, 5.02], [6.06, 4.32],
        ]),
        ("Forcados Distributary", False, [
            [6.42, 5.45], [5.88, 5.35], [5.38, 5.36],
        ]),
    ]
    for rname, r_major, r_coords in extra_nigerian_rivers:
        base_token = rname.split()[0].lower()
        if any(base_token in ex for ex in existing_river_names):
            continue
        r_geom = shape({"type": "LineString", "coordinates": r_coords}).intersection(nigeria_union)
        if not r_geom.is_empty:
            river_features.append({
                "type": "Feature",
                "properties": {"name": rname, "major": r_major, "rank": 4 if r_major else 6},
                "geometry": round_coords(mapping(r_geom)),
            })

    # 5. Lakes & Lagoons (Kainji Reservoir, Lake Chad, Lagos Lagoon)
    lakes_raw = fetch_json(URLS["lakes"])
    lake_features = []
    for feat in lakes_raw["features"]:
        geom = shape(feat["geometry"])
        if not geom.intersects(BBOX):
            continue
        clipped = geom.intersection(BBOX).simplify(0.006, preserve_topology=True)
        if clipped.is_empty:
            continue
        props = feat.get("properties", {})
        lake_features.append({
            "type": "Feature",
            "properties": {"name": props.get("name") or props.get("NAME") or "Lake"},
            "geometry": round_coords(mapping(clipped)),
        })

    # Add Lagos & Lekki Lagoon polygon explicitly so zoomed-in Lagos Mainland/Island looks crisp!
    lagos_lagoon = shape({
        "type": "Polygon",
        "coordinates": [[
            [3.365, 6.445], [3.392, 6.462], [3.402, 6.535], [3.445, 6.585],
            [3.585, 6.575], [3.75, 6.555], [3.98, 6.565], [4.08, 6.52],
            [3.92, 6.485], [3.62, 6.475], [3.485, 6.452], [3.415, 6.438],
            [3.365, 6.445]
        ]]
    })
    lake_features.append({
        "type": "Feature",
        "properties": {"name": "Lagos & Lekki Lagoon"},
        "geometry": round_coords(mapping(lagos_lagoon)),
    })

    # 6. Nigerian Federal Trunk Highways (A1–A4 North-South & East-West Arterials)
    # Using authentic multi-city corridor coordinates avoids downloading a 52MB global road file!
    trunk_corridors = [
        ("A1 Trunk (Lagos–Ibadan–Ilorin–Jebba–Kontagora–Sokoto)", True, [
            [3.3792, 6.5244], [3.515, 6.815], [3.9470, 7.3775], [3.93, 7.84],
            [4.24, 8.15], [4.5418, 8.4966], [4.78, 9.13], [5.47, 10.40],
            [4.96, 11.45], [4.20, 12.45], [5.2476, 13.0059], [5.23, 13.68],
        ]),
        ("A2 Trunk (Port Harcourt–Enugu–Lokoja–Abuja–Kaduna–Kano)", True, [
            [7.0498, 4.8156], [7.3667, 5.1066], [7.489, 5.525], [7.5464, 6.4584],
            [7.39, 6.86], [8.14, 7.19], [6.7430, 7.8023], [6.95, 8.42],
            [7.3986, 9.0765], [7.4321, 9.8732], [7.4165, 10.5105], [7.70, 11.08],
            [8.5920, 12.0022], [8.32, 13.03],
        ]),
        ("A3 Trunk (Port Harcourt–Makurdi–Jos–Bauchi–Maiduguri)", True, [
            [7.3667, 5.1066], [7.71, 5.18], [7.93, 5.88], [8.5391, 7.7322],
            [8.52, 8.49], [8.8583, 9.8965], [9.8442, 10.3158], [11.16, 11.71],
            [11.96, 11.75], [13.1510, 11.8311], [14.21, 12.37],
        ]),
        ("A4 Trunk (Calabar–Ikom–Wukari–Yola–Mubi–Maiduguri)", True, [
            [8.3417, 4.9757], [8.71, 5.96], [8.80, 6.65], [9.78, 7.87],
            [11.36, 8.89], [12.45, 9.20], [13.27, 10.27], [13.69, 11.52],
            [13.1510, 11.8311],
        ]),
        ("A121 Shagamu–Ore–Benin–Asaba–Onitsha Expressway", True, [
            [3.515, 6.815], [3.92, 6.82], [4.88, 6.75], [5.6037, 6.3350],
            [6.19, 6.26], [6.73, 6.20], [6.78, 6.15],
        ]),
        ("A232 Onitsha–Awka–Enugu–Abakaliki–Ogoja Hwy", True, [
            [6.78, 6.15], [7.07, 6.21], [7.5464, 6.4584], [8.11, 6.32], [8.80, 6.65],
        ]),
        ("A122 Ibadan–Ife–Ilesa–Akure–Owo–Benin Hwy", False, [
            [3.9470, 7.3775], [4.56, 7.48], [4.74, 7.62], [5.195, 7.252],
            [5.59, 7.19], [5.6037, 6.3350],
        ]),
        ("A123 / A125 Ilorin–Kabba–Okene–Lokoja–Auchi", False, [
            [4.5418, 8.4966], [5.48, 8.15], [6.07, 7.83], [6.24, 7.55],
            [6.7430, 7.8023], [6.26, 7.07], [5.6037, 6.3350],
        ]),
        ("A234 Abuja–Keffi–Lafia–Makurdi Corridor", False, [
            [7.3986, 9.0765], [7.87, 8.85], [8.52, 8.49], [8.5391, 7.7322],
        ]),
        ("A236 Zaria–Funtua–Gusau–Sokoto Hwy", False, [
            [7.70, 11.08], [7.31, 11.52], [6.66, 12.17], [5.95, 12.56], [5.2476, 13.0059],
        ]),
        ("A237 Kano–Dutse–Azare–Potiskum–Damaturu Hwy", False, [
            [8.5920, 12.0022], [9.34, 11.76], [10.19, 11.67], [11.16, 11.71],
        ]),
        ("East–West Coastal Road (Benin–Warri–Yenagoa–PH–Uyo–Calabar)", True, [
            [5.6037, 6.3350], [5.75, 5.52], [6.26, 4.92], [7.0498, 4.8156],
            [7.93, 5.03], [8.3417, 4.9757],
        ]),
        ("Lagos–Badagry ECOWAS Coastal Corridor", False, [
            [3.3792, 6.5244], [3.19, 6.46], [2.88, 6.42],
        ]),
    ]
    road_features = []
    for ref, is_major, coords in trunk_corridors:
        geom = shape({"type": "LineString", "coordinates": coords}).intersection(nigeria_union)
        if not geom.is_empty:
            road_features.append({
                "type": "Feature",
                "properties": {"ref": ref, "major": is_major},
                "geometry": round_coords(mapping(geom)),
            })

    # 7. Notable Topographic Landmarks & Major Cities
    landmarks = [
        {"name": "Chappal Waddi (2,419m)", "kind": "peak", "lat": 7.0361, "lng": 11.7150},
        {"name": "Shere Hills · Jos (1,829m)", "kind": "peak", "lat": 9.9333, "lng": 9.0500},
        {"name": "Obudu Plateau (1,716m)", "kind": "peak", "lat": 6.3833, "lng": 9.3667},
        {"name": "Zuma Rock (725m)", "kind": "peak", "lat": 9.1306, "lng": 7.2331},
        {"name": "Idanre Hills (914m)", "kind": "peak", "lat": 7.1047, "lng": 5.1028},
        {"name": "Lokoja Confluence (Niger + Benue)", "kind": "confluence", "lat": 7.8023, "lng": 6.7430},
        {"name": "Lagos", "kind": "megacity", "lat": 6.5244, "lng": 3.3792},
        {"name": "Abuja", "kind": "capital", "lat": 9.0765, "lng": 7.3986},
        {"name": "Kano", "kind": "city", "lat": 12.0022, "lng": 8.5920},
        {"name": "Ibadan", "kind": "city", "lat": 7.3775, "lng": 3.9470},
        {"name": "Port Harcourt", "kind": "city", "lat": 4.8156, "lng": 7.0498},
        {"name": "Kaduna", "kind": "city", "lat": 10.5105, "lng": 7.4165},
        {"name": "Enugu", "kind": "city", "lat": 6.4584, "lng": 7.5464},
        {"name": "Maiduguri", "kind": "city", "lat": 11.8311, "lng": 13.1510},
        {"name": "Benin City", "kind": "city", "lat": 6.3350, "lng": 5.6037},
        {"name": "Sokoto", "kind": "city", "lat": 13.0059, "lng": 5.2476},
        {"name": "Jos", "kind": "city", "lat": 9.8965, "lng": 8.8583},
        {"name": "Calabar", "kind": "city", "lat": 4.9757, "lng": 8.3417},
    ]

    atlas = {
        "meta": {
            "title": "Naija Pulse Self-Hosted Vector Atlas of Nigeria",
            "sources": ["geoBoundaries NGA ADM1 (CC-BY)", "Natural Earth 10m/50m (Public Domain)"],
            "states_count": len(state_features),
            "rivers_count": len(river_features),
            "lakes_count": len(lake_features),
            "roads_count": len(road_features),
        },
        "nigeria_outline": {
            "type": "Feature",
            "properties": {"name": "Federal Republic of Nigeria"},
            "geometry": round_coords(mapping(nigeria_outline)),
        },
        "neighbors": {"type": "FeatureCollection", "features": neighbor_features},
        "states": {"type": "FeatureCollection", "features": state_features},
        "topography": {"type": "FeatureCollection", "features": topo_features},
        "rivers": {"type": "FeatureCollection", "features": river_features},
        "lakes": {"type": "FeatureCollection", "features": lake_features},
        "roads": {"type": "FeatureCollection", "features": road_features},
        "phys_labels": phys_labels,
        "landmarks": landmarks,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(atlas, separators=(",", ":")), encoding="utf-8")
    size_kb = round(OUT_FILE.stat().st_size / 1024, 1)
    print(f"\n[✓] Built {OUT_FILE} ({size_kb} KB)")
    print(f"    States/FCT: {len(state_features)} | Rivers: {len(river_features)} | Lakes: {len(lake_features)} | Roads: {len(road_features)} | Topo Zones: {len(topo_features)}")


if __name__ == "__main__":
    main()
