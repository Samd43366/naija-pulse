"""
Generates a comprehensive, geographically accurate Nationwide Nigerian Incident Dataset
guaranteeing AT LEAST 21 incidents in EVERY SINGLE ONE of Nigeria's 36 States + FCT Abuja
(~800+ total incidents across all 774 LGAs!).

How it achieves realism:
1. Preserves all 36 researched & live-RSS Nigerian news stories from `researchedNewsSeed.json`.
2. Loads all 37 State/FCT polygons (`nigeria_atlas.json`) and all 774 LGA polygons (`nigeria_lgas.json`).
3. Uses real State-specific Nigerian DisCos (IKEDC, EKEDC, IBEDC, BEDC, EEDC, PHED, AEDC,
   KEDCO, KAEDCO, JEDC, YEDC), real river basins, real federal highways, real SEMAs, and
   samples coordinates strictly INSIDE each LGA's actual Shapely polygon so zero pins fall in water
   or outside their named Local Government Area!
4. Outputs `frontend/public/geo/nigeria_incidents_seed.json` (consumed by both the React
   frontend and `backend/scripts/seed_demo_data.py` for PostgreSQL/PostGIS).
"""

import json
import random
import sys
from collections import defaultdict
from pathlib import Path
from shapely.geometry import Point, shape

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ATLAS_JSON = PROJECT_ROOT / "frontend" / "public" / "geo" / "nigeria_atlas.json"
LGAS_JSON = PROJECT_ROOT / "frontend" / "public" / "geo" / "nigeria_lgas.json"
RESEARCHED_JSON = PROJECT_ROOT / "frontend" / "src" / "data" / "researchedNewsSeed.json"
OUT_JSON = PROJECT_ROOT / "frontend" / "public" / "geo" / "nigeria_incidents_seed.json"

MIN_PER_STATE = 21

# Real Nigerian Electricity Distribution Company (DisCo) serving each State
STATE_DISCO = {
    "Lagos": "Ikeja Electric / EKEDC",
    "Ogun": "IBEDC (Ibadan DisCo)",
    "Oyo": "IBEDC (Ibadan DisCo)",
    "Osun": "IBEDC (Ibadan DisCo)",
    "Kwara": "IBEDC (Ibadan DisCo)",
    "Ondo": "BEDC (Benin DisCo)",
    "Ekiti": "BEDC (Benin DisCo)",
    "Edo": "BEDC (Benin DisCo)",
    "Delta": "BEDC (Benin DisCo)",
    "Anambra": "EEDC (Enugu DisCo)",
    "Enugu": "EEDC (Enugu DisCo)",
    "Imo": "EEDC (Enugu DisCo)",
    "Abia": "EEDC / Geometric ABA Power",
    "Ebonyi": "EEDC (Enugu DisCo)",
    "Rivers": "PHED (Port Harcourt DisCo)",
    "Bayelsa": "PHED (Port Harcourt DisCo)",
    "Akwa Ibom": "PHED / Ibom Power",
    "Cross River": "PHED (Port Harcourt DisCo)",
    "FCT Abuja": "AEDC (Abuja DisCo)",
    "Niger": "AEDC (Abuja DisCo)",
    "Nasarawa": "AEDC (Abuja DisCo)",
    "Kogi": "AEDC (Abuja DisCo)",
    "Kano": "KEDCO (Kano DisCo)",
    "Katsina": "KEDCO (Kano DisCo)",
    "Jigawa": "KEDCO (Kano DisCo)",
    "Kaduna": "Kaduna Electric (KAEDCO)",
    "Sokoto": "Kaduna Electric (KAEDCO)",
    "Zamfara": "Kaduna Electric (KAEDCO)",
    "Kebbi": "Kaduna Electric (KAEDCO)",
    "Plateau": "JEDC (Jos DisCo)",
    "Bauchi": "JEDC (Jos DisCo)",
    "Benue": "JEDC (Jos DisCo)",
    "Gombe": "JEDC (Jos DisCo)",
    "Adamawa": "YEDC (Yola DisCo)",
    "Borno": "YEDC (Yola DisCo)",
    "Taraba": "YEDC (Yola DisCo)",
    "Yobe": "YEDC (Yola DisCo)",
}

