"""
Engine B — HSV Color Fill Analysis
Handles: Q4 (Color the Image), Q10 (Color N of M Shapes), Q13 (Color Words by Rule)
"""

import cv2
import numpy as np
from typing import Dict, Any, List, Tuple

from .base import BaseEngine
from utils.preprocess import create_polygon_mask


class EngineB(BaseEngine):
    """Color analysis engine using HSV masking and fill-ratio computation."""

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
            4: self._grade_color_image,
            10: self._grade_color_n_of_m,
            13: self._grade_color_words_by_rule,
        }

        handler = dispatch.get(question_type)
        if not handler:
            return {"score": 0, "max_score": 1, "confidence": 0.0, "details": {"error": f"Unsupported type {question_type}"}}

        return handler(image, expected_answer, thresholds, meta)

    def _compute_fill(
        self,
        image: np.ndarray,
        region_polygon: List[List[int]],
        hsv_lower: List[int],
        hsv_upper: List[int],
    ) -> Tuple[float, float]:
        """
        Compute color fill ratio inside and outside a region polygon.
        Returns (inside_fill_ratio, outside_overflow_ratio).
        """
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        # Create color mask for the expected color
        lower = np.array(hsv_lower, dtype=np.uint8)
        upper = np.array(hsv_upper, dtype=np.uint8)
        color_mask = cv2.inRange(hsv, lower, upper)

        # Handle red hue wrap-around (red spans 0-10 and 170-180 in HSV)
        if hsv_lower[0] > hsv_upper[0]:
            mask1 = cv2.inRange(hsv, np.array([0, hsv_lower[1], hsv_lower[2]]),
                                     np.array([hsv_upper[0], hsv_upper[1], hsv_upper[2]]))
            mask2 = cv2.inRange(hsv, np.array([hsv_lower[0], hsv_lower[1], hsv_lower[2]]),
                                     np.array([180, hsv_upper[1], hsv_upper[2]]))
            color_mask = cv2.bitwise_or(mask1, mask2)

        # Create region mask from polygon
        h, w = image.shape[:2]
        region_mask = create_polygon_mask((h, w), region_polygon)
        inverse_region = cv2.bitwise_not(region_mask)

        # Calculate fill ratios
        inside_colored = cv2.countNonZero(cv2.bitwise_and(color_mask, region_mask))
        total_inside = cv2.countNonZero(region_mask)
        inside_fill = inside_colored / max(total_inside, 1)

        outside_colored = cv2.countNonZero(cv2.bitwise_and(color_mask, inverse_region))
        total_outside = cv2.countNonZero(inverse_region)
        outside_overflow = outside_colored / max(total_outside, 1)

        return inside_fill, outside_overflow

    def _grade_color_image(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q4: Color the Image.
        Check if the expected color fills the target region above the grade-level minimum.
        """
        region_polygon = meta.get("region_polygon")
        hsv_lower = meta.get("expected_hsv_lower")
        hsv_upper = meta.get("expected_hsv_upper")

        if not region_polygon or not hsv_lower or not hsv_upper:
            return {"score": 0, "max_score": 1, "confidence": 0.5, "details": {"error": "Missing color/region meta"}}

        inside_fill, outside_overflow = self._compute_fill(image, region_polygon, hsv_lower, hsv_upper)

        fill_min = thresholds["color_fill_min"]
        overflow_max = 1.0 - thresholds["overflow_tolerance"]

        fill_pass = inside_fill >= fill_min
        overflow_pass = outside_overflow <= overflow_max

        if fill_pass and overflow_pass:
            score = 1.0
        elif fill_pass and not overflow_pass:
            score = 0.5
        else:
            score = 0.0

        confidence = 0.95 if inside_fill > 0.1 else 0.6

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "inside_fill": round(inside_fill, 3),
                "outside_overflow": round(outside_overflow, 3),
                "fill_threshold": fill_min,
                "overflow_threshold": overflow_max,
                "fill_pass": fill_pass,
                "overflow_pass": overflow_pass,
            },
        }

    def _grade_color_n_of_m(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q10: Color N of M Shapes.
        Check how many shapes in the set are correctly colored.
        Expected answer: "3" (meaning 3 shapes should be colored).
        """
        shapes = meta.get("shapes", [])
        hsv_lower = meta.get("expected_hsv_lower", [0, 50, 50])
        hsv_upper = meta.get("expected_hsv_upper", [180, 255, 255])
        expected_count = int(expected) if expected.isdigit() else 0

        if not shapes:
            return {"score": 0, "max_score": 1, "confidence": 0.5, "details": {"error": "No shapes in meta"}}

        fill_min = thresholds["color_fill_min"]
        colored_count = 0
        shape_details = []

        for i, shape in enumerate(shapes):
            polygon = shape.get("polygon", [])
            if not polygon:
                shape_details.append({"index": i, "fill": 0, "colored": False})
                continue

            inside_fill, _ = self._compute_fill(image, polygon, hsv_lower, hsv_upper)
            is_colored = inside_fill >= fill_min

            if is_colored:
                colored_count += 1

            shape_details.append({
                "index": i,
                "fill": round(inside_fill, 3),
                "colored": is_colored,
            })

        score = 1.0 if colored_count == expected_count else (0.5 if abs(colored_count - expected_count) == 1 else 0.0)
        confidence = 0.90

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "colored_count": colored_count,
                "expected_count": expected_count,
                "total_shapes": len(shapes),
                "shapes": shape_details,
            },
        }

    def _grade_color_words_by_rule(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q13: Color Words by Rule.
        Each word has a bbox and expected color. Check if each word is colored correctly.
        Expected: JSON-like string or use meta for word-color mappings.
        """
        words = meta.get("words", [])
        if not words:
            return {"score": 0, "max_score": 1, "confidence": 0.5, "details": {"error": "No words in meta"}}

        fill_min = thresholds["color_fill_min"]
        correct = 0
        word_details = []

        for word_info in words:
            polygon = word_info.get("polygon", [])
            hsv_lower = word_info.get("hsv_lower", [0, 50, 50])
            hsv_upper = word_info.get("hsv_upper", [180, 255, 255])
            label = word_info.get("label", "")

            if not polygon:
                word_details.append({"label": label, "fill": 0, "correct": False})
                continue

            inside_fill, _ = self._compute_fill(image, polygon, hsv_lower, hsv_upper)
            is_correct = inside_fill >= fill_min

            if is_correct:
                correct += 1

            word_details.append({
                "label": label,
                "fill": round(inside_fill, 3),
                "correct": is_correct,
            })

        total = len(words)
        score = correct / max(total, 1)
        confidence = 0.90

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "correct": correct,
                "total": total,
                "words": word_details,
            },
        }
