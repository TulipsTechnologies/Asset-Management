import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// `useLayoutEffect` measures before paint, so a menu never flashes its content
// clipped for a frame — but React warns when it runs during SSR, and these menus
// are server-rendered along with their trigger. Fall back to `useEffect` there.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Reports whether an element's content actually exceeds its box, so a popup can
 * become a scroll container only once it needs to be one.
 *
 * The shared stylesheet styles `*::-webkit-scrollbar`, which opts every scroll
 * container out of Chrome's overlay scrollbars and into classic ones that consume
 * layout space. Inside a shrink-to-fit popup — the portalled `Dropdown` panel is
 * `position: fixed` with `width: auto` — Chromium folds that 10px gutter into the
 * panel's intrinsic width and paints the bar even when there is nothing to scroll.
 * Staying `overflow: hidden` until the content really overflows keeps the element
 * from being a painted scroll container it never uses.
 *
 * Pass the data the element renders as `deps` so the measurement re-runs when the
 * content changes without the box itself resizing. `deps` must keep a constant
 * length between renders, like any dependency array.
 */
export function useOverflowScroll<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px tolerance absorbs sub-pixel rounding at fractional zoom levels.
    setIsScrollable(el.scrollHeight - el.clientHeight > 1);
  }, []);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return { ref, isScrollable };
}

export default useOverflowScroll;
