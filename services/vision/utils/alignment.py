"""Worksheet alignment and perspective warping engine."""

import cv2
import numpy as np
from typing import Tuple, Optional


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Order points as: Top-Left, Top-Right, Bottom-Right, Bottom-Left.
    pts is a numpy array of shape (4, 2).
    """
    rect = np.zeros((4, 2), dtype="float32")

    # Top-left point will have the smallest sum, whereas
    # bottom-right point will have the largest sum
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # Top-right point will have the smallest difference,
    # whereas bottom-left will have the largest difference
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect


def align_worksheet(image: np.ndarray, target_size: Tuple[int, int] = (1248, 1700)) -> np.ndarray:
    """
    Align the student worksheet using ArUco markers or paper contour fallback,
    warping perspective to target_size (width, height).
    """
    h, w = image.shape[:2]
    target_w, target_h = target_size

    # --- 1. Try ArUco Marker Detection ---
    corners = None
    ids = None
    
    try:
        if hasattr(cv2.aruco, "ArucoDetector"):
            dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
            parameters = cv2.aruco.DetectorParameters()
            detector = cv2.aruco.ArucoDetector(dictionary, parameters)
            corners, ids, _ = detector.detectMarkers(image)
        else:
            dictionary = cv2.aruco.Dictionary_get(cv2.aruco.DICT_4X4_50)
            parameters = cv2.aruco.DetectorParameters_create()
            corners, ids, _ = cv2.aruco.detectMarkers(image, dictionary, parameters=parameters)
    except Exception as e:
        print(f"[Alignment] ArUco error: {e}")

    # If we found at least 4 markers, we can map them to the 4 corners
    if ids is not None and len(ids) >= 4:
        print(f"[Alignment] Detected {len(ids)} ArUco markers. Performing precision warp.")
        pts = []
        for i in range(len(ids)):
            # Take the center of each detected marker
            marker_corners = corners[i][0]
            center = np.mean(marker_corners, axis=0)
            pts.append(center)
        
        pts = np.array(pts, dtype="float32")
        src_pts = order_points(pts)
    else:
        # --- 2. Fallback: Page Contour Detection ---
        print("[Alignment] Less than 4 ArUco markers detected. Falling back to paper contour warp.")
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 50, 150)
        
        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        src_pts = None
        
        if contours:
            # Sort contours by area in descending order and keep the largest ones
            contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
            for c in contours:
                peri = cv2.arcLength(c, True)
                approx = cv2.approxPolyDP(c, 0.02 * peri, True)
                if len(approx) == 4:
                    src_pts = order_points(approx.reshape(4, 2))
                    break
        
        # If no 4-point contour is found, use full image bounds as last resort
        if src_pts is None:
            print("[Alignment] Bounding contour not found. Using full image dimensions.")
            src_pts = np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])

    # Define target destination points (A4 coordinate space)
    dst_pts = np.float32([
        [0, 0],
        [target_w - 1, 0],
        [target_w - 1, target_h - 1],
        [0, target_h - 1]
    ])

    # Compute perspective transform and warp
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped = cv2.warpPerspective(image, M, (target_w, target_h))
    
    return warped
