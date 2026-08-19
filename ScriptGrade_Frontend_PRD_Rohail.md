# **_ScriptGrade – Technical Specification Document (PRD)_** 

**Event:** Alibaba Cloud AI Hackathon Pakistan 2026. 

**Target Architecture:** B2B Enterprise Web Application (5 Frontend Pages Layout). 

**Document Purpose:** Complete A-to-Z UI/UX Blueprint, Technology Stack, Routing Architecture, Component Logic, and Backend API Contracts. 

### **_Developer Assignment & Responsibility Matrix_** 

- **Document Assigned To:** Rohail Khan Shinwari _(Frontend Lead)_ 

- **Assigned Deliverables:** 

   - Implementation of all 5 core frontend pages (/login & /signup, /dashboard, /exam/setup, /exam/upload, /exam/grade). 

   - End-to-end user experience, interactive rubric studio, state management, and real-time diagnostic workspace. 

   - Integrating all 9 REST API contracts with backend services. 

   - Ensuring complete visual compliance with Alibaba Cloud Qwen AI branding and design system guidelines. 

### **1. Executive Summary & Design System** 

ScriptGrade is an AI-assisted, teacher-first descriptive exam evaluation platform. To eliminate cognitive overload, avoid layout congestion, and maintain a production-ready enterprise SaaS feel, the frontend is organized into 5 Task-Focused Pages. 

### **Visual Guidelines & UI Aesthetics** 

### **Color Palette:** 

