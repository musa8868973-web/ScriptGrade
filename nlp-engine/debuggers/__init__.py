"""The 8 Vulnerability Edge-Case Debuggers — ScriptGrade diagnostic core.

Re-exports are lazy (PEP 562) so ``python -m pipelines.<module>`` style
invocations never double-import submodules.
"""

from typing import TYPE_CHECKING, Any

__path__ = __import__("pkgutil").extend_path(__path__, __name__)  # type: ignore[name-defined]

_EXPORTS: dict[str, tuple[str, str]] = {
    "DensityScorer": ("debuggers.density_scorer", "DensityScorer"),
    "FuzzySpellingCorrector": ("debuggers.fuzzy_spelling", "FuzzySpellingCorrector"),
    "levenshtein_distance": ("debuggers.fuzzy_spelling", "levenshtein_distance"),
    "levenshtein_similarity": ("debuggers.fuzzy_spelling", "levenshtein_similarity"),
    "GarbageTextDetector": ("debuggers.garbage_text", "GarbageTextDetector"),
    "split_sentences": ("debuggers.garbage_text", "split_sentences"),
    "NegationDetector": ("debuggers.negation_detector", "NegationDetector"),
    "RubricAggregator": ("debuggers.rubric_aggregator", "RubricAggregator"),
    "SequenceDAGVerifier": ("debuggers.sequence_dag", "SequenceDAGVerifier"),
    "SynonymMatcher": ("debuggers.synonym_matcher", "SynonymMatcher"),
    "VisualInspector": ("debuggers.visual_inspector", "VisualInspector"),
}

__all__ = sorted(_EXPORTS)

if TYPE_CHECKING:  # pragma: no cover - static analysis only
    from debuggers.density_scorer import DensityScorer
    from debuggers.fuzzy_spelling import (
        FuzzySpellingCorrector,
        levenshtein_distance,
        levenshtein_similarity,
    )
    from debuggers.garbage_text import GarbageTextDetector, split_sentences
    from debuggers.negation_detector import NegationDetector
    from debuggers.rubric_aggregator import RubricAggregator
    from debuggers.sequence_dag import SequenceDAGVerifier
    from debuggers.synonym_matcher import SynonymMatcher
    from debuggers.visual_inspector import VisualInspector


def __getattr__(name: str) -> Any:
    if name in _EXPORTS:
        module_path, attribute = _EXPORTS[name]
        module = __import__(module_path, fromlist=[attribute])
        return getattr(module, attribute)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
