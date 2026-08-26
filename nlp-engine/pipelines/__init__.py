"""ScriptGrade inference pipelines — rubric extraction, vision OCR, evaluation.

Re-exports are lazy (PEP 562) so ``python -m pipelines.<module>`` style
invocations (README §11.4 quickstart) never double-import submodules.
"""

from typing import TYPE_CHECKING, Any

__path__ = __import__("pkgutil").extend_path(__path__, __name__)  # type: ignore[name-defined]

_EXPORTS: dict[str, tuple[str, str]] = {
    "EvaluationPipeline": ("pipelines.evaluation_pipeline", "EvaluationPipeline"),
    "RubricExtractionError": ("pipelines.rubric_extraction", "RubricExtractionError"),
    "RubricExtractionPipeline": (
        "pipelines.rubric_extraction",
        "RubricExtractionPipeline",
    ),
    "VisionOCRError": ("pipelines.vision_ocr", "VisionOCRError"),
    "VisionOCRPipeline": ("pipelines.vision_ocr", "VisionOCRPipeline"),
    "image_to_model_url": ("pipelines.vision_ocr", "image_to_model_url"),
}

__all__ = sorted(_EXPORTS)

if TYPE_CHECKING:  # pragma: no cover - static analysis only
    from pipelines.evaluation_pipeline import EvaluationPipeline
    from pipelines.rubric_extraction import (
        RubricExtractionError,
        RubricExtractionPipeline,
    )
    from pipelines.vision_ocr import (
        VisionOCRError,
        VisionOCRPipeline,
        image_to_model_url,
    )


def __getattr__(name: str) -> Any:
    if name in _EXPORTS:
        module_path, attribute = _EXPORTS[name]
        module = __import__(module_path, fromlist=[attribute])
        return getattr(module, attribute)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
