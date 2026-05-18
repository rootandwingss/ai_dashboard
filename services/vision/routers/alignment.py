import cv2
import numpy as np
import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from utils.alignment import align_worksheet
from utils.box_detection import detect_answer_boxes

router = APIRouter()


class AlignRequest(BaseModel):
    image_b64: str


class AlignResponse(BaseModel):
    success: bool
    warped_b64: str
    message: str


class DetectRequest(BaseModel):
    image_b64: str


class Box(BaseModel):
    x: int
    y: int
    w: int
    h: int


class DetectResponse(BaseModel):
    success: bool
    boxes: List[Box]
    count: int


@router.post("/align-perspective", response_model=AlignResponse)
async def align_perspective_endpoint(req: AlignRequest):
    try:
        # Decode input image
        img_bytes = base64.b64decode(req.image_b64)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Failed to decode image")
            
        # Warp to standard coordinate grid
        warped = align_worksheet(image, (1248, 1700))
        
        # Encode back to base64
        _, encoded = cv2.imencode(".png", warped)
        warped_b64 = base64.b64encode(encoded.tobytes()).decode("utf-8")
        
        return AlignResponse(
            success=True,
            warped_b64=warped_b64,
            message="Worksheet perspective warped and aligned successfully to 1248x1700 grid."
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Alignment failed: {str(e)}")


@router.post("/detect-template-boxes", response_model=DetectResponse)
async def detect_template_boxes_endpoint(req: DetectRequest):
    try:
        # Decode input image
        img_bytes = base64.b64decode(req.image_b64)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Failed to decode image")
            
        # First align the template to be perfectly safe
        aligned = align_worksheet(image, (1248, 1700))
        
        # Detect boxes
        boxes = detect_answer_boxes(aligned)
        
        return DetectResponse(
            success=True,
            boxes=[Box(**b) for b in boxes],
            count=len(boxes)
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Box detection failed: {str(e)}")
