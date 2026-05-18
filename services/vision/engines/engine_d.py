"""
Engine D — Targeted OCR & Fuzzy Logic (Google Cloud Vision)
Handles: Q7 (Count and Answer), Q8 (Write Letter/Word/Number), 
         Q11 (Fill Missing Letter), Q14 (Rearrange Scrambled Letters)
"""

import numpy as np
from typing import Dict, Any

from .base import BaseEngine
from ocr.gcv_client import recognize_text
from ocr.fuzzy import fuzzy_match, apply_mirror_swap, is_valid_anagram


class EngineD(BaseEngine):
    """OCR-based grading engine with mirror-letter rules and fuzzy matching."""

    def grade(
        self,
        image: np.ndarray,
        question_type: int,
        expected_answer: str,
        grade_level: str,
        thresholds: Dict[str, Any],
        meta: Dict[str, Any],
    ) -> Dict[str, Any]:

        dispatch = {
            7: self._grade_count_answer,
            8: self._grade_write_text,
            11: self._grade_fill_missing,
            14: self._grade_rearrange,
        }

        handler = dispatch.get(question_type)
        if not handler:
            return {"score": 0, "max_score": 1, "confidence": 0.0, "details": {"error": f"Unsupported type {question_type}"}}

        return handler(image, expected_answer, grade_level, thresholds, meta)

    def _ocr_image(self, image: np.ndarray, expected_answer: str = "") -> Dict[str, Any]:
        """Run OCR and return text + confidence."""
        result = recognize_text(image, expected_answer)
        return result

    def _grade_count_answer(
        self, image: np.ndarray, expected: str, grade_level: str,
        thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q7: Count and Answer.
        Student counts objects and writes a number. OCR reads the number.
        """
        ocr_result = self._ocr_image(image, expected)
        ocr_text = ocr_result["text"].strip()
        confidence = ocr_result["confidence"]

        # Try to extract a number from OCR text
        digits = "".join(c for c in ocr_text if c.isdigit())

        if "mock_score" in ocr_result:
            score = ocr_result["mock_score"]
        elif digits == expected.strip():
            score = 1.0
        elif thresholds.get("accept_mirror_letters") and digits:
            # Mirror: 6↔9 swap
            mirrored = digits.replace("6", "§").replace("9", "6").replace("§", "9")
            score = 1.0 if mirrored == expected.strip() else 0.0
        else:
            score = 0.0

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "ocr_raw": ocr_text,
                "digits_extracted": digits,
                "expected": expected,
            },
        }

    def _grade_write_text(
        self, image: np.ndarray, expected: str, grade_level: str,
        thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q8: Write a Letter / Word / Number.
        Apply mirror-letter rules for Nursery. Use fuzzy matching for tolerance.
        """
        ocr_result = self._ocr_image(image, expected)
        ocr_text = ocr_result["text"].strip().lower()
        confidence = ocr_result["confidence"]
        expected_clean = expected.strip().lower()

        details: Dict[str, Any] = {
            "ocr_raw": ocr_result["text"],
            "expected": expected,
            "mirror_rule_applied": False,
            "fuzzy_accepted": False,
        }

        # Check for fallback grading simulation override
        if "mock_score" in ocr_result:
            return {"score": ocr_result["mock_score"], "max_score": 1.0, "confidence": confidence, "details": details}

        # Exact match
        if ocr_text == expected_clean:
            return {"score": 1.0, "max_score": 1.0, "confidence": confidence, "details": details}

        # Mirror-letter rule (Nursery only)
        if thresholds.get("accept_mirror_letters"):
            mirrored = apply_mirror_swap(ocr_text)
            if mirrored == expected_clean:
                details["mirror_rule_applied"] = True
                return {"score": 1.0, "max_score": 1.0, "confidence": confidence, "details": details}

        # Fuzzy matching
        fuzzy_threshold = thresholds.get("fuzzy_match_threshold", 85)
        ratio = fuzzy_match(ocr_text, expected_clean)
        
        if ratio >= fuzzy_threshold:
            details["fuzzy_accepted"] = True
            details["fuzzy_ratio"] = ratio
            score = 0.8 if ratio < 95 else 1.0
            return {"score": score, "max_score": 1.0, "confidence": confidence, "details": details}

        details["fuzzy_ratio"] = ratio
        return {"score": 0.0, "max_score": 1.0, "confidence": confidence, "details": details}

    def _grade_fill_missing(
        self, image: np.ndarray, expected: str, grade_level: str,
        thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q11: Fill the Missing Letter.
        e.g., "c_t" → student writes "a" → expected "a".
        """
        ocr_result = self._ocr_image(image, expected)
        ocr_text = ocr_result["text"].strip().lower()
        confidence = ocr_result["confidence"]
        expected_clean = expected.strip().lower()

        if "mock_score" in ocr_result:
            score = ocr_result["mock_score"]
        # For single-letter answers, be more lenient
        elif len(expected_clean) == 1:
            # Extract just the first letter-like character from OCR
            letters = [c for c in ocr_text if c.isalpha()]
            detected = letters[0] if letters else ""
            
            if detected == expected_clean:
                score = 1.0
            elif thresholds.get("accept_mirror_letters"):
                mirrored = apply_mirror_swap(detected)
                score = 1.0 if mirrored == expected_clean else 0.0
            else:
                score = 0.0
        else:
            # Multi-letter: use the same logic as write_text
            result = self._grade_write_text(image, expected, grade_level, thresholds, meta)
            return result

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "ocr_raw": ocr_result["text"],
                "detected_letter": detected if len(expected_clean) == 1 else ocr_text,
                "expected": expected,
            },
        }

    def _grade_rearrange(
        self, image: np.ndarray, expected: str, grade_level: str,
        thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q14: Rearrange Scrambled Letters.
        Student rearranges letters to form the correct word.
        OCR reads the student's word → check if it matches expected.
        Also accept valid anagrams that match expected.
        """
        ocr_result = self._ocr_image(image, expected)
        ocr_text = ocr_result["text"].strip().lower()
        confidence = ocr_result["confidence"]
        expected_clean = expected.strip().lower()

        details: Dict[str, Any] = {
            "ocr_raw": ocr_result["text"],
            "expected": expected,
        }

        # Check for fallback grading simulation override
        if "mock_score" in ocr_result:
            return {"score": ocr_result["mock_score"], "max_score": 1.0, "confidence": confidence, "details": details}

        # Exact match
        if ocr_text == expected_clean:
            return {"score": 1.0, "max_score": 1.0, "confidence": confidence, "details": details}

        # Mirror swap then check
        if thresholds.get("accept_mirror_letters"):
            mirrored = apply_mirror_swap(ocr_text)
            if mirrored == expected_clean:
                details["mirror_rule_applied"] = True
                return {"score": 1.0, "max_score": 1.0, "confidence": confidence, "details": details}

        # Check if it's a valid anagram of the scrambled letters
        scrambled = meta.get("scrambled_letters", "")
        if scrambled and is_valid_anagram(ocr_text, expected_clean):
            return {"score": 1.0, "max_score": 1.0, "confidence": confidence, "details": details}

        # Fuzzy match as last resort
        ratio = fuzzy_match(ocr_text, expected_clean)
        details["fuzzy_ratio"] = ratio

        if ratio >= thresholds.get("fuzzy_match_threshold", 85):
            return {"score": 0.8, "max_score": 1.0, "confidence": confidence, "details": details}

        return {"score": 0.0, "max_score": 1.0, "confidence": confidence, "details": details}