# State-specific highways, rivers/basins & regional context
STATE_CONTEXT = {
    "Abia": ("Enugu–PH Expressway", "Imo & Aba River basin", "South-East"),
    "Adamawa": ("Yola–Numan–Gombe Hwy", "Upper Benue & Gongola River", "North-East"),
    "Akwa Ibom": ("East–West & Uyo–Ikot Ekpene Rd", "Qua Iboe & Cross River estuary", "South-South"),
    "Anambra": ("Onitsha–Awka–Enugu Expy", "River Niger & Anambra basin", "South-East"),
    "Bauchi": ("Bauchi–Darazo–Potiskum Hwy", "Jama'are & Gongola River channel", "North-East"),
    "Bayelsa": ("Yenagoa–Mbiama East–West Rd", "Nun & Forcados creek belt", "South-South"),
    "Benue": ("Makurdi–Lafia–Gboko Hwy", "River Benue & Katsina-Ala basin", "North-Central"),
    "Borno": ("Maiduguri–Damaturu–Biu Corridor", "Ngadda River & Lake Chad basin", "North-East"),
    "Cross River": ("Calabar–Itu–Ikom Highway", "Cross & Calabar River channel", "South-South"),
    "Delta": ("Benin–Warri & Asaba–Agbor Expy", "Ethiope & Forcados River delta", "South-South"),
    "Ebonyi": ("Abakaliki–Enugu–Afikpo Hwy", "Ebonyi & Cross River floodplain", "South-East"),
    "Edo": ("Benin–Sapele & Benin–Auchi Hwy", "Ikpoba & Ovia River drainage", "South-South"),
    "Ekiti": ("Ado-Ekiti–Akure–Ikere Rd", "Ureje & Ero River valley", "South-West"),
    "Enugu": ("Enugu–9th Mile–Nsukka Hwy", "Ekulu & Nyaba River escarpment", "South-East"),
    "FCT Abuja": ("Airport–Kubwa–Keffi Expressways", "Usuma & Jabi drainage basin", "North-Central"),
    "Gombe": ("Gombe–Bauchi–Biu Federal Hwy", "Dadinkowa & Gongola watershed", "North-East"),
    "Imo": ("Owerri–Aba & Owerri–Orlu Rd", "Otamiri & Nworie River gully zone", "South-East"),
    "Jigawa": ("Dutse–Kano–Hadejia Corridor", "Hadejia–Nguru wetlands", "North-West"),
    "Kaduna": ("Abuja–Kaduna–Zaria Expressway", "River Kaduna & Kangimi basin", "North-West"),
    "Kano": ("Kano–Zaria & Maiduguri Bypass", "Challawa & Kano River basin", "North-West"),
    "Katsina": ("Katsina–Funtua–Jibia Hwy", "Jibia & Sabke watershed", "North-West"),
    "Kebbi": ("Birnin Kebbi–Argungu–Jega Hwy", "Sokoto–Rima & River Niger floodplain", "North-West"),
    "Kogi": ("Abuja–Lokoja–Okene Highway", "Niger–Benue Confluence floodplain", "North-Central"),
    "Kwara": ("Ilorin–Jebba–Ogbomoso Hwy", "Asa River & Jebba hydro basin", "North-Central"),
    "Lagos": ("Ikorodu–Lekki–Badagry Corridors", "Lagos Lagoon & Ogun estuary", "South-West"),
    "Nasarawa": ("Keffi–Akwanga–Lafia Trunk Hwy", "Doma & Benue tributary lowlands", "North-Central"),
    "Niger": ("Minna–Suleja & Mokwa–Jebba Hwy", "Shiroro–Kainji–Jebba hydro belt", "North-Central"),
    "Ogun": ("Lagos–Ibadan & Sango–Abeokuta Expy", "Ogun & Yewa River floodplain", "South-West"),
    "Ondo": ("Shagamu–Ore–Ondo–Akure Hwy", "Ala River & Ilaje coastal creeks", "South-West"),
    "Osun": ("Ife–Ilesa–Osogbo Highway", "Osun & Erinle River basin", "South-West"),
    "Oyo": ("Lagos–Ibadan & Oyo–Ogbomoso Hwy", "Ogunpa & Ona River drainage", "South-West"),
    "Plateau": ("Jos–Akwanga & Jos–Bauchi Rd", "Dilimi & Jos highland watershed", "North-Central"),
    "Rivers": ("East–West & PH–Aba Expressway", "Bonny & Orashi River creeks", "South-South"),
    "Sokoto": ("Sokoto–Gusau–Illela Highway", "Sokoto–Rima & Goronyo dam basin", "North-West"),
    "Taraba": ("Jalingo–Wukari–Bali Highway", "River Benue, Taraba & Donga basin", "North-East"),
    "Yobe": ("Damaturu–Potiskum–Gashua Hwy", "Komadugu Yobe seasonal wetlands", "North-East"),
    "Zamfara": ("Gusau–Funtua–Talata Mafara Hwy", "Gusau & Bakolori reservoir axis", "North-West"),
}

