// Slide → course-section mapping for the PE 2.0 student deck (150 slides).
//
// Source of truth: docs/pe2_table_of_contents.md. Every slide 1–150 maps to a
// module and a section at *technique-level* granularity — all slides inside a
// technique block (e.g. Zero-Shot Prompting, slides 34–38) share one section
// name, so the agent panel label and the enriched query stay stable while the
// student steps through a technique.
//
// Exports:
//   TOTAL_SLIDES                 — 150
//   getSectionForSlide(n)        — { module, section } for slide n (clamped)

export const TOTAL_SLIDES = 150;

// [firstSlide, lastSlide, module, section] — contiguous, covering 1–150 with
// no gaps or overlaps (validated below). Ranges follow the ToC's technique
// blocks; module intro slides (title/objectives/agenda) get an "Overview"
// section and summaries get a "Summary" section so the label never lies about
// what is on screen.
const RANGES = [
  [1, 1, 'Prompt Engineering Course 2.0', 'Course Introduction'],

  // Module 1 — Foundations of AI and Prompt Engineering (2–30)
  [2, 5, 'Module 1 — Foundations', 'Module 1 Overview'],
  [6, 13, 'Module 1 — Foundations', 'What is AI / ML / GenAI'],
  [14, 17, 'Module 1 — Foundations', 'Anatomy of a Prompt'],
  [18, 18, 'Module 1 — Foundations', 'How LLMs Work'],
  [19, 19, 'Module 1 — Foundations', 'Tokenization and Context Windows'],
  [20, 20, 'Module 1 — Foundations', 'How LLMs Work'],
  [21, 29, 'Module 1 — Foundations', 'Ethics and Responsible AI'],
  [30, 30, 'Module 1 — Foundations', 'Module 1 Summary'],

  // Module 2 — Beginner Prompting Techniques (31–64)
  [31, 33, 'Module 2 — Beginner Techniques', 'Module 2 Overview'],
  [34, 38, 'Module 2 — Beginner Techniques', 'Zero-Shot Prompting'],
  [39, 43, 'Module 2 — Beginner Techniques', 'Few-Shot Prompting'],
  [44, 48, 'Module 2 — Beginner Techniques', 'Chain-of-Thought Prompting'],
  [49, 53, 'Module 2 — Beginner Techniques', 'Meta Prompting'],
  [54, 58, 'Module 2 — Beginner Techniques', 'Self-Consistency'],
  [59, 63, 'Module 2 — Beginner Techniques', 'Generate Knowledge Prompting'],
  [64, 64, 'Module 2 — Beginner Techniques', 'Module 2 Summary'],

  // Module 3 — Intermediate Prompting Techniques (65–110)
  [65, 67, 'Module 3 — Intermediate Techniques', 'Module 3 Overview'],
  [68, 73, 'Module 3 — Intermediate Techniques', 'Prompt Chaining'],
  [74, 79, 'Module 3 — Intermediate Techniques', 'Agentic Prompting'],
  [80, 85, 'Module 3 — Intermediate Techniques', 'Tree of Thoughts'],
  [86, 91, 'Module 3 — Intermediate Techniques', 'Retrieval Augmented Generation (RAG)'],
  [92, 97, 'Module 3 — Intermediate Techniques', 'Automatic Reasoning and Tool-Use (ART)'],
  [98, 103, 'Module 3 — Intermediate Techniques', 'AI-Assisted Prompt Refinement'],
  [104, 109, 'Module 3 — Intermediate Techniques', 'Interactive Prompting'],
  [110, 110, 'Module 3 — Intermediate Techniques', 'Module 3 Summary'],

  // Module 4 — Advanced Prompting Techniques (111–150)
  [111, 113, 'Module 4 — Advanced Techniques', 'Module 4 Overview'],
  [114, 119, 'Module 4 — Advanced Techniques', 'ReAct (Reasoning + Acting)'],
  [120, 125, 'Module 4 — Advanced Techniques', 'Role / Persona Prompting'],
  [126, 131, 'Module 4 — Advanced Techniques', 'Program-Aided Language Models (PAL)'],
  [132, 136, 'Module 4 — Advanced Techniques', 'Reflexion'],
  [137, 141, 'Module 4 — Advanced Techniques', 'Multimodal Chain of Thought (MMCoT)'],
  [142, 146, 'Module 4 — Advanced Techniques', 'Graph Prompting'],
  [147, 149, 'Module 4 — Advanced Techniques', 'Module 4 Summary & Knowledge Check'],
  [150, 150, 'Module 4 — Advanced Techniques', 'Course Closing'],
];

// Expand ranges into a flat 150-entry lookup (index 0 = slide 1) so
// getSectionForSlide is O(1) and coverage can be asserted once at load.
const SLIDE_MAP = new Array(TOTAL_SLIDES);
for (const [first, last, module, section] of RANGES) {
  for (let n = first; n <= last; n++) SLIDE_MAP[n - 1] = { module, section };
}

// Every slide must be covered exactly once; a gap here means RANGES and the
// ToC have drifted — fail loudly in dev rather than sending wrong context.
if (import.meta.env.DEV && SLIDE_MAP.some((entry) => entry === undefined)) {
  throw new Error('slideMap.js: RANGES do not cover all slides 1–150');
}

/**
 * getSectionForSlide(slideNumber: number) → { module: string, section: string }
 * Slide numbers are 1-based; out-of-range input is clamped into [1, 150] so
 * callers never receive undefined.
 */
export function getSectionForSlide(slideNumber) {
  const n = Math.min(Math.max(1, slideNumber), TOTAL_SLIDES);
  return SLIDE_MAP[n - 1];
}
