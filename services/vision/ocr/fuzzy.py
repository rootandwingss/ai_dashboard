"""
Fuzzy string matching and mirror-letter logic for pedagogical grading.
"""

from thefuzz import fuzz
from typing import Optional


# ─── Mirror Letter Map ──────────────────────────────────
# Common letter/digit confusions for young children (Nursery level)
MIRROR_MAP = {
    "b": "d", "d": "b",
    "p": "q", "q": "p",
    "6": "9", "9": "6",
    "s": "z", "z": "s",
    "m": "w", "w": "m",
    "n": "u", "u": "n",
}


def apply_mirror_swap(text: str) -> str:
    """
    Apply mirror-letter substitutions to every character in the text.
    E.g., "bog" → "dog" (b→d), "qig" → "pig" (q→p)
    """
    return "".join(MIRROR_MAP.get(c, c) for c in text.lower())


def fuzzy_match(text: str, expected: str) -> int:
    """
    Compute fuzzy match ratio between two strings (0-100).
    Uses fuzz.ratio for overall similarity.
    """
    return fuzz.ratio(text.lower().strip(), expected.lower().strip())


def fuzzy_partial_match(text: str, expected: str) -> int:
    """
    Partial ratio — useful when OCR picks up extra characters.
    """
    return fuzz.partial_ratio(text.lower().strip(), expected.lower().strip())


def is_valid_anagram(text: str, expected: str) -> bool:
    """
    Check if text is an anagram of expected (same letters, any order).
    Used for Q14 (Rearrange Scrambled Letters).
    """
    return sorted(text.lower().strip()) == sorted(expected.lower().strip())


def match_with_mirror(
    ocr_text: str,
    expected: str,
    accept_mirror: bool = False,
    fuzzy_threshold: int = 85,
) -> dict:
    """
    Full matching pipeline:
    1. Exact match → 100% 
    2. Mirror swap match (if enabled) → 100%
    3. Fuzzy match → partial credit
    4. No match → 0%
    
    Returns { "score": float, "method": str, "ratio": int }
    """
    clean_ocr = ocr_text.lower().strip()
    clean_expected = expected.lower().strip()

    # 1. Exact
    if clean_ocr == clean_expected:
        return {"score": 1.0, "method": "exact", "ratio": 100}

    # 2. Mirror
    if accept_mirror:
        mirrored = apply_mirror_swap(clean_ocr)
        if mirrored == clean_expected:
            return {"score": 1.0, "method": "mirror", "ratio": 100}

    # 3. Fuzzy
    ratio = fuzzy_match(clean_ocr, clean_expected)
    if ratio >= fuzzy_threshold:
        score = 0.8 if ratio < 95 else 1.0
        return {"score": score, "method": "fuzzy", "ratio": ratio}

    # 4. No match
    return {"score": 0.0, "method": "none", "ratio": ratio}