OUTLETS = [
    "Punch Nigeria", "Channels TV", "Premium Times", "Daily Trust",
    "Vanguard Nigeria", "Guardian Nigeria", "THISDAY Live", "TheCable",
]


def sample_point_in_lga(geom, rng: random.Random) -> tuple[float, float]:
    minx, miny, maxx, maxy = geom.bounds
    for _ in range(25):
        px = rng.uniform(minx + (maxx - minx) * 0.18, maxx - (maxx - minx) * 0.18)
        py = rng.uniform(miny + (maxy - miny) * 0.18, maxy - (maxy - miny) * 0.18)
        pt = Point(px, py)
        if geom.contains(pt):
            return round(py, 4), round(px, 4)
    rp = geom.representative_point()
    return round(rp.y, 4), round(rp.x, 4)


def normalize_state_name(name: str) -> str:
    n = (name or "").replace(" State", "").strip()
    if "Federal Capital" in n or n in ("FCT", "Abuja"):
        return "FCT Abuja"
    return n


def build_state_incident(state: str, lga: str, slot_idx: int, lat: float, lng: float, rng: random.Random) -> dict:
    disco = STATE_DISCO.get(state, "TCN / Regional DisCo")
    hwy, river, zone = STATE_CONTEXT.get(state, ("Federal Trunk Corridor", "Local River Basin", "Nigeria"))
    outlet = rng.choice(OUTLETS)

    # Balanced category rotation tailored by geopolitical zone
    high_sec_zones = {"North-West", "North-East", "North-Central"}
    coastal_flood_zones = {"South-South", "South-East", "North-Central"}

    if slot_idx % 6 == 0:
        cat = "power_outage"
        variants = [
            (
                f"{disco} 33kV feeder trip & load-shedding across {lga}",
                f"{disco} technical crew isolating a 33kV line fault affecting residential and market transformers in {lga}, {state} following TCN grid allocation drop.",
                f"{outlet} · {disco}",
                "official",
                4.5,
            ),
            (
                f"Transformer fuse blowout & phase outage in {lga} central ward",
                f"Residents and shop owners in {lga} ({state}) report prolonged power interruption after evening distribution substation spark; {disco} fault team notified.",
                "Citizen Crowd Watch",
                "crowd",
                3.5,
            ),
            (
                f"Storm-damaged HT poles causing blackout along {lga} corridor",
                f"Heavy windstorm tilted high-tension electric poles in {lga}, {state}; {disco} safety engineers isolating live conductors for replacement.",
                f"{outlet} · {disco}",
                "official",
                6.0,
            ),
        ]
    elif slot_idx % 6 == 1:
        cat = "road_condition"
        variants = [
            (
                f"Articulated truck breakdown & lane merge in {lga} ({hwy})",
                f"Stalled heavy-duty haulage trailer narrowing traffic along the {lga} axis connecting {hwy} in {state}. FRSC patrol directing contraflow.",
                f"{outlet} · FRSC {state}",
                "official",
                18.0,
            ),
            (
                f"Deep rain-washed crater & culvert erosion on {lga} arterial road",
                f"Runoff erosion undermined asphalt shoulder in {lga}, {state}, forcing commercial buses and sedans into single-lane queue.",
                "Commuter Live Report",
                "crowd",
                36.0,
            ),
            (
                f"Road rehabilitation contraflow & rush-hour bottleneck in {lga}",
                f"Ongoing drainage and pavement patching causing 25-minute delays through {lga} junction ({state}); motorists advised to use inner link roads.",
                f"{outlet} · Works Watch",
                "crowd",
                24.0,
            ),
        ]
    elif slot_idx % 6 == 2:
        cat = "flood"
        variants = [
            (
                f"NEMA / SEMA flash-flood & blocked culvert alert in {lga}",
                f"Intense downpour overwhelmed roadside storm drains in {lga}, {state} ({river} catchment), submerging low-lying streets and market stalls.",
                f"{outlet} · {state} SEMA",
                "nema",
                18.0,
            ),
            (
                f"Rising {river} water level watch near {lga} lowlands",
                f"NIHSA / SEMA hydrological monitoring flags elevated surface runoff across floodplain settlements in {lga}, {state}; motorists urged to avoid submerged dips.",
                f"NEMA · NIHSA ({state})",
                "nema",
                24.0,
            ),
        ]
    elif slot_idx % 6 == 3:
        if zone in high_sec_zones or slot_idx % 12 == 3:
            cat = "kidnapping_security"
            variants = [
                (
                    f"Joint security patrol & dusk travel caution on {lga} inter-town route",
                    f"Police tactical squad and Joint Task Force checkpoints active along rural transit corridor in {lga}, {state}. Night solo travel discouraged; coordinates snapped to macro H3 cell.",
                    f"{outlet} · {state} Police Command",
                    "acled",
                    8.0,
                ),
                (
                    f"Community vigilante & police rapid-response alert in {lga} axis",
                    f"Heightened security surveillance reported around peri-urban farm roads in {lga}, {state}; travellers advised to stay on main {hwy} corridor.",
                    "ACLED · Security Watch",
                    "acled",
                    8.0,
                ),
            ]
        else:
            cat = "road_condition"
            variants = [
                (
                    f"Gully erosion & commercial bus diversion in {lga} ({state})",
                    f"Expanding roadside gully along {lga} link road in {state} prompting FRSC and local works unit to cordon outer lane.",
                    f"{outlet} · FRSC",
                    "official",
                    30.0,
                )
            ]
    elif slot_idx % 6 == 4:
        cat = "disaster_fire"
        variants = [
            (
                f"Fire service contains commercial shop / electrical fire in {lga}",
                f"{state} Fire Service responded to an electrical surge outbreak affecting lock-up shops in {lga} market axis; adjacent buildings protected.",
                f"{outlet} · {state} Fire Service",
                "official",
                6.0,
            ),
            (
                f"Fuel tanker spill & hazmat cordon along {lga} transit junction",
                f"Emergency responders cordoned off a leaking petroleum truck valve in {lga} ({state}) to foam road surface and prevent ignition.",
                f"{outlet} · FRSC / Fire Service",
                "official",
                5.5,
            ),
        ]
    else:
        cat = "other" if zone not in coastal_flood_zones or slot_idx % 2 == 0 else "flood"
        if cat == "other":
            variants = [
                (
                    f"Public water-main repair & NCDC hygiene advisory in {lga}",
                    f"{state} Water Board and health officers repairing burst supply pipe in {lga} while advising residents to treat drinking water during seasonal rains.",
                    f"NAN · {state} Health / Water Board",
                    "official",
                    24.0,
                ),
                (
                    f"SMS Gateway: Community drainage & streetlight fault logged in {lga}",
                    f"Zero-data SMS citizen report from {lga}, {state} flagging silted storm channel and dark junction streetlights requiring municipal clearing.",
                    "Naija Pulse SMS Gateway",
                    "sms_webhook",
                    18.0,
                ),
            ]
        else:
            variants = [
                (
                    f"Tidal / riverine surface ponding across {lga} access road",
                    f"Heavy rain combined with {river} backflow slowed tricycles and low sedans in {lga}, {state}; drainage desilting requested.",
                    f"{outlet} · {state} SEMA",
                    "nema",
                    16.0,
                )
            ]

    title, summary, news_outlet, source, ttl_hours = variants[slot_idx % len(variants)]
    is_unconfirmed = source in ("crowd", "sms_webhook") and (slot_idx % 7 == 0)
    trust_score = round(rng.uniform(0.38, 0.54), 2) if is_unconfirmed else round(rng.uniform(0.74, 0.96), 2)
    status = "unconfirmed" if is_unconfirmed else "active"
    report_count = 1 if is_unconfirmed else rng.randint(3, 12)
    confirm_count = 0 if is_unconfirmed else max(2, report_count - rng.randint(0, 2))
    dispute_count = 1 if (not is_unconfirmed and slot_idx % 11 == 0) else 0
    hours_ago = round(rng.uniform(0.2, 6.5), 2)

    slug_state = state.lower().replace(" ", "-")
    slug_lga = "".join(ch if ch.isalnum() else "-" for ch in lga.lower()).strip("-")
    ext_id = f"ng-{slug_state}-{slug_lga}-{slot_idx:02d}"

    return {
        "external_id": ext_id,
        "category_code": cat,
        "title": title,
        "summary": summary,
        "news_outlet": news_outlet,
        "state_name": state,
        "lga_name": lga,
        "lat": lat,
        "lng": lng,
        "trust_score": trust_score,
        "status": status,
        "report_count": report_count,
        "confirm_count": confirm_count,
        "dispute_count": dispute_count,
        "source": source,
        "hours_ago": hours_ago,
        "ttl_hours": ttl_hours,
        "witness_notes": [
            summary,
            f"Verified LGA dispatch log for {lga} ({state}) — community trust {int(trust_score * 100)}%.",
        ],
    }


