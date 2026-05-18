from fastapi import FastAPI
from routers.grade import router as grade_router
from routers.health import router as health_router
from routers.validate import router as validate_router
from routers.alignment import router as alignment_router

app = FastAPI(
    title="Mittsure Olympiad Vision Engine",
    description="OpenCV + OCR grading engine for Olympiad worksheets",
    version="1.0.0",
)

app.include_router(grade_router)
app.include_router(health_router)
app.include_router(validate_router)
app.include_router(alignment_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
