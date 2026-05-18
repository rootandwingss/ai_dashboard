"""Base engine abstract class."""

from abc import ABC, abstractmethod
import numpy as np
from typing import Dict, Any


class BaseEngine(ABC):
    """Abstract base class for all grading engines."""

    @abstractmethod
    def grade(
        self,
        image: np.ndarray,
        question_type: int,
        expected_answer: str,
        grade_level: str,
        thresholds: Dict[str, Any],
        meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Grade a single cropped question image.
        
        Returns dict with keys:
            - score: float (0.0 to max_score)
            - max_score: float
            - confidence: float (0.0 to 1.0)
            - details: dict with engine-specific information
        """
        pass
