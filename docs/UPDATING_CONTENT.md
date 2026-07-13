# Updating Course Content

The three things you're most likely to change, and where they live. The backend is course-agnostic — all course knowledge comes from (a) the embedded PDF and (b) the outline + prompts in the frontend.

## 1. Replace or add a course PDF (the RAG knowledge base)

1. Copy the PDF into `RAG/example_data/`.
2. Edit `PDF_NAME` at the top of `RAG/ingest.py` to the new filename.
3. From the project root, in the `digital-human` env:
   ```bash
   python RAG/ingest.py
   ```
   It prints per-chunk progress and the final document count.

Notes:
- Ingestion **dedupes**: chunks whose text already exists in the collection are skipped, so re-running is safe and *adding* a second PDF just extends the knowledge base.
- **Replacing** the course wholesale needs a fresh collection — either change `chroma_db.collection_name` in `RAG/config.yaml` or stop the backend and delete the `chroma_db/` folder, then re-ingest.
- Chunking parameters (size 800 / overlap 150) and retrieval depth (`retrieve_k: 10`) are in `RAG/config.yaml`.

## 2. Edit the course outline (sidebar modules/sections)

Everything is in **`Frontend/src/course.js`** — a plain array of `{ title, sections: [...] }`. Add, rename, or reorder modules and sections there; the sidebar, progress bar, Prev/Next navigation, and the tutor prompts all adapt automatically (Vite hot-reloads on save).

Keep section names aligned with topics actually covered in the embedded PDF — the section name is inserted into the prompts, and RAG retrieval works best when it matches the source material's vocabulary.

## 3. Tune the tutor's voice and behavior

- **Question wrapper** (the "encouraging teacher" framing): `handleSend` in `Frontend/src/App.jsx`.
- **Section intro prompt** (the automatic 2–3 sentence opener): `sendIntro` in `Frontend/src/hooks/useChat.js`.
- **Answer grounding prompt** (how retrieved context is used): the `ChatPromptTemplate` in `serve_rag()` in `RAG/rag.py`.

## 4. Switch the LLM

1. `ollama pull <model>` on the DGX.
2. Set `llm.ollama_model` in `RAG/config.yaml`.
3. Restart the backend.

`MODEL` in `Frontend/src/config.js` is cosmetic — the backend echoes it back but always uses config.yaml's model. Smaller models (e.g. `llama3.1:8b`) answer much faster at some quality cost — worth it for demos.
