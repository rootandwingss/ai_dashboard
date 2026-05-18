import cv2
import numpy as np
import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class ValidateRequest(BaseModel):
    template_b64: str
    student_b64: str

class ValidateResponse(BaseModel):
    match: bool
    confidence: float
    message: str

@router.post("/validate-template", response_model=ValidateResponse)
async def validate_template(req: ValidateRequest):
    try:
        # Decode template image
        t_bytes = base64.b64decode(req.template_b64)
        t_arr = np.frombuffer(t_bytes, dtype=np.uint8)
        img1 = cv2.imdecode(t_arr, cv2.IMREAD_GRAYSCALE)
        
        # Decode student image
        s_bytes = base64.b64decode(req.student_b64)
        s_arr = np.frombuffer(s_bytes, dtype=np.uint8)
        img2 = cv2.imdecode(s_arr, cv2.IMREAD_GRAYSCALE)
        
        if img1 is None or img2 is None:
            raise ValueError("Invalid image data")
            
        # Resize student image to match template dimensions
        h, w = img1.shape
        img2 = cv2.resize(img2, (w, h))

        # Create a mask to focus on the central content (ignoring ArUco markers in corners)
        # We focus on the middle 70% of the height and 80% of the width.
        mask = np.zeros((h, w), dtype=np.uint8)
        mh = int(h * 0.15)
        mw = int(w * 0.10)
        mask[mh:h-mh, mw:w-mw] = 255

        # Use ORB feature detection with the central mask
        orb = cv2.ORB_create(nfeatures=1500)
        kp1, des1 = orb.detectAndCompute(img1, mask)
        kp2, des2 = orb.detectAndCompute(img2, mask)
        
        if des1 is None or des2 is None or len(kp1) == 0 or len(kp2) == 0:
            return ValidateResponse(match=False, confidence=0.0, message="Insufficient features detected for comparison")
            
        # Match descriptors using Brute Force Matcher with Hamming distance
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        
        # Calculate confidence based on the ratio of good matches
        # A good match is defined as having a hamming distance < 50
        good_matches = [m for m in matches if m.distance < 50]
        
        # Calculate ratio of good matches
        # Use max instead of min to avoid high ratios if student image has very few features
        match_ratio = len(good_matches) / max(len(kp1), len(kp2))
        
        # BALANCED THRESHOLD:
        # Since we are masking out the markers, we look for at least 15% match in the center 
        # with at least 60 strong feature matches.
        is_match = match_ratio > 0.15 and len(good_matches) >= 60 
        
        return ValidateResponse(
            match=is_match,
            confidence=round(match_ratio, 4),
            message="Template matched successfully" if is_match else "Image does not match expected template layout"
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
