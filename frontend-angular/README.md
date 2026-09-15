# Enterprise Hybrid RAG - Angular 17 SPA Frontend

A modern, responsive, dark-themed Single Page Application (SPA) built with **Angular 17+**, **TypeScript**, **RxJS**, and **Lucide Icons** to interact with the Enterprise Hybrid RAG API.

---

## ✨ Features

- **Interactive Search Bar (`search-bar`):**
  - Real-time query execution.
  - Retrieval mode toggling: `Hybrid (Dense + BM25)`, `Dense Vector Only`, or `Sparse Keyword (BM25) Only`.
  - Chunking strategy selector: `Structure-Aware`, `Fixed-Size`, `Semantic Topic`, or `All`.
  - Reranker and citation verification toggles.

- **Verified Answer View (`answer-view`):**
  - Grounded answer rendering with interactive, clickable bracket citations (e.g. `[1]`, `[2]`).
  - Real-time processing latency and retrieved chunk statistics.
  - Transparent fallback notifications for low-confidence queries.

- **Citation & Chunk Evidence Drawer (`citation-drawer`):**
  - Slide-out side drawer displaying detailed claim-to-chunk verification verdicts (`SUPPORTED`, `UNSUPPORTED`, `CONTRADICTED`).
  - Shows source file, section breadcrumbs, verification reasoning, and exact snippet match.

- **Multi-Metric Confidence Gauge (`confidence-gauge`):**
  - Visual breakdown of the Composite Confidence score.
  - Sub-scores for **Retrieval Relevance**, **Citation Grounding**, and **Answer Completeness**.

- **Side-by-Side Chunking Strategy Comparison (`strategy-compare`):**
  - Compare answers, confidence scores, and citations across **Fixed-Size**, **Structure-Aware**, and **Semantic** chunking strategies for the same query.

- **Document Ingestion Interface (`document-ingest`):**
  - Drag-and-drop or file upload for `.pdf`, `.md`, `.html`, and `.txt` files.
  - Real-time indexing into Qdrant vector store and BM25 index with deduplication metrics.

---

## 🛠️ Tech Stack

- **Framework:** Angular 17.3 (Standalone components, reactive forms, RxJS observables)
- **Styling:** Modern Vanilla CSS Design System with dark-mode glassmorphism and subtle micro-animations
- **Icons:** `lucide-angular`
- **Reverse Proxy / Deployment:** Nginx with Docker containerization

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.x or 20.x & npm (Or install in Conda via `conda install -c conda-forge nodejs -y`)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Open in your browser:**
   Visit `http://localhost:4200/`

> Ensure the FastAPI backend is running at `http://localhost:8000`.

---

### Building for Production

```bash
npm run build
```
The production bundle will be output to `dist/rag-hybrid-ui/`.

---

### Docker Container

```bash
docker build -t rag-hybrid-angular-ui .
docker run -p 4200:80 rag-hybrid-angular-ui
```
