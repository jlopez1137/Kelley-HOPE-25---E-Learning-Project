export const COURSE = [
  {
    title: 'Module 1 — Foundations',
    sections: [
      'What is AI / ML / GenAI',
      'How LLMs Work',
      'Tokenization and Context Windows',
      'Anatomy of a Prompt',
      'Ethics and Responsible AI',
    ],
  },
  {
    title: 'Module 2 — Beginner Techniques',
    sections: [
      'Zero-Shot Prompting',
      'Few-Shot Prompting',
      'Chain-of-Thought Prompting',
      'Meta Prompting',
      'Self-Consistency',
      'Generate Knowledge Prompting',
    ],
  },
  {
    title: 'Module 3 — Intermediate Techniques',
    sections: [
      'Prompt Chaining',
      'Tree of Thoughts',
      'Retrieval Augmented Generation (RAG)',
      'Automatic Reasoning & Tool-Use',
      'AI-Assisted Prompt Refinement',
      'Interactive Prompting',
      'Agentic Prompting',
    ],
  },
  {
    title: 'Module 4 — Advanced Techniques',
    sections: [
      'ReAct',
      'Role / Persona Prompting',
      'PAL (Program-Aided Language Models)',
      'Reflexion',
      'Multimodal Chain-of-Thought',
      'Graph Prompting',
    ],
  },
];

// Flat, ordered list of every section for Prev/Next navigation and progress
export const SECTIONS = COURSE.flatMap((module, moduleIndex) =>
  module.sections.map((section, sectionIndex) => ({
    key: `${moduleIndex}:${sectionIndex}`,
    moduleIndex,
    moduleTitle: module.title,
    section,
  }))
);
