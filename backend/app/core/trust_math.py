"""
Trust, Reputation and Bayesian Scoring Mathematics for Naija Pulse.

Concepts explained:
1. Laplace-Smoothed Reputation:
   Prevents the 'cold start' problem and division by zero. A brand-new reporter
   starts with a neutral 0.5 reputation rather than 0 or 1.
2. Distance-Decay Verification Weight:
   A citizen standing 50m away has vastly more empirical credibility than someone
   voting from 5km away. We use a Cauchy/quadratic inverse distance decay function.
3. Bayesian Updating for Incident Trust:
   Combines historical prior risk P0 (from ACLED/NEMA) with crowdsourced witness
   confirmations and disputes.
"""

from typing import List, Tuple


def calculate_reporter_reputation(confirmed: int, disputed: int) -> float:
    """
    Laplace-smoothed reputation score between 0.0 and 1.0.
    New accounts start at (0 + 1) / (0 + 0 + 2) = 0.50
    """
    return (confirmed + 1.0) / (confirmed + disputed + 2.0)


def calculate_vote_distance_weight(distance_meters: float, half_weight_distance_m: float = 500.0) -> float:
    """
    Computes a distance decay weight between 0.0 and 1.0.
    At distance 0m: weight = 1.0
    At distance 500m: weight = 0.5
    At distance 2000m: weight = ~0.06
    """
    if distance_meters < 0:
        distance_meters = 0.0
    ratio = distance_meters / max(half_weight_distance_m, 1.0)
    return 1.0 / (1.0 + (ratio * ratio))


def calculate_effective_vote_weight(
    distance_meters: float,
    voter_reputation: float,
    half_weight_distance_m: float = 500.0
) -> float:
    """
    Combined weight of a vote = distance_factor * voter_reputation.
    """
    dist_weight = calculate_vote_distance_weight(distance_meters, half_weight_distance_m)
    return round(dist_weight * voter_reputation, 4)


def calculate_incident_trust_score(
    prior_score: float,
    confirm_weights: List[float],
    dispute_weights: List[float],
    prior_strength: float = 2.0
) -> float:
    """
    Bayesian trust score updater.
    
    Formula:
        Trust = (k * Prior + Sum(W_confirm)) / (k + Sum(W_confirm) + Sum(W_dispute))
        
    - prior_score: Baseline likelihood (e.g. 0.3 for unverified bystander, higher in notorious ACLED zones)
    - prior_strength (k): How many 'votes' the initial prior is worth.
    """
    sum_confirms = sum(confirm_weights)
    sum_disputes = sum(dispute_weights)
    
    numerator = (prior_strength * prior_score) + sum_confirms
    denominator = prior_strength + sum_confirms + sum_disputes
    
    score = numerator / max(denominator, 0.001)
    # Clamp to [0.0, 1.0]
    return round(min(max(score, 0.0), 1.0), 3)