- **Primary Accent:** Slate Blue / Indigo (#4F46E5 / bg-indigo-600) 

- **Background:** Crisp Neutral Slate (#F8FAFC / bg-slate-50) 

- **Containers & Cards:** Pure White (#FFFFFF / bg-white) with subtle borders (border-slate-200) and soft elevation (shadow-sm) 

- **Status Indicators:** Emerald Green (Pass/Match), Rose Red (Garbage Text/Negation Alert), Amber Yellow (Sequence Mismatch/Partial), Cyan Blue (Vision AI Verified) 

### **Typography & Iconography:** 

- Inter Font Family (Google Fonts), Lucide Icons / FontAwesome 

### **2. Comprehensive Technology Stack** 

### **Frontend Stack** 

- **Framework:** Next.js 14+ (App Router) or React 18+ (Vite) 

- **Styling:** Tailwind CSS (Utility-first styling) 

- **UI Components & Icons:** Lucide React Icons, Radix UI / Shadcn UI 

- **Data Visualization:** ApexCharts.js / Recharts (for class performance distribution) 

- **State Management:** Zustand / TanStack React Query (for async API state & caching) 

### **Backend & AI Infrastructure** 

- **Core Intelligence (LLM):** Alibaba Cloud Qwen-2.5 / Qwen-Plus (for semantic matching, dependency parsing, and rubric extraction) 

- **Vision & OCR Engine:** Alibaba Cloud Qwen-VL (Vision-Language Model) for handwritten diagrams, flowcharts, and OCR 

- **API Framework:** Fast/Express Python API or Node.js Backend Gateway 

- **Database & Vector Store:** Alibaba Cloud AnalyticDB for PostgreSQL / Milvus (Vector Embeddings) 

### **3. Router & Navigation Architecture** 

#### **Complete 5-Page Router Architecture Flow:** 

Page 1: Auth (/login & /signup) ── ► Page 2: Home (/dashboard) ── ► Page 3: AI Rubric Studio (/exam/setup) ── ► Page 4: Batch Processing (/exam/upload) ── ► Page 5: Master Workspace (/exam/grade) 

## **4. Detailed Page-by-Page Specifications** 

### **Page 1: Authentication & Security Module (/login & /signup)** 

**Goal:** Ensure exam secrecy, institutional data isolation, and provide a seamless onboarding experience for educators. 

### **UI/UX & Layout Specifications** 

### **Split-Screen Design:** 

- **Left Banner (Visual Branding):** Hero graphic featuring ScriptGrade branding, Alibaba Cloud Qwen AI badge, and key metric highlights (e.g., _"Automating descriptive exam evaluation with 80% time saved"_ ). 

- **Right Form Panel (Authentication Form):** Minimalist, clean form with toggle tabs between Sign In and Sign Up. 

### **Core Features & Form Fields** 

### **Sign In (/login):** 

- Institutional Email & Password fields. 

- Remember Me checkbox & Forgot Password? recovery flow link. 

- **Single Sign-On (SSO):** "Sign in with Google Workspace for Education / Microsoft 365" dummy/mock integration buttons. 

- **Demo Access Trigger (CRITICAL FOR HACKATHON):** A prominent Quick Demo Access button that auto-fills credentials and instantly redirects to /dashboard for rapid presentation demonstrations. 

### **Sign Up (/signup):** 

- Full Name, Institutional Email, Institution/School Name, and Role Dropdown (Teacher / Department Head / Exam Controller). 

- Password creation with live strength meter. 

- Terms of Service & Exam Data Secrecy Agreement checkbox. 

### **Data Isolation & Security Measures:** 

- JWT (JSON Web Token) session handling to isolate exam paper data, custom rubrics, and student records per teacher account. 

### **PAGE 2: Main Dashboard & Exam Hub (/dashboard)** 

**Goal:** High-level overview, exam management, and primary action triggers. 

- **Top Navigation Bar:** 

   - ScriptGrade Logo + "Alibaba Cloud Qwen-Powered" badge. 

   - Global Metrics Bar: Total Exams Checked, Overall Accuracy %, Hours Saved. 

   - Primary Call-to-Action: + Create & Grade New Exam button. 

### • **Main Body Layout:** 

- **Recent Exams Table:** Columns for Exam Name (e.g., _Biology 101 – Term 1_ ), Date, Class Size, Status (Completed / In Progress), and Class Average. 

- **Analytics Overview Widget:** Bar/Line chart displaying student score distribution and flagged paper ratios. 

- **Quick Actions Panel:** Shortcuts to re-extract rubrics, review past logs, or download class summary reports. 

### **PAGE 3: AI Rubric Studio & Exam Setup (/exam/setup)** 

**Goal:** Zero-stress setup resolving Teacher Setup Fatigue (Flaw #8) while offering complete manual keyword control. 

- **Header:** Breadcrumb navigation (Dashboard > New Exam Setup). 

- **Section A: Upload & Extraction Dropzone:** 

   - File uploader for Question Paper & Reference Model Answer (PDF/PNG). 

   - Action Button: Auto-Extract Rubric with Qwen AI. 

### • **Section B: Interactive Magic Concepts Editor (CRITICAL FEATURE):** 

- **Auto-Extracted Tags Grid:** Interactive UI tags showing AI-extracted keywords and points (e.g., Sunlight - 3pts, Chlorophyll - 3pts, Glucose - 2pts). 

### `o` **Teacher Manual Controls:** 

- + Add Magic Word button to manually inject missing keywords. 

- Edit icon on each tag to adjust point weightage. 

- X delete icon on each tag to remove unwanted keywords. 

      - Synonyms Cluster Sub-panel: View, add, or edit alternative phrasing options (e.g., solar energy, green pigments). 

- **Section C: Evaluation Sensitivity Toggles:** 

   - **Toggle 1:** _Ignore Minor Spelling Mistakes_ (Levenshtein Distance Threshold 85% - Flaw #4). 

   - **Toggle 2:** _Strict Procedural Order Matching_ (DAG Logic Enforcement - Flaw #5). 

   - **Toggle 3:** _Information Density Scoring_ (Anti-Fluff Normalization - Flaw #7). 

- **Page Footer CTA:** Save Rubric & Proceed to Paper Upload button. 

### **PAGE 4: Batch Upload & Scan Portal (/exam/upload)** 

**Goal:** Bulk handling of physical answer sheets via Scanner PDFs or Mobile App synchronization. 

- **Header:** Breadcrumb navigation (Dashboard > Biology 101 > Upload Sheets). 

- **Section A: Dual-Source Upload Hub:** 

   - **Option 1 (Office ADF Scanner):** Drag & drop zone for multi-page bulk scanned PDFs. 

   - **Option 2 (Mobile App Sync):** QR Code / Live Status Indicator showing "Synced with ScriptGrade Mobile Auto-Snap Tool". 

### • **Section B: Real-Time Processing Monitor:** 

   - Dynamic Progress Bar: _"Qwen-VL Vision AI evaluating 50 student sheets..."_ 

   - Live Counters: Processed: 48/50 | Flagged for Review: 2/50. 

- **Page Footer CTA:** Launch Master Grading Workspace button (Enabled when batch processing completes). 

### **PAGE 5: Master Grading & Diagnostic Workspace (/exam/grade)** 

**Goal:** Detailed paper evaluation, edge-case diagnostics, and teacher override controls. 

- **Layout:** Clean 2-Column Split View. 

- **LEFT COLUMN: Student Sheet & Navigation (50% Width):** 

   - Active Student Selector: Dropdown & search bar (Filterable by Flagged Only). 

   - Student Papers Sidebar List: Status badges ( _100% Vision Verified_ , _0% Garbage Text_ , _40% Sequence Mismatch_ ). 

   - Document Viewer: High-resolution view of scanned answer sheet / OCR rendered text / handwritten diagrams. 

- **RIGHT COLUMN: AI Diagnostic & Teacher Override (50% Width):** 

   - **Overall Score Widget:** Prominent display of score (10/10 Marks), OCR Confidence %, Word Count, and Information Density Ratio %. 

### `o` **Vulnerability Diagnostic Tabs (8 Edge-Case Debuggers):** 

1. _Garbage Text:_ Shows Contextual Relevance Score %. 

2. _Negation Detection:_ Highlights negative modifiers (NOT, NEVER). 

3. _Synonym Match:_ Shows mapped alternative terms. 

4. _Spelling Typos:_ Highlights auto-corrected spelling errors. 

5. _Sequence Graph:_ Visualizes chronological step order flow. 

6. _Diagrams (Vision AI):_ Displays Qwen-VL detected visual labels & arrows. 

7. _Length Bias:_ Displays fluff-filtered density rating. 

8. _Rubric Match:_ Itemized concept breakdown. 

### `o` **Teacher Manual Override Panel:** 

   - Numeric Input: Adjust score manually (e.g., Change 0/10 to 8/10). 

   - Text Area: Add moderation notes for record keeping. 

   - Action Button: Confirm Override (Recalculates class stats in realtime). 

- **Page Footer Actions:** Export Class Results (CSV/PDF) and Finish Session buttons. 

### **5. Frontend API Integration Contracts** 

The frontend engineer (Rohail Khan Shinwari) must connect UI views to the following REST API endpoints: 

1. **Login:** POST /api/v1/auth/login: Validates user credentials, generates session token, and returns teacher profile metadata. 

2. **Signup:** POST /api/v1/auth/signup: Registers a new educator account and initializes institutional workspace defaults. 

3. **Dashboard Overview:** GET /api/v1/exams/list (Fetches active and completed exam logs). 

4. **Setup & Auto-Rubric:** POST /api/v1/exam/setup (Uploads question paper/sample answer, returns extracted concepts/synonyms). 

5. **Rubric Customization:** PUT /api/v1/exam/rubric (Submits updated magic words, custom words, weights, and toggles). 

6. **Batch Processing:** POST /api/v1/papers/batch-upload (Uploads scanned multipage PDFs). 

7. **Detailed Evaluation:** GET /api/v1/papers/{student_id} (Fetches score breakdown, OCR text, and diagnostic logs). 

8. **Manual Override:** POST /api/v1/papers/{student_id}/override (Posts manual score changes and notes). 

9. **Export Results:** GET /api/v1/analytics/export?exam_id={id} (Downloads final result CSV/PDF). 

