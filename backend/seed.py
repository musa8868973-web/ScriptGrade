"""Seed script to ensure demo account and sample data exist in local PostgreSQL."""

import asyncio
import os
import sys
from uuid import uuid4

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select
from app.database import AsyncSessionLocal, init_models, engine
from app.models.user import User, UserRole
from app.models.exam import Exam, ExamStatus
from app.models.rubric import Rubric
from app.models.student_paper import StudentPaper, PaperStatus
from app.core.security import hash_password


SAMPLE_DIAGNOSTICS = {
    "I_garbage_text": {
        "flagged": False,
        "relevance_score": 0.02,
        "threshold": 0.35,
        "sentences_scanned": 2,
        "notes": "No filler, padding, or copied prompt text detected.",
    },
    "II_negation_detection": {
        "flagged": False,
        "negation_tokens_bound": 0,
        "tokens_scanned": ["not", "never", "fails to", "without"],
        "flagged_phrases": [],
    },
    "III_synonym_match": {
        "resolved": 2,
        "method": "pgvector cosine-similarity semantic search",
        "matches": [
            {"token": "solar energy", "matched_concept": "Sunlight", "similarity": 0.94},
            {"token": "green pigment", "matched_concept": "Chlorophyll", "similarity": 0.91},
        ],
    },
    "IV_spelling_correction": {
        "corrections_applied": 1,
        "pairs": [{"input": "photosinthesis", "corrected": "photosynthesis", "distance": 2}],
    },
    "V_sequence_dag": {
        "order_preserved": True,
        "steps_identified": ["light absorption", "carbon fixation", "glucose formation"],
        "violations": [],
    },
    "VI_diagram_visual": {
        "diagram_detected": True,
        "confidence": 96.5,
        "elements": [{"label": "Chloroplast"}, {"label": "Thylakoid"}],
    },
    "VII_density_scorer": {
        "factual_tokens": 18,
        "total_tokens": 28,
        "density_ratio": 64.3,
        "anti_fluff_penalty": 0.0,
    },
    "VIII_rubric_aggregator": {
        "raw_score": 9.0,
        "max_score": 10.0,
        "deductions": [],
        "bonuses": [{"reason": "Clear diagram present", "points": 1.0}],
        "final_score": 9.0,
    },
}


async def seed():
    await init_models()

    async with AsyncSessionLocal() as session:
        # 1. Check if demo user exists
        res = await session.execute(
            select(User).where(User.email == "demo@scriptgrade.pk")
        )
        user = res.scalar_one_or_none()

        if user is None:
            user = User(
                user_id=uuid4(),
                full_name="Prof. Tariq Mahmood",
                email="demo@scriptgrade.pk",
                hashed_password=hash_password("HackathonDemo2026"),
                institution_name="National University of Sciences & Technology",
                role=UserRole.teacher,
            )
            session.add(user)
            await session.flush()
            print(f"[Seed] Created demo user: {user.email}")
        else:
            print(f"[Seed] Demo user already exists: {user.email}")

        # 2. Check if demo exam exists for this user
        res = await session.execute(
            select(Exam).where(Exam.user_id == user.user_id)
        )
        existing_exam = res.scalar_one_or_none()

        if existing_exam is None:
            exam = Exam(
                exam_id=uuid4(),
                user_id=user.user_id,
                title="Biology 101 — Photosynthesis",
                status=ExamStatus.completed,
                question_paper_url="/static/sample_sheet.pdf",
                sample_answer_url="/static/sample_sheet.pdf",
            )
            session.add(exam)
            await session.flush()

            # Rubric
            rubric = Rubric(
                rubric_id=uuid4(),
                exam_id=exam.exam_id,
                concepts_json={
                    "concepts": [
                        {"keyword": "Sunlight", "weight": 3},
                        {"keyword": "Chlorophyll", "weight": 3},
                        {"keyword": "Glucose", "weight": 2},
                        {"keyword": "CO2", "weight": 1},
                        {"keyword": "Oxygen", "weight": 1},
                    ],
                    "synonyms": {
                        "Sunlight": ["solar energy", "radiation", "light energy"],
                        "Chlorophyll": ["green pigment", "pigment"],
                        "Glucose": ["sugar", "C6H12O6"],
                        "CO2": ["carbon dioxide"],
                        "Oxygen": ["O2"],
                    },
                },
                ignore_spelling=True,
                strict_order=False,
                density_scoring=True,
            )
            session.add(rubric)

            # Sample student papers
            students = [
                ("STU-101", "Ayesha Khan", 9.0, False),
                ("STU-102", "Bilal Ahmed", 8.0, False),
                ("STU-103", "Dana Malik", 4.0, True),
                ("STU-104", "Emaan Sheikh", 7.5, False),
                ("STU-105", "Faizan Bhatti", 9.5, False),
            ]

            for stu_id, name, score, is_flagged in students:
                paper = StudentPaper(
                    paper_id=uuid4(),
                    exam_id=exam.exam_id,
                    student_identifier=stu_id,
                    student_name=name,
                    scanned_image_url="/static/sample_sheet.pdf",
                    ocr_transcript=(
                        "Photosynthesis is the biological process where plants convert light energy "
                        "and carbon dioxide into glucose and oxygen with chlorophyll."
                    ),
                    ocr_confidence=78.4 if is_flagged else 96.5,
                    word_count=28,
                    total_score=score,
                    max_score=10.0,
                    is_flagged=is_flagged,
                    diagnostic_logs=SAMPLE_DIAGNOSTICS,
                    status=PaperStatus.evaluated,
                )
                session.add(paper)

            await session.commit()
            print(f"[Seed] Created sample exam '{exam.title}' with {len(students)} papers.")
        else:
            print(f"[Seed] Sample exam already exists: '{existing_exam.title}'.")


if __name__ == "__main__":
    asyncio.run(seed())
