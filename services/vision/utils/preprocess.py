"""Image preprocessing utilities for consistent input handling."""

import cv2
import numpy as np
from typing import Tuple


def to_grayscale(image: np.ndarray) -> np.ndarray:
    """Convert to grayscale if not already."""
    if len(image.shape) == 3:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return image


def adaptive_threshold(image: np.ndarray, block_size: int = 15, c: int = 8) -> np.ndarray:
    """
    Adaptive threshold for handling uneven lighting from phone/scanner.
    Returns binary image (white = ink, black = background).
    """
    gray = to_grayscale(image)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, block_size, c
    )
    return binary


def otsu_threshold(image: np.ndarray) -> np.ndarray:
    """Otsu's automatic thresholding — good for bimodal images."""
    gray = to_grayscale(image)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return binary


def denoise(image: np.ndarray, strength: int = 10) -> np.ndarray:
    """Non-local means denoising for cleaner contours."""
    if len(image.shape) == 3:
        return cv2.fastNlMeansDenoisingColored(image, None, strength, strength, 7, 21)
    return cv2.fastNlMeansDenoising(image, None, strength, 7, 21)


def resize_to_standard(image: np.ndarray, max_dim: int = 1024) -> np.ndarray:
    """Resize image so the largest dimension is max_dim, preserving aspect ratio."""
    h, w = image.shape[:2]
    if max(h, w) <= max_dim:
        return image
    scale = max_dim / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)


def count_ink_pixels(binary: np.ndarray) -> int:
    """Count non-zero (white/ink) pixels in a binary image."""
    return int(cv2.countNonZero(binary))


def ink_density(binary: np.ndarray) -> float:
    """Ratio of ink pixels to total pixels."""
    total = binary.shape[0] * binary.shape[1]
    if total == 0:
        return 0.0
    return count_ink_pixels(binary) / total


def create_polygon_mask(shape: Tuple[int, int], polygon: list) -> np.ndarray:
    """Create a binary mask from polygon vertices. Shape is (height, width)."""
    mask = np.zeros(shape, dtype=np.uint8)
    pts = np.array(polygon, dtype=np.int32)
    cv2.fillPoly(mask, [pts], 255)
    return mask
