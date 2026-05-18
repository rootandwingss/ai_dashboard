"""Dynamic pedagogical thresholds per grade level."""

from typing import Dict, Any

THRESHOLDS: Dict[str, Dict[str, Any]] = {
    "nursery": {
        "color_fill_min": 0.30,            # 30% minimum fill
        "overflow_tolerance": 0.95,         # 95% tolerance (ignore up to 95% overflow)
        "accept_mirror_letters": True,      # Accept b↔d, p↔q, 6↔9
        "extra_stroke_partial": 0.80,       # 80% score for extra strokes
        "confidence_gate": 0.90,            # Minimum OCR/CV confidence
        "shape_angle_tolerance": 30,        # degrees ±
        "circularity_min": 0.55,            # Looser circle detection
        "tracing_coverage_min": 0.60,       # 60% path coverage required
        "fuzzy_match_threshold": 80,        # fuzz.ratio threshold
    },
    "lkg": {
        "color_fill_min": 0.40,
        "overflow_tolerance": 0.90,
        "accept_mirror_letters": False,
        "extra_stroke_partial": 0.80,
        "confidence_gate": 0.90,
        "shape_angle_tolerance": 25,
        "circularity_min": 0.60,
        "tracing_coverage_min": 0.65,
        "fuzzy_match_threshold": 85,
    },
    "ukg": {
        "color_fill_min": 0.50,
        "overflow_tolerance": 0.90,
        "accept_mirror_letters": False,
        "extra_stroke_partial": 0.80,
        "confidence_gate": 0.90,
        "shape_angle_tolerance": 20,
        "circularity_min": 0.65,
        "tracing_coverage_min": 0.70,
        "fuzzy_match_threshold": 85,
    },
}


def get_thresholds(grade_level: str) -> Dict[str, Any]:
    """Get thresholds for a grade level, defaulting to UKG (strictest)."""
    return THRESHOLDS.get(grade_level.lower(), THRESHOLDS["ukg"])
