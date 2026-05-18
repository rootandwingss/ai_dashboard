"""Geometry and shape analysis helpers."""

import cv2
import numpy as np
from typing import List, Tuple


def detect_lines(binary: np.ndarray, 
                 min_length: int = 30, 
                 max_gap: int = 15,
                 threshold: int = 50) -> List[Tuple[int, int, int, int]]:
    """
    Detect line segments using Probabilistic Hough Transform.
    Returns list of (x1, y1, x2, y2) tuples.
    """
    edges = cv2.Canny(binary, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold, 
                             minLineLength=min_length, maxLineGap=max_gap)
    if lines is None:
        return []
    return [(l[0][0], l[0][1], l[0][2], l[0][3]) for l in lines]


def point_in_bbox(point: Tuple[int, int], 
                  bbox: dict, 
                  margin: int = 15) -> bool:
    """Check if a point falls within a bounding box (with margin)."""
    x, y = point
    return (bbox["x"] - margin <= x <= bbox["x"] + bbox["w"] + margin and
            bbox["y"] - margin <= y <= bbox["y"] + bbox["h"] + margin)


def line_connects_bboxes(line: Tuple[int, int, int, int],
                         bbox_left: dict,
                         bbox_right: dict,
                         margin: int = 20) -> bool:
    """
    Check if a detected line connects two bounding boxes
    (either endpoint direction).
    """
    x1, y1, x2, y2 = line
    
    # Check both directions
    forward = (point_in_bbox((x1, y1), bbox_left, margin) and 
               point_in_bbox((x2, y2), bbox_right, margin))
    reverse = (point_in_bbox((x2, y2), bbox_left, margin) and 
               point_in_bbox((x1, y1), bbox_right, margin))
    
    return forward or reverse


def create_corridor_mask(shape: Tuple[int, int], 
                         polyline: List[Tuple[int, int]], 
                         width: int = 25) -> np.ndarray:
    """
    Create a binary mask representing a 'corridor' around a polyline path.
    Used for tracing/dot-to-dot evaluation.
    """
    mask = np.zeros(shape, dtype=np.uint8)
    pts = np.array(polyline, dtype=np.int32)
    cv2.polylines(mask, [pts], isClosed=False, color=255, thickness=width * 2)
    return mask


def compute_stroke_coverage(student_mask: np.ndarray, 
                             corridor_mask: np.ndarray) -> Tuple[float, float]:
    """
    Compute how much of the student's stroke is inside vs outside the corridor.
    Returns (coverage_ratio, overflow_ratio).
    """
    inside = cv2.countNonZero(cv2.bitwise_and(student_mask, corridor_mask))
    total_student = cv2.countNonZero(student_mask)
    total_corridor = cv2.countNonZero(corridor_mask)
    
    if total_student == 0:
        return 0.0, 0.0
    
    outside = total_student - inside
    coverage = inside / max(total_corridor, 1)
    overflow = outside / max(total_student, 1)
    
    return coverage, overflow
