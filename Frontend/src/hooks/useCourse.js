import { useCallback, useState } from 'react';
import { SECTIONS } from '../course';

export function useCourse() {
  // Index into SECTIONS; null until the student picks a section
  const [currentIndex, setCurrentIndex] = useState(null);
  const [completed, setCompleted] = useState(() => new Set());
  const [openModules, setOpenModules] = useState(() => new Set([0]));

  const select = useCallback((index) => {
    setCurrentIndex(index);
    const { key, moduleIndex } = SECTIONS[index];
    setCompleted((prev) => new Set(prev).add(key));
    setOpenModules((prev) => new Set(prev).add(moduleIndex));
  }, []);

  const toggleModule = useCallback((moduleIndex) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(moduleIndex) ? next.delete(moduleIndex) : next.add(moduleIndex);
      return next;
    });
  }, []);

  const current = currentIndex === null ? null : SECTIONS[currentIndex];
  const hasPrev = currentIndex !== null && currentIndex > 0;
  const hasNext = currentIndex === null || currentIndex < SECTIONS.length - 1;
  const progress = Math.round((completed.size / SECTIONS.length) * 100);

  return {
    currentIndex,
    current,
    completed,
    openModules,
    progress,
    hasPrev,
    hasNext,
    select,
    toggleModule,
  };
}
