// The primary surface: renders one page of /pe2_student.pdf via PDF.js,
// filling all available space, with prev/next arrows, keyboard navigation,
// and a "Slide N / 150" counter.
//
// Props:
//   page     number     — 1-based slide number to display
//   total    number     — total slide count (for the counter and arrow state)
//   hasPrev  boolean    — enables the ← arrow
//   hasNext  boolean    — enables the → arrow
//   onPrev   () => void — step back one slide
//   onNext   () => void — step forward one slide
//
// PDF.js notes:
// - The document is loaded once (from /pe2_student.pdf in the public folder)
//   and cached; only page rendering re-runs on navigation/resize.
// - PDF.js forbids two render() operations on one canvas, and cancel() is
//   asynchronous — so each render cancels the previous task AND awaits its
//   settled promise before touching the canvas, with a sequence counter so
//   whichever call is newest wins (rapid arrows, the 250ms panel transition,
//   and StrictMode's dev double-mount all trigger this path).
// - A ResizeObserver re-renders on container size changes, which is also what
//   re-fits the slide when the agent panel opens (stage 100% → 68%).

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Worker version must match the installed pdfjs-dist (pinned 3.11.174).
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const PDF_URL = '/pe2_student.pdf';

export default function SlideStage({ page, total, hasPrev, hasNext, onPrev, onNext }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null); // in-flight PDF.js render, for cancellation
  const renderSeqRef = useRef(0); // monotonic id: only the newest render call may draw
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState(null);

  // Load the document once on mount.
  useEffect(() => {
    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument(PDF_URL);
    loadingTask.promise
      .then((doc) => { if (!cancelled) setPdf(doc); })
      .catch((err) => { if (!cancelled) setError(`Could not load slides: ${err.message}`); });
    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, []);

  // Render the current page whenever the page or container size changes.
  useEffect(() => {
    if (!pdf) return undefined;

    const renderPage = async () => {
      const seq = ++renderSeqRef.current;

      // Cancel the previous render and wait until it has fully released the
      // canvas — cancel() alone is not synchronous, and starting a new render
      // before the old one settles throws "Cannot use the same canvas during
      // multiple render() operations".
      const prev = renderTaskRef.current;
      if (prev) {
        prev.cancel();
        try { await prev.promise; } catch { /* cancellation rejection — expected */ }
      }
      // A newer call started while we waited; let it do the drawing.
      if (seq !== renderSeqRef.current) return;

      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      try {
        const pdfPage = await pdf.getPage(page);
        if (seq !== renderSeqRef.current) return;

        // Fit the whole slide inside the container (both dimensions), then
        // oversample by devicePixelRatio so text stays crisp on HiDPI screens.
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = Math.min(
          container.clientWidth / base.width,
          container.clientHeight / base.height
        );
        const dpr = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale: fit * dpr });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const task = pdfPage.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
        });
        renderTaskRef.current = task;
        await task.promise;
        // Successful draw — clear any error from an earlier slide so the
        // viewer recovers instead of showing a stale message forever.
        if (seq === renderSeqRef.current) setError(null);
      } catch (err) {
        // Cancellation of a superseded render is expected; anything else isn't.
        if (err?.name !== 'RenderingCancelledException' && seq === renderSeqRef.current) {
          setError(`Could not render slide ${page}: ${err.message}`);
        }
      }
    };

    renderPage();

    const observer = new ResizeObserver(renderPage);
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      renderTaskRef.current?.cancel();
    };
  }, [pdf, page]);

  // Keyboard navigation. Skipped while the student is typing in the agent
  // panel (or any editable element) — arrow keys there move the text cursor.
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || e.target.isContentEditable) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); onPrev(); }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPrev, onNext]);

  return (
    <section className="stage" ref={containerRef}>
      {/* Canvas stays mounted even during errors — unmounting it would make
          recovery impossible (the next render would have no canvas). */}
      <canvas className="stage__canvas" ref={canvasRef} />
      {error && <div className="stage__error">{error}</div>}

      <button
        type="button"
        className="stage__arrow stage__arrow--prev"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        type="button"
        className="stage__arrow stage__arrow--next"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next slide"
      >
        ›
      </button>

      <div className="stage__counter">Slide {page} / {total}</div>
    </section>
  );
}
