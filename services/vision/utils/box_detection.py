"""Contour-based automatic rectangular answer box detection."""

import cv2
import numpy as np
from typing import List, Dict, Any


def detect_answer_boxes(image: np.ndarray) -> List[Dict[str, Any]]:
    """
    Automatically detect empty handwritten answer boxes on a blank template.
    Returns a sorted list of bounding boxes: [{"x": int, "y": int, "w": int, "h": int}]
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Adaptive thresholding to extract borders
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 15, 8
    )

    # Find external contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    detected_boxes = []
    
    for c in contours:
        area = cv2.contourArea(c)
        # Filter by reasonable area for physical written boxes
        if not (2000 <= area <= 40000):
            continue
            
        x, y, w, h = cv2.boundingRect(c)
        aspect_ratio = float(w) / h
        
        # We look for rectangular boxes (aspect ratio between 0.8 and 2.5)
        # and ignore extremely narrow lines/bars
        if not (0.8 <= aspect_ratio <= 2.5):
            continue
            
        # Verify it has four distinct vertices (rectangular outline)
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.04 * peri, True)
        if len(approx) not in [4, 5, 6, 7, 8]: # Be lenient with hand-drawn or rounded boxes
            continue

        detected_boxes.append({"x": x, "y": y, "w": w, "h": h})

    # Sort boxes in natural reading order (top-to-bottom, left-to-right)
    # Group boxes that share roughly the same Y coordinate (within 40 pixels)
    if not detected_boxes:
        return []
        
    detected_boxes = sorted(detected_boxes, key=lambda b: b["y"])
    
    grouped_rows = []
    current_row = [detected_boxes[0]]
    
    for b in detected_boxes[1:]:
        # If this box is close vertically to the previous box, group them
        if abs(b["y"] - current_row[-1]["y"]) <= 40:
            current_row.append(b)
        else:
            grouped_rows.append(current_row)
            current_row = [b]
    grouped_rows.append(current_row)
    
    sorted_boxes = []
    for row in grouped_rows:
        # Sort each row horizontally from left to right
        sorted_row = sorted(row, key=lambda b: b["x"])
        sorted_boxes.extend(sorted_row)
        
    return sorted_boxes