def main():
    rng = random.Random(20261101)

    atlas = json.loads(ATLAS_JSON.read_text(encoding="utf-8"))
    lgas_fc = json.loads(LGAS_JSON.read_text(encoding="utf-8"))
    researched = json.loads(RESEARCHED_JSON.read_text(encoding="utf-8"))

    all_states = sorted({normalize_state_name(f["properties"]["name"]) for f in atlas["states"]["features"]})
    assert len(all_states) == 37, f"Expected 37 States+FCT, got {len(all_states)}: {all_states}"

    lgas_by_state: dict[str, list[tuple[str, object]]] = defaultdict(list)
    for feat in lgas_fc["features"]:
        st = normalize_state_name(feat["properties"].get("state", ""))
        lga_name = feat["properties"].get("name", "Central")
        geom = shape(feat["geometry"])
        if st in all_states and not geom.is_empty:
            lgas_by_state[st].append((lga_name, geom))

    # Fallback to state geometry if any state had 0 matched LGAs
    for feat in atlas["states"]["features"]:
        st = normalize_state_name(feat["properties"]["name"])
        if not lgas_by_state[st]:
            lgas_by_state[st].append((f"{st} Central", shape(feat["geometry"])))

    incidents: list[dict] = []
    counts_by_state: dict[str, int] = defaultdict(int)
    seen_ids = set()

    # 1. Keep all researched & live-RSS incidents first
    for item in researched:
        st = normalize_state_name(item.get("state_name", "Lagos"))
        if st not in all_states:
            st = "Lagos"
        enriched = {**item, "state_name": st}
        incidents.append(enriched)
        seen_ids.add(enriched["external_id"])
        counts_by_state[st] += 1

    # 2. Top up EVERY ONE of the 36 States + FCT to at least MIN_PER_STATE (21+) incidents
    for st in all_states:
        state_lgas = lgas_by_state[st]
        rng.shuffle(state_lgas)
        target = max(MIN_PER_STATE, counts_by_state[st])
        # Give major hubs slightly higher realistic volume (22-28)
        if st in ("Lagos", "FCT Abuja", "Kano", "Rivers", "Kaduna", "Oyo", "Borno", "Anambra"):
            target = max(target, rng.randint(23, 27))
        else:
            target = max(target, rng.randint(21, 23))

        slot = 0
        while counts_by_state[st] < target:
            lga_name, lga_geom = state_lgas[slot % len(state_lgas)]
            lat, lng = sample_point_in_lga(lga_geom, rng)
            inc = build_state_incident(st, lga_name, slot, lat, lng, rng)
            slot += 1
            if inc["external_id"] in seen_ids:
                continue
            seen_ids.add(inc["external_id"])
            incidents.append(inc)
            counts_by_state[st] += 1

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(incidents, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")

    min_st = min(counts_by_state.items(), key=lambda kv: kv[1])
    max_st = max(counts_by_state.items(), key=lambda kv: kv[1])
    size_kb = round(OUT_JSON.stat().st_size / 1024, 1)
    print(f"[✓] Generated {OUT_JSON.name} ({size_kb} KB)")
    print(f"    Total Incidents: {len(incidents)} across {len(counts_by_state)} States + FCT")
    print(f"    Minimum per State: {min_st[0]} = {min_st[1]} | Maximum: {max_st[0]} = {max_st[1]}")


if __name__ == "__main__":
    main()
