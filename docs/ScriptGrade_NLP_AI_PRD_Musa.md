# **_ScriptGrade – AI Engine & NLP Architecture Specification (PRD)_** 

**Event:** Alibaba Cloud AI Hackathon Pakistan 2026 

**Target Architecture:** Multi-Modal AI Pipeline (Qwen-2.5 LLM + Qwen-VL Vision) 

**Document Purpose:** Complete AI Engineering Specification for Rubric Extraction, Semantic Vector Matching, OCR Processing, and 8 Vulnerability Edge-Case Debugger Models. 

## **Developer Assignment & Responsibility Matrix** 

- **Document Assigned To:** Muhammad Musa (Lead AI / NLP Architect) 

- **Assigned Deliverables:** 

   - Engineering end-to-end inference pipelines for Alibaba Cloud Qwen2.5/Qwen-Plus (LLM) and Qwen-VL (Vision-Language) models. 

   - Designing structured JSON prompt templates for automated concept extraction, synonym cluster generation, and weighted grading. 

   - Building semantic vector embedding and cosine similarity evaluation logic using AnalyticDB PostgreSQL (pgvector). 

   - Implementing the core logic for all **8 Vulnerability Edge-Case Debuggers** (Garbage Text, Negation Analysis, Sequence DAG Matching, Diagram Visual Inspection, Anti-Fluff Density, etc.). 

## **1. Executive Summary & AI Technology Stack** 

The AI Engine serves as the core evaluation brain of ScriptGrade. It transforms raw, unstructured handwritten answer scripts into structured, bias-free numerical evaluations and diagnostic logs while maintaining real-time parity with teacherconfigured rubrics and sensitivity toggles. 

## **Comprehensive Technology Stack** 

- **Large Language Model (LLM):** Alibaba Cloud Qwen-2.5 / Qwen-Plus (Semantic reasoning, dependency parsing, rubric extraction) 

- **Vision-Language Engine:** Alibaba Cloud Qwen-VL (Handwritten OCR, flowchart analysis, spatial arrow/label verification) 

- **Vector Store & Embeddings:** Alibaba Cloud AnalyticDB for PostgreSQL (pgvector plugin) using Alibaba Cloud Text-Embedding Models 

- **Graph Logic Processing:** NetworkX (Python) for Directed Acyclic Graph (DAG) procedural order verification 

- **Core Algorithms:** Cosine Similarity, Levenshtein Distance (Fuzzy Spelling Matching ≥85%), Token-Density Normalization Ratio 

## **2. Multi-Modal Pipeline Architecture** 

[Question Paper + Sample Answer] ── ► Qwen-2.5 LLM ── ► Auto-Extracted Concepts & Synonyms 

│ 

[Scanned Answer Sheets (PDF/PNG)] ── ► Qwen-VL Engine ── ► OCR Transcript & Visual Label Bounding Boxes 

│ 

▼ 

8 Vulnerability Edge-Case Debuggers Engine 

│ 

▼ 

Weighted Score & Diagnostic JSON Output 

## **3. Deep Algorithmic Specifications (8 Vulnerability Edge-Case Debuggers)** 

Muhammad Musa is responsible for building and fine-tuning the 8 core evaluation modules displayed in Rohail's Master Workspace and logged in Ishmal's Database: 

- **I. Garbage Text & Hallucination Detector** 

   - **Goal:** Detect filler text, non-sensical sentences, or copied prompt text written to 

   - artificially pad length. 

   - **Logic:** Calculate sentence-level Cosine Similarity between student answer vectors and core rubric concept vectors. If similarity is below 0.35, mark as low contextual relevance and output garbage_text_score. 

## **II. Negation & Reversal Modifiers Engine** 

- **Goal:** Catch instances where a student writes required keywords but negates their meaning (e.g., _"Chlorophyll does NOT absorb sunlight"_ ). 

- **Logic:** Dependency parsing via Qwen-2.5 to scan for negation tokens (not, never, fails to, without, lack of) bound to magic concepts. Triggers negation_detected: true alert. 

## **III. Synonym & Semantic Matcher** 

- **Goal:** Reward students who use alternative technical terminology or equivalent phrasing (e.g., "solar energy" for "sunlight"). 

