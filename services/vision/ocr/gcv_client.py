"""
Google Cloud Vision API client for handwritten text recognition.
"""

import cv2
import numpy as np
from typing import Dict, Any

import contextvars

current_meta = contextvars.ContextVar("current_meta", default={})

# Flag to handle cases where GCV credentials aren't configured
_GCV_AVAILABLE = False

try:
    from google.cloud import vision
    _GCV_AVAILABLE = True
except ImportError:
    pass


def recognize_text(image: np.ndarray, expected_answer: str = "") -> Dict[str, Any]:
    """
    Send an image to Google Cloud Vision API for handwritten text detection.
    Returns { "text": str, "confidence": float }.
    
    Falls back to a stub if GCV is not configured (for local dev).
    """
    if not _GCV_AVAILABLE:
        return _fallback_ocr(image, expected_answer)

    try:
        client = vision.ImageAnnotatorClient()

        # Encode image to PNG bytes
        _, encoded = cv2.imencode(".png", image)
        content = encoded.tobytes()

        gcv_image = vision.Image(content=content)

        # Use DOCUMENT_TEXT_DETECTION for better handwriting support
        response = client.document_text_detection(image=gcv_image)

        if response.error.message:
            return {"text": "", "confidence": 0.0, "error": response.error.message}

        full_text = ""
        total_confidence = 0.0
        symbol_count = 0

        if response.full_text_annotation:
            full_text = response.full_text_annotation.text.strip()

            # Calculate average confidence across all symbols
            for page in response.full_text_annotation.pages:
                for block in page.blocks:
                    for paragraph in block.paragraphs:
                        for word in paragraph.words:
                            for symbol in word.symbols:
                                total_confidence += symbol.confidence
                                symbol_count += 1

        avg_confidence = total_confidence / max(symbol_count, 1)

        return {
            "text": full_text,
            "confidence": round(avg_confidence, 3),
        }

    except Exception as e:
        return {"text": "", "confidence": 0.0, "error": str(e)}


def _fallback_ocr(image: np.ndarray, expected_answer: str) -> Dict[str, Any]:
    """
    Fallback OCR stub for local development without GCV credentials.
    Automatically returns the expected answer to allow testing the UI.
    Supports Rule 1, 2, and 3 simulation profiles.
    """
    meta = current_meta.get()
    student_code = str(meta.get("mock_student_code", "")).strip()
    student_name = str(meta.get("mock_student_name", "")).strip()

    # Rule 3: Completely wrong (<5% correctness)
    if "wrong" in student_name.lower() or "wrong" in student_code.lower() or student_code == "1245":
        return {
            "text": "wrong",
            "confidence": 0.95,
            "mock_score": 0.0,
            "error": "GCV not configured — using intelligent fallback stub (Rule 3: Completely Wrong)",
        }

    # Rule 2: Partially correct (5% to 80% correctness -> 60% of marks + review)
    if "partial" in student_name.lower() or "partial" in student_code.lower() or student_code == "1246":
        return {
            "text": "partial",
            "confidence": 0.95,
            "mock_score": 0.50,
            "error": "GCV not configured — using intelligent fallback stub (Rule 2: Partially Correct)",
        }

    # Rule 1: Full Marks
    mock_text = expected_answer if expected_answer and expected_answer != "Unknown" else "5"
    if expected_answer == "Unknown":
        mock_text = "Unknown"

    return {
        "text": mock_text,
        "confidence": 0.95,
        "error": "GCV not configured — using intelligent fallback stub (Rule 1: Full Marks)",
    }
