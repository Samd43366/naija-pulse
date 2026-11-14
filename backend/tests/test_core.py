"""
Unit tests for core logic (Trust math, H3 utils, Privacy & EXIF stripping).
"""

from app.core.trust_math import (
    calculate_reporter_reputation,
    calculate_vote_distance_weight,
    calculate_effective_vote_weight,
    calculate_incident_trust_score,
)
from app.core.h3_utils import (
    latlng_to_h3,
    h3_to_latlng,
    get_h3_neighbors,
    route_to_h3_corridor,
)
from app.core.privacy import get_public_location


def test_reputation_smoothing():
    # New user starts at 0.5
    assert calculate_reporter_reputation(0, 0) == 0.5
    # Trusted user
    assert calculate_reporter_reputation(10, 0) > 0.9
    # Frequently disputed user
    assert calculate_reporter_reputation(0, 5) < 0.2


def test_distance_decay():
    # At 0m, weight is 1.0
    assert calculate_vote_distance_weight(0) == 1.0
    # At 500m, weight is exactly 0.5
    assert calculate_vote_distance_weight(500) == 0.5
    # Farther away, weight decays significantly
    assert calculate_vote_distance_weight(2000) < 0.1


def test_bayesian_trust_score():
    # Cold start with prior 0.3
    score = calculate_incident_trust_score(prior_score=0.3, confirm_weights=[], dispute_weights=[])
    assert score == 0.3

    # Strong confirms increase trust
    score_high = calculate_incident_trust_score(
        prior_score=0.3,
        confirm_weights=[0.9, 0.8, 0.95, 0.9],
        dispute_weights=[]
    )
    assert score_high >= 0.7

    # Strong disputes decrease trust
    score_low = calculate_incident_trust_score(
        prior_score=0.3,
        confirm_weights=[],
        dispute_weights=[0.9, 0.9]
    )
    assert score_low < 0.2


def test_h3_coordinates():
    # Lagos coordinates: 6.5244 N, 3.3792 E
    lat, lng = 6.5244, 3.3792
    h3_res8 = latlng_to_h3(lat, lng, resolution=8)
    assert isinstance(h3_res8, str)
    assert len(h3_res8) == 15

    # Reverse back to lat/lng
    c_lat, c_lng = h3_to_latlng(h3_res8)
    assert abs(c_lat - lat) < 0.05
    assert abs(c_lng - lng) < 0.05

    # 7 neighbors in k=1 ring
    neighbors = get_h3_neighbors(h3_res8, k=1)
    assert len(neighbors) == 7


def test_route_corridor():
    # A 3-point commute route
    route = [
        (6.5244, 3.3792), # Lagos Mainland
        (6.5100, 3.3900),
        (6.4500, 3.4200), # Victoria Island
    ]
    corridor_hexes = route_to_h3_corridor(route, resolution=8, corridor_ring_buffer=1)
    assert len(corridor_hexes) >= 7
    assert all(isinstance(h, str) for h in corridor_hexes)


def test_privacy_obfuscation():
    lat, lng = 6.5244, 3.3792
    # Non-sensitive stays identical
    pub_lat, pub_lng = get_public_location(lat, lng, is_sensitive=False)
    assert pub_lat == lat and pub_lng == lng

    # Sensitive gets snapped to macro centroid (different coordinates)
    snap_lat, snap_lng = get_public_location(lat, lng, is_sensitive=True)
    assert (snap_lat != lat) or (snap_lng != lng)
    # But within reasonable distance (~1.5km)
    assert abs(snap_lat - lat) < 0.03


def test_nationwide_37_states_seed_coverage():
    from collections import Counter
    from app.services.chatbot_service import load_seed_incidents

    incidents = load_seed_incidents()
    assert len(incidents) >= 740
    by_state = Counter(i["state_name"] for i in incidents)
    assert len(by_state) == 37  # All 36 Nigerian States + FCT Abuja
    assert min(by_state.values()) >= 20


def test_pulse_ai_hybrid_brain():
    from app.services.chatbot_service import answer_question

    # 1. State spatial RAG + map_action
    res_state = answer_question("What is happening in Borno state?")
    assert "Borno" in res_state["reply"]
    assert res_state["map_action"] is not None
    assert abs(res_state["map_action"]["lat"] - 11.8311) < 0.5

    # 2. Emergency hotlines TF-IDF retrieval
    res_kb = answer_question("What are Nigeria emergency phone numbers?")
    assert "112" in res_kb["reply"]

    # 3. Safe AST arithmetic evaluation
    res_math = answer_question("calculate (20 * 37) + 96")
    assert "836" in res_math["reply"]

