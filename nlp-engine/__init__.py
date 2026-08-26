"""ScriptGrade NLP/AI Engine — Alibaba Cloud AI Hackathon 2026.

Standalone multi-modal evaluation brain: Qwen-2.5 rubric extraction,
Qwen-VL handwritten OCR + diagram inspection, AnalyticDB pgvector semantic
matching, and the 8 Vulnerability Edge-Case Debuggers.

Run everything from inside ``nlp-engine/`` (see README §11.4), e.g.::

    python -m pipelines.rubric_extraction --healthcheck
    python -m pipelines.evaluation_pipeline
"""

__version__ = "1.0.0"
__author__ = "Muhammad Musa — Lead AI/NLP Architect"
