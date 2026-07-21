// Slide-position state for the slide-primary layout.
//
// Replaces the old useCourse hook: instead of section-selection + accordion
// state, the single source of truth is now the current slide number (1-based,
// clamped to [1, TOTAL_SLIDES]). The course section is *derived* from the
// slide via slideMap.js, never stored, so the two can't disagree.
//
// Returns:
//   slide    number                    — current slide, 1-based
//   total    number                    — TOTAL_SLIDES (150)
//   current  { module, section }       — section info for the current slide
//   hasPrev  boolean                   — slide > 1
//   hasNext  boolean                   — slide < total
//   goPrev() / goNext()                — step one slide (no-op at the ends)
//   goTo(n)                            — jump to slide n (clamped)

import { useCallback, useState } from 'react';
import { TOTAL_SLIDES, getSectionForSlide } from '../slideMap';

export function useSlide() {
  const [slide, setSlide] = useState(1);

  const goTo = useCallback((n) => {
    setSlide(Math.min(Math.max(1, n), TOTAL_SLIDES));
  }, []);

  // Functional updates so rapid calls (held-down arrow key) never act on a
  // stale slide number.
  const goPrev = useCallback(() => setSlide((s) => Math.max(1, s - 1)), []);
  const goNext = useCallback(() => setSlide((s) => Math.min(TOTAL_SLIDES, s + 1)), []);

  return {
    slide,
    total: TOTAL_SLIDES,
    current: getSectionForSlide(slide),
    hasPrev: slide > 1,
    hasNext: slide < TOTAL_SLIDES,
    goPrev,
    goNext,
    goTo,
  };
}
