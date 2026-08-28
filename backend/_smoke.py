"""Temporary smoke test: security, evaluation engine, exports, PDF tools."""

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.services.evaluation import Toggles, VisualEvidence, evaluate_answer
from app.services.export_service import build_csv_bytes, build_pdf_bytes
from app.utils.pdf_tools import is_pdf_content, split_pdf_pages, extract_text_from_pdf

# --- security ---
hashed = hash_password("supersecret123")
assert verify_password("supersecret123", hashed)
assert not verify_password("wrongpass123", hashed)
from uuid import uuid4
token = create_access_token(uuid4(), "teacher")
payload = decode_access_token(token)
assert payload["role"] == "teacher" and payload["type"] == "access"
print("security OK")

# --- evaluation engine (README example scenario) ---
transcript = (
    "Photosynthesis is the process by which green plants use solar energy and "
    "the green pigment to convert carbon dioxide and water into glucose and oxygen."
)
concepts = [
    {"keyword": "Sunlight", "weight": 3},
    {"keyword": "Chlorophyll", "weight": 3},
    {"keyword": "Glucose", "weight": 2},
    {"keyword": "CO2", "weight": 1},
    {"keyword": "Oxygen", "weight": 1},
]
synonyms = {
    "Sunlight": ["solar energy", "light energy"],
    "Chlorophyll": ["green pigment"],
    "CO2": ["carbon dioxide"],
}
result = evaluate_answer(
    transcript,
    concepts,
    synonyms,
    Toggles(ignore_spelling=True, strict_order=False, density_scoring=True),
    VisualEvidence(diagram_present=True, confidence=96.5, elements=[{"label": "Chloroplast"}]),
    ocr_confidence=96.5,
)
print("score:", result.total_score, "/", result.max_score, "flagged:", result.is_flagged)
assert result.max_score == 10.0
assert result.total_score >= 8.0, result.diagnostics["VIII_rubric_aggregator"]
assert set(result.diagnostics.keys()) == {
    "I_garbage_text", "II_negation_detection", "III_synonym_match",
    "IV_spelling_correction", "V_sequence_dag", "VI_diagram_visual",
    "VII_density_scorer", "VIII_rubric_aggregator",
}

# negation scenario
neg = evaluate_answer(
    "Chlorophyll does NOT absorb sunlight and plants never produce glucose.",
    [{"keyword": "Chlorophyll", "weight": 5}, {"keyword": "Glucose", "weight": 5}],
    {"Sunlight": []},
    Toggles(),
    None,
    90.0,
)
print("negation score:", neg.total_score, "flagged:", neg.is_flagged)
assert neg.diagnostics["II_negation_detection"]["negation_detected"] is True
assert neg.total_score == 0.0
assert neg.is_flagged is True

# fuzzy spelling scenario
fuzzy = evaluate_answer(
    "The plants use sunligt and clorophyll for making glucoze.",
    [{"keyword": "Sunlight", "weight": 2}, {"keyword": "Chlorophyll", "weight": 2}, {"keyword": "Glucose", "weight": 2}],
    {},
    Toggles(ignore_spelling=True),
    None,
    88.0,
)
print("fuzzy score:", fuzzy.total_score)
assert fuzzy.diagnostics["IV_spelling_correction"]["spelling_autocorrected"] is True
assert fuzzy.total_score >= 4.0
print("evaluation OK")

# --- exports ---
class FakePaper:
    def __init__(self):
        self.student_identifier = "STU-102"
        self.total_score = 10.0
        self.teacher_override_score = 8.0
        self.moderation_note = "Diagram reverified."
        self.max_score = 10.0
        self.is_flagged = False
        self.evaluated_at = None

    @property
    def effective_score(self):
        return self.teacher_override_score if self.teacher_override_score is not None else self.total_score

class FakeExam:
    title = "Biology 101 - Term 1"

papers = [FakePaper()]
csv_bytes = build_csv_bytes(FakeExam(), papers)
assert b"STU-102" in csv_bytes and b"Biology 101" in csv_bytes
pdf_bytes = build_pdf_bytes(FakeExam(), papers)
assert pdf_bytes.startswith(b"%PDF-") and len(pdf_bytes) > 500
print("exports OK (csv", len(csv_bytes), "bytes, pdf", len(pdf_bytes), "bytes)")

# --- pdf tools: build a 2-page PDF in memory, split, extract ---
import pymupdf
doc = pymupdf.open()
p1 = doc.new_page()
p1.insert_text((72, 72), "Roll No: STU-201\nPhotosynthesis uses sunlight.")
p2 = doc.new_page()
p2.insert_text((72, 72), "Roll No: STU-202\nChlorophyll absorbs light energy.")
raw = doc.tobytes()
doc.close()
assert is_pdf_content(raw)
pages = split_pdf_pages(raw)
assert len(pages) == 2
assert "STU-201" in extract_text_from_pdf(pages[0])
from app.utils.pdf_tools import detect_student_identifier
assert detect_student_identifier(pages[0]) == "STU-201"
assert detect_student_identifier(pages[1]) == "STU-202"
print("pdf tools OK")

print("ALL SMOKE TESTS PASSED")
