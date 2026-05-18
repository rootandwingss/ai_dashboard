from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "vision-engine",
        "engines_loaded": ["A", "B", "C", "D"],
    }
