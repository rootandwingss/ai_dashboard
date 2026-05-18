"""Contour detection and analysis helpers."""

import cv2
import numpy as np
from typing import List, Tuple, Optional


def find_contours(binary: np.ndarray, min_area: int = 50) -> List[np.ndarray]:
    """Find external contours filtered by minimum area."""
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [c for c in contours if cv2.contourArea(c) >= min_area]


def largest_contour(binary: np.ndarray, min_area: int = 50) -> Optional[np.ndarray]:
    """Return the largest contour by area, or None."""
    contours = find_contours(binary, min_area)
    if not contours:
        return None
    return max(contours, key=cv2.contourArea)


def contour_bounding_rect(contour: np.ndarray) -> Tuple[int, int, int, int]:
    """Return (x, y, w, h) bounding rectangle."""
    return cv2.boundingRect(contour)


def contour_circularity(contour: np.ndarray) -> float:
    """Compute circularity: 4π·area / perimeter². Perfect circle = 1.0."""
    area = cv2.contourArea(contour)
    perimeter = cv2.arcLength(contour, True)
    if perimeter == 0:
        return 0.0
    return (4 * np.pi * area) / (perimeter ** 2)


def approximate_polygon(contour: np.ndarray, epsilon_factor: float = 0.04) -> np.ndarray:
    """Approximate contour as polygon. Lower epsilon = more vertices."""
    epsilon = epsilon_factor * cv2.arcLength(contour, True)
    return cv2.approxPolyDP(contour, epsilon, True)


def compute_angles(approx: np.ndarray) -> List[float]:
    """Compute interior angles of an approximated polygon (in degrees)."""
    n = len(approx)
    angles = []
    for i in range(n):
        p1 = approx[i][0].astype(float)
        p2 = approx[(i + 1) % n][0].astype(float)
        p3 = approx[(i + 2) % n][0].astype(float)

        v1 = p1 - p2
        v2 = p3 - p2

        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-8)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        angle = np.degrees(np.arccos(cos_angle))
        angles.append(angle)
    return angles


def convex_hull_ratio(contour: np.ndarray) -> float:
    """Ratio of contour area to convex hull area. Measures how convex the shape is."""
    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    if hull_area == 0:
        return 0.0
    return cv2.contourArea(contour) / hull_area
