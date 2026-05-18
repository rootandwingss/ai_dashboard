"""
Engine A — Contour / Mark Detection
Handles: Q1 (Circle Correct Answer), Q2 (Tick/Cross), Q3 (Match the Following), Q12 (Match Picture to Letter)
"""

import cv2
import numpy as np
from typing import Dict, Any, List

from .base import BaseEngine
from utils.preprocess import adaptive_threshold, ink_density
from utils.contours import find_contours, largest_contour, convex_hull_ratio, approximate_polygon
from utils.geometry import detect_lines, line_connects_bboxes


class EngineA(BaseEngine):
    """Mark detection engine using contour analysis and Hough lines."""

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
            1: self._grade_circle_answer,
            2: self._grade_tick_cross,
            3: self._grade_match_following,
            12: self._grade_match_following,  # Same logic as Q3
        }

        handler = dispatch.get(question_type)
        if not handler:
            return {"score": 0, "max_score": 1, "confidence": 0.0, "details": {"error": f"Unsupported type {question_type}"}}

        return handler(image, expected_answer, thresholds, meta)

    def _grade_circle_answer(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q1: Circle the Correct Answer.
        Crop each option bounding box → measure ink density → highest ink = selected.
        """
        options = meta.get("options", [])
        if not options:
            return {"score": 0, "max_score": 1, "confidence": 0.5, "details": {"error": "No options in meta"}}

        binary = adaptive_threshold(image)
        densities = {}

        for opt in options:
            bbox = opt["bbox"]
            x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
            
            # Adjust coordinates relative to the cropped image
            # The image is already cropped to the question bbox by the router
            # Option bboxes in meta may be absolute — adjust if needed
            roi = binary[
                max(0, y) : min(binary.shape[0], y + h),
                max(0, x) : min(binary.shape[1], x + w),
            ]
            
            if roi.size == 0:
                densities[opt["label"]] = 0.0
                continue

            densities[opt["label"]] = ink_density(roi)

        if not densities:
            return {"score": 0, "max_score": 1, "confidence": 0.3, "details": {"error": "Could not read options"}}

        # The option with the highest ink density is the selected answer
        selected = max(densities, key=densities.get)
        max_density = densities[selected]

        # Confidence based on how clearly one option stands out
        sorted_densities = sorted(densities.values(), reverse=True)
        if len(sorted_densities) > 1 and sorted_densities[0] > 0:
            margin = (sorted_densities[0] - sorted_densities[1]) / sorted_densities[0]
            confidence = min(1.0, 0.5 + margin)
        else:
            confidence = 0.5

        score = 1.0 if selected.upper() == expected.upper() else 0.0

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "selected": selected,
                "expected": expected,
                "densities": densities,
            },
        }

    def _grade_tick_cross(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q2: Tick or Cross classification.
        Tick: 2 strokes forming a V-check (↘↗). Convex hull ratio ~0.4-0.6.
        Cross: 2 intersecting strokes (X shape). Convex hull ratio ~0.3-0.5, more symmetric.
        """
        binary = adaptive_threshold(image)
        contour = largest_contour(binary, min_area=30)

        if contour is None:
            return {"score": 0, "max_score": 1, "confidence": 0.3, "details": {"error": "No mark detected"}}

        hull_ratio = convex_hull_ratio(contour)
        approx = approximate_polygon(contour, epsilon_factor=0.05)
        num_vertices = len(approx)

        # Aspect ratio of bounding rect
        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = w / max(h, 1)

        # Heuristic classification:
        # Tick: fewer vertices (3-5), asymmetric, hull ratio 0.35-0.65
        # Cross: more vertices (4-8), roughly symmetric (aspect ≈ 1), hull ratio 0.25-0.55
        is_tick = (num_vertices <= 6 and 0.3 <= hull_ratio <= 0.75 and aspect_ratio < 1.5)
        is_cross = (num_vertices >= 4 and hull_ratio < 0.6 and 0.6 <= aspect_ratio <= 1.6)

        # Determine classification
        if is_tick and not is_cross:
            detected = "tick"
            confidence = 0.85
        elif is_cross and not is_tick:
            detected = "cross"
            confidence = 0.85
        elif is_tick and is_cross:
            # Ambiguous — use hull ratio as tiebreaker
            detected = "tick" if hull_ratio > 0.5 else "cross"
            confidence = 0.60
        else:
            detected = "tick" if hull_ratio > 0.45 else "cross"
            confidence = 0.50

        score = 1.0 if detected == expected.lower() else 0.0

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "detected": detected,
                "expected": expected,
                "hull_ratio": round(hull_ratio, 3),
                "vertices": num_vertices,
                "aspect_ratio": round(aspect_ratio, 3),
            },
        }

    def _grade_match_following(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q3 & Q12: Match the Following / Match Picture to Starting Letter.
        Detect drawn lines connecting left items to right items using HoughLinesP.
        Expected answer format: "A-2,B-1,C-3" (left-right pairs).
        """
        pairs_meta = meta.get("pairs", [])
        if not pairs_meta:
            return {"score": 0, "max_score": 1, "confidence": 0.5, "details": {"error": "No pairs in meta"}}

        binary = adaptive_threshold(image)
        lines = detect_lines(binary, min_length=20, max_gap=20, threshold=30)

        if not lines:
            return {"score": 0, "max_score": 1, "confidence": 0.4, "details": {"error": "No lines detected"}}

        # Parse expected pairs: "A-2,B-1,C-3"
        expected_pairs = {}
        for pair_str in expected.split(","):
            parts = pair_str.strip().split("-")
            if len(parts) == 2:
                expected_pairs[parts[0].strip()] = parts[1].strip()

        # Check each expected pair
        matched = 0
        total = len(expected_pairs)
        pair_results = {}

        for left_key, right_key in expected_pairs.items():
            # Find bbox for this pair from meta
            left_bbox = None
            right_bbox = None
            for p in pairs_meta:
                if p.get("left_label") == left_key:
                    left_bbox = p.get("left_bbox")
                if p.get("right_label") == right_key:
                    right_bbox = p.get("right_bbox")

            if not left_bbox or not right_bbox:
                pair_results[f"{left_key}-{right_key}"] = "no_bbox"
                continue

            # Check if any detected line connects these two bboxes
            connected = any(
                line_connects_bboxes(line, left_bbox, right_bbox, margin=25)
                for line in lines
            )

            if connected:
                matched += 1
                pair_results[f"{left_key}-{right_key}"] = "matched"
            else:
                pair_results[f"{left_key}-{right_key}"] = "not_matched"

        score = matched / max(total, 1)
        confidence = 0.7 + (0.3 * score) if lines else 0.4

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": min(1.0, confidence),
            "details": {
                "matched": matched,
                "total": total,
                "lines_detected": len(lines),
                "pair_results": pair_results,
            },
        }