- **Logic:** Query pre-generated Synonym Clusters stored in the rubrics JSON table using semantic vector similarity. Outputs synonym_matched: true. 

## **IV. Fuzzy Spelling Auto-Correction** 

- **Goal:** Ensure students aren't penalized for minor spelling typos when the teacher has enabled the ignore_spelling toggle. 

- **Logic:** Calculates Levenshtein Distance between student tokens and rubric keywords. Tokens with ≥85% match score are auto-corrected without score deduction (spelling_autocorrected: true). 

## **V.** 

## **Sequence & Procedural DAG Verifier** 

- **Goal:** Enforce strict step-by-step chronological order for procedural processes when the strict_order toggle is enabled. 

- **Logic:** Constructs a Directed Acyclic Graph (DAG) using NetworkX. Validates if concept transitions follow the reference answer sequence, returning sequence_match: true/false. 

## **VI. Qwen-VL Diagram & Visual Inspector** 

- **Goal:** Evaluate handwritten biological diagrams, flowcharts, and visual labels. 

- **Logic:** Dispatches image regions to Qwen-VL to detect visual elements, arrows, and spatial text labels, returning diagram_verified: true and visual confidence percentages. 

## **VII.** 

## **Anti-Fluff Information Density Scorer** 

- **Goal:** Eliminate length bias by evaluating factual presence over word count when density_scoring is active. 

- **Logic:** 

Density Ratio (%) = ~~(~~<sup>Count of Valid Rubric Keyword Hits</sup> Total Student Answer Word Count ) × 100 

Prevents verbose, fluff-filled answers from gaining higher marks than concise, correct answers. 

## **VIII. Itemized Rubric Score Aggregator** 

- **Goal:** Map concept matches to point allocations and compute final score totals. 

- **Logic:** Sums awarded points based on teacher weights, caps maximum possible marks, and constructs the final rubric_breakdown JSON array for API consumption. 

## **4. Exact Prompt Engineering Contracts** 

## **A. Auto-Rubric Extraction Prompt (Qwen-2.5)** 

Plaintext 

SYSTEM: You are an expert academic evaluation AI. Analyze the provided Question Paper and Sample Reference Answer. 

TASK: 

1. Extract key concepts/facts required for a full-mark response. 

2. Assign recommended point weights totaling the question's total marks. 

3. Generate 3-5 valid academic synonyms/alternative phrasings for each concept. 

OUTPUT FORMAT (STRICT JSON ONLY): 

{ 

"concepts": [ 

- { "keyword": "Sunlight", "weight": 3 }, 

- { "keyword": "Chlorophyll", "weight": 3 }, 

- { "keyword": "Glucose", "weight": 2 } 

], 

"synonyms": { 

"Sunlight": ["solar energy", "light radiation"], 

"Chlorophyll": ["green pigment", "photosynthetic pigment"] 

} 

} 

## **B. Comprehensive Evaluation Prompt (Qwen-VL + Qwen-2.5)** 

Plaintext 

SYSTEM: Evaluate the student answer transcript against the Rubric Configuration. 

INPUT: 

- OCR Transcript: {ocr_transcript} 

- Rubric JSON: {concepts_json} 

- Toggles: {ignore_spelling: true, strict_order: false, density_scoring: true} 

## TASK: 

Perform deep semantic matching, check for negation modifiers, verify procedure sequence, and compute the 8 diagnostic metrics. 

## OUTPUT FORMAT (STRICT JSON ONLY): 

{ 

"student_id": "STU-102", 

"score": 10.0, 

- "max_score": 10.0, 

"ocr_confidence": 96.5, 

- "diagnostics": { 

- "garbage_text_score": 0.0, 

"negation_detected": false, 

"synonym_matched": true, 

- "spelling_autocorrected": true, 

- "sequence_match": true, 

- "diagram_verified": true, 

"density_ratio": 88.5, 

- "rubric_breakdown": [ 

- { "concept": "Sunlight", "awarded": 3, "max": 3 }, 

- { "concept": "Chlorophyll", "awarded": 3, "max": 3 } 

- ] 

- } 

- } 

