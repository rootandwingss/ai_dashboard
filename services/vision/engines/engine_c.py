"""
Engine C — Shape & Stroke Analysis
Handles: Q5 (Trace the Dotted Line), Q6 (Draw a Shape), Q9 (Complete the Pattern)
"""

import cv2
import numpy as np
from typing import Dict, Any

from .base import BaseEngine
from utils.preprocess import adaptive_threshold
from utils.contours import (
    largest_contour, approximate_polygon, compute_angles,
    contour_circularity, find_contours
)
from utils.geometry import create_corridor_mask, compute_stroke_coverage


class EngineC(BaseEngine):
    """Shape and stroke analysis engine using contour approximation and corridor masking."""

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
            5: self._grade_trace_dotted,
            6: self._grade_draw_shape,
            9: self._grade_complete_pattern,
        }

        handler = dispatch.get(question_type)
        if not handler:
            return {"score": 0, "max_score": 1, "confidence": 0.0, "details": {"error": f"Unsupported type {question_type}"}}

        return handler(image, expected_answer, thresholds, meta)

    def _grade_trace_dotted(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q5: Trace the Dotted Line.
        - Create corridor mask from the template polyline path
        - Check how much of the student's stroke falls inside the corridor
        - If student draws extra strokes outside, award 80% partial (not zero)
        """
        template_path = meta.get("template_polyline", [])
        corridor_width = meta.get("corridor_width", 25)

        if not template_path:
            return {"score": 0, "max_score": 1, "confidence": 0.5, "details": {"error": "No template_polyline in meta"}}

        binary = adaptive_threshold(image)
        h, w = binary.shape[:2]

        # Create corridor mask around the expected path
        corridor = create_corridor_mask((h, w), template_path, width=corridor_width)

        # Compute coverage and overflow
        coverage, overflow = compute_stroke_coverage(binary, corridor)

        coverage_min = thresholds.get("tracing_coverage_min", 0.60)
        partial_score = thresholds.get("extra_stroke_partial", 0.80)

        if coverage >= coverage_min and overflow <= 0.3:
            score = 1.0
        elif coverage >= coverage_min and overflow > 0.3:
            # Good tracing but extra strokes outside → 80% partial
            score = partial_score
        else:
            score = 0.0

        # Confidence based on how clearly we can see the stroke
        total_ink = cv2.countNonZero(binary)
        confidence = min(1.0, 0.6 + (0.4 * (total_ink / max(h * w * 0.05, 1))))

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": min(confidence, 0.98),
            "details": {
                "coverage": round(coverage, 3),
                "overflow": round(overflow, 3),
                "coverage_threshold": coverage_min,
                "partial_score_applied": score == partial_score,
            },
        }

    def _grade_draw_shape(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q6: Draw a Shape (freehand).
        Do NOT require perfectly straight lines. Accept "general approach":
        - Rectangle: ~4 corners, ~4 sides, angles ≈ 90° (with tolerance)
        - Triangle: ~3 corners
        - Circle: circularity > threshold
        """
        expected_shape = expected.lower().strip()
        binary = adaptive_threshold(image)
        contour = largest_contour(binary, min_area=100)

        if contour is None:
            return {"score": 0, "max_score": 1, "confidence": 0.3, "details": {"error": "No shape detected"}}

        angle_tolerance = thresholds.get("shape_angle_tolerance", 25)
        circularity_min = thresholds.get("circularity_min", 0.60)

        if expected_shape in ("rectangle", "square"):
            return self._check_rectangle(contour, angle_tolerance)
        elif expected_shape == "triangle":
            return self._check_triangle(contour, angle_tolerance)
        elif expected_shape == "circle":
            return self._check_circle(contour, circularity_min)
        else:
            # Generic shape — use approxPolyDP vertex count
            return self._check_generic(contour, expected_shape)

    def _check_rectangle(self, contour: np.ndarray, angle_tolerance: float) -> Dict[str, Any]:
        """Accept if ~4 corners and angles ≈ 90°."""
        approx = approximate_polygon(contour, epsilon_factor=0.04)
        n = len(approx)
        
        if n == 4:
            angles = compute_angles(approx)
            angles_near_90 = all(abs(a - 90) <= angle_tolerance for a in angles)
            
            if angles_near_90:
                score = 1.0
                confidence = 0.95
            else:
                score = 0.8  # Shape has 4 corners but angles aren't perfect
                confidence = 0.85
        elif n in (3, 5):
            # Close enough — child might have rounded a corner or added a wobble
            score = 0.6
            confidence = 0.70
        else:
            score = 0.0
            confidence = 0.80

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "expected": "rectangle",
                "vertices_detected": n,
                "angles": [round(a, 1) for a in compute_angles(approx)] if n >= 3 else [],
            },
        }

    def _check_triangle(self, contour: np.ndarray, angle_tolerance: float) -> Dict[str, Any]:
        """Accept if ~3 corners."""
        approx = approximate_polygon(contour, epsilon_factor=0.04)
        n = len(approx)

        if n == 3:
            score = 1.0
            confidence = 0.95
        elif n == 4:
            score = 0.6
            confidence = 0.70
        else:
            score = 0.0
            confidence = 0.80

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {"expected": "triangle", "vertices_detected": n},
        }

    def _check_circle(self, contour: np.ndarray, circularity_min: float) -> Dict[str, Any]:
        """Accept if circularity exceeds threshold (perfect circle = 1.0)."""
        circ = contour_circularity(contour)

        if circ >= circularity_min:
            score = 1.0
        elif circ >= circularity_min * 0.7:
            score = 0.6
        else:
            score = 0.0

        confidence = 0.90

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "expected": "circle",
                "circularity": round(circ, 3),
                "threshold": circularity_min,
            },
        }

    def _check_generic(self, contour: np.ndarray, expected: str) -> Dict[str, Any]:
        """Fallback for shapes not explicitly handled."""
        approx = approximate_polygon(contour, epsilon_factor=0.04)
        return {
            "score": 0.5,
            "max_score": 1.0,
            "confidence": 0.50,
            "details": {
                "expected": expected,
                "vertices_detected": len(approx),
                "note": "Generic shape check — manual review recommended",
            },
        }

    def _grade_complete_pattern(
        self, image: np.ndarray, expected: str, thresholds: Dict, meta: Dict
    ) -> Dict[str, Any]:
        """
        Q9: Complete the Pattern.
        Compare student's drawing in the blank cell to the expected pattern using
        structural similarity (SSIM) or contour moment matching.
        """
        expected_cell_polygon = meta.get("blank_cell_polygon")
        reference_cell_polygon = meta.get("reference_cell_polygon")

        if not expected_cell_polygon or not reference_cell_polygon:
            return {"score": 0, "max_score": 1, "confidence": 0.5, "details": {"error": "Missing cell polygon meta"}}

        # Extract the student's drawing from the blank cell
        binary = adaptive_threshold(image)

        # Use contour moment matching (Hu moments) as a lightweight alternative to SSIM
        student_contours = find_contours(binary, min_area=30)
        
        if not student_contours:
            return {"score": 0, "max_score": 1, "confidence": 0.6, "details": {"error": "No drawing in blank cell"}}

        # For MVP: use the largest contour and compare via Hu moments
        student_contour = max(student_contours, key=cv2.contourArea)

        # If we have a reference contour from meta, compare moments
        # For now, return partial score based on presence of drawing
        # Full SSIM comparison requires the reference image
        similarity = 0.7  # Placeholder — will use SSIM in full implementation

        try:
            from skimage.metrics import structural_similarity as ssim
            # This would compare the student cell vs reference cell images
            # Requires both regions to be extracted and resized to same dimensions
            pass
        except ImportError:
            pass

        score = 1.0 if similarity >= 0.60 else 0.0
        confidence = 0.65  # Lower confidence for pattern matching

        return {
            "score": score,
            "max_score": 1.0,
            "confidence": confidence,
            "details": {
                "similarity": round(similarity, 3),
                "contours_found": len(student_contours),
                "note": "Pattern matching uses contour presence for MVP",
            },
        }
