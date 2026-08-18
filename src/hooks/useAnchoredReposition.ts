import { useEffect } from "react";

/**
 * Keeps a portal-anchored popup glued to its trigger while the page scrolls.
 *
 * These apps scroll an inner container (the dashboard content shell, the table
 * scroller) rather than `window`, so a bubble-phase listener never fires and a
 * one-shot measurement strands the popup. Capture phase catches scroll from any
 * ancestor; rAF collapses a burst of scroll events into one measurement per frame.
 *
 * `reposition` must be referentially stable (wrap it in `useCallback`), otherwise
 * the listeners re-subscribe on every render.
 */
export function useAnchoredReposition(
  isOpen: boolean,
  reposition: () => void
): void {
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;

    reposition();

    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reposition);
    };

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [isOpen, reposition]);
}

export default useAnchoredReposition;
