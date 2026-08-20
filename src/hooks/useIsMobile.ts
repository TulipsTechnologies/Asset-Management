import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 639px)";
const COMPACT_QUERY = "(max-width: 767px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);

  return matches;
}

/**
 * Returns true when the viewport is below the Tailwind `sm` breakpoint.
 * SSR-safe: starts as `false` and resolves after mount.
 */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

/**
 * Returns true below the Tailwind `md` breakpoint — phones and small tablets.
 *
 * Used to drop horizontally pinned table columns (locked columns and the
 * right-pinned actions column). On a narrow viewport a pinned column covers a
 * large share of the width and hides the row content scrolling beneath it.
 * SSR-safe: starts as `false` and resolves after mount.
 */
export function useIsCompactViewport(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

export default useIsMobile;
