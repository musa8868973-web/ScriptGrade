# ScriptGrade AI Studio

Act as a World-Class Principal Frontend Architect and Enterprise UI/UX Designer. You are tasked with engineering the flagship, state-of-the-art Web Application for "ScriptGrade" — an AI-Powered NLP Automated Grading & Diagnostic Platform.

CRITICAL RULE 0: MANDATORY SPECIFICATION & PRD COMPLIANCE (ZERO HALLUCINATION)

- Read, digest, and strictly adhere to the attached ground-truth specifications:

  1. `README.md` (System Architecture & Master Workflows)

  2. `docs/ScriptGrade_Frontend_PRD_Rohail.md` (Rohail's Web UI/UX Specifications, Components, Routes, and State Machine)

- Every single routing path, state machine parameter, API schema field, and diagnostic flag defined in Rohail's PRD must be accurately implemented without deviation or arbitrary redesigns.

VISUAL DESIGN LANGUAGE & DESIGN SYSTEM (WORLD-CLASS AESTHETICS):

- Theme: Modern Glassmorphic Enterprise Dark/Light Hybrid (Deep Slate/Navy backdrop #0B132B, Crisp Card Glass Surfaces, Neon Emerald/Cyan Accents).

- Typography: Inter / Plus Jakarta Sans paired with JetBrains Mono for diagnostic tokens and code blocks.

- Micro-Interactions: Smooth Framer-Motion style spring physics, hover-card lift, magnetic CTA buttons, and real-time processing skeletons.

- Layout Architecture: Sidebar Dashboard Layout with dynamic collapse, breadcrumb navigation, quick-action command palette (Ctrl/Cmd+K), and responsive mobile adaptors.

KEY SCREEN MODULES TO IMPLEMENT (PER FRONTEND PRD):

1. Authentication & Security Gate:

   - Enterprise Login & Registration with JWT token handling, role-based access visual indicators, and secure session state.

2. Exam & Rubric Management Studio:

   - Step 1: Model Solution & Question Paper Upload (PDF/Image dropzones with drag-and-drop feedback).

   - Step 2: AI Rubric Inspector & Interactive Weightage Editor (Question-wise scoring controls, criteria tags).

3. Student Answer Sheet Ingestion Dashboard:

   - Batch Scanning & Upload Queue with dynamic progress bars, retry logic, and instant status pills (Queued, Processing, OCR Active, Evaluation Complete).

4. 8-Debugger NLP Diagnostic Studio (FLAGSHIP FEATURE):

   - Interactive Split-Pane Viewer: Left side renders the student's paper with visual bounding boxes; Right side renders Musa's 8-Debugger Engine Outputs.

   - 8-Debugger Breakdown Widgets:

     * Garbage Classifier (Relevance score badge)

     * Negation & Synonym Matcher (Highlighted semantic shifts)

     * Fuzzy Spelling Correction (Before/After text diffs)

     * Sequence DAG Flow Alignment (Visual node flow of step logic)

     * Visual & Density Inspector (Layout analysis score)

     * Rubric Aggregator (Final calculated score breakdown + manual teacher override slider).

   - Language Detector Badge: Support for English and RTL scripts (Urdu, Sindhi, Punjabi).

5. Real-Time Analytics & Grade Insights:

   - Class performance heatmaps, grade distribution charts (Recharts/Chart.js), common student mistake clusters, and PDF/CSV Export suite.

TECHNICAL & API INTEGRATION REQUIREMENTS:

- Target Backend API: `http://localhost:8000/api/v1`

- Implement robust Axios/Fetch interceptors for JWT Bearer Tokens.

- Full TypeScript strictness with modular component structure.

- Include Toast notifications for error handling (401, 422, 500 status codes matching backend security contracts).

Deliver a stunning, pixel-perfect, hyper-functional, and production-ready React codebase that sets a new benchmark in EdTech AI interfaces!

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
