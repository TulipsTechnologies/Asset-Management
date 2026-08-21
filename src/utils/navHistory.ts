/**
 * Where the operator actually came from, remembered for the session.
 *
 * Back used to walk a static menu map: a detail page stepped up to its list, a list to its
 * hub. That answers "where does this page live", which is not the question someone asks when
 * they arrive at an asset from a report and want to get back to the report.
 *
 * The browser's own history cannot answer it either, and not for want of trying:
 *
 *  - This module is mounted inside the TulipsHRM host and SHARES its history stack. The entry
 *    behind a module page is frequently the host's sign-in redirect chain, so router.back()
 *    can bounce the operator to sign-in, which bounces them forward again.
 *  - A deep link or a cold tab has no in-app predecessor at all. AssetForm already carried
 *    this conclusion in a comment before this file existed.
 *  - The History API never exposes the previous entry's URL, so neither the destination nor
 *    the decision to show the control at all can be derived from it.
 *
 * Hence our own stack, in sessionStorage so it dies with the tab and never leaks between them.
 */

const STACK_KEY = 'assetManagement.navStack';

/** Deep enough to walk back through a real journey, shallow enough to stay a cheap write. */
const MAX_DEPTH = 25;

const read = (): string[] => {
  // Guarded on the thing this module actually uses rather than on `window`. Same answer
  // during SSR, and it means the stack can be exercised anywhere sessionStorage is provided.
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    // A corrupt or unavailable store must not take the navigation with it.
    return [];
  }
};

const write = (stack: string[]) => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-MAX_DEPTH)));
  } catch {
    /* private mode, quota — the hierarchy fallback still works without us */
  }
};

const pathOf = (href: string) => href.split('?')[0];

/**
 * Records arriving at `href` (pathname + search).
 *
 * Same pathname as the top entry REPLACES it rather than stacking. That single rule is what
 * keeps Back meaning "the previous page" instead of "the previous URL": tabs push
 * `?tab=workorders`, filters push query strings, and a reload re-announces the same route —
 * none of those are places you came from, and stacking them would turn Back into an undo
 * button for the current page. Replacing also keeps the newest query string, so returning to
 * a filtered list returns to it still filtered.
 */
export const recordVisit = (href: string) => {
  const stack = read();
  const top = stack[stack.length - 1];
  if (top && pathOf(top) === pathOf(href)) stack[stack.length - 1] = href;
  else stack.push(href);
  write(stack);
};

/** The page behind the current one, or null when this is where the session started. */
export const previousVisit = (): string | null => {
  const stack = read();
  return stack.length >= 2 ? stack[stack.length - 2] : null;
};

/**
 * Steps back, returning the href to navigate to.
 *
 * The current entry is dropped as it is left, so the stack keeps describing the journey and a
 * second Back goes a second step back rather than bouncing between two pages.
 */
export const popVisit = (): string | null => {
  const stack = read();
  if (stack.length < 2) return null;
  stack.pop();
  write(stack);
  return stack[stack.length - 1] ?? null;
};
