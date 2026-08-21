import { beforeEach, describe, expect, it } from 'vitest';
import { popVisit, previousVisit, recordVisit } from '../navHistory';

const KEY = 'assetManagement.navStack';

/*
 * This suite runs on the node environment (vitest.config: environment: 'node'), so there is
 * no sessionStorage. A six-line in-memory stand-in is a smaller price than adding jsdom to
 * the toolchain for one file — and the module only ever uses these three methods.
 */
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
});

const stack = () => JSON.parse(sessionStorage.getItem(KEY) || '[]');

describe('the recorded journey', () => {
  it('has nowhere to go back to at the start of a session', () => {
    recordVisit('/assets');
    expect(previousVisit()).toBeNull();
    expect(popVisit()).toBeNull();
  });

  it('returns to the page actually visited, not the one above it in the menu', () => {
    // The whole point: /assets/{id} sits under /assets in the menu, but this operator came
    // from /assignments and that is where Back must take them.
    recordVisit('/assignments');
    recordVisit('/assets/019f-aaa');
    expect(previousVisit()).toBe('/assignments');
  });

  it('keeps the query string, so a filtered list comes back filtered', () => {
    recordVisit('/reports?code=assets-by-location&locationId=019f-bbb');
    recordVisit('/assets/019f-aaa');
    expect(previousVisit()).toBe(
      '/reports?code=assets-by-location&locationId=019f-bbb'
    );
  });

  it('treats a query change on the same page as the same page', () => {
    // Tabs and filters push query strings. Stacking them would turn Back into an undo button
    // for the current page instead of a way off it.
    recordVisit('/maintenance');
    recordVisit('/maintenance?tab=workorders');
    recordVisit('/maintenance?tab=requests');
    expect(stack()).toEqual(['/maintenance?tab=requests']);
    expect(previousVisit()).toBeNull();
  });

  it('keeps the newest query when it collapses those visits', () => {
    recordVisit('/assets');
    recordVisit('/assets?lifecycleStatus=2');
    recordVisit('/assets/019f-aaa');
    expect(previousVisit()).toBe('/assets?lifecycleStatus=2');
  });

  it('does not grow when a page is reloaded', () => {
    recordVisit('/assets');
    recordVisit('/assets');
    recordVisit('/assets');
    expect(stack()).toEqual(['/assets']);
  });

  it('walks back through a journey a step at a time', () => {
    recordVisit('/dashboard');
    recordVisit('/reports?code=x');
    recordVisit('/assignments');
    recordVisit('/assets/019f-aaa');

    expect(popVisit()).toBe('/assignments');
    expect(popVisit()).toBe('/reports?code=x');
    expect(popVisit()).toBe('/dashboard');
    // Start of the session: nothing further back, and the last entry is not consumed.
    expect(popVisit()).toBeNull();
    expect(stack()).toEqual(['/dashboard']);
  });

  it('goes back rather than bouncing when a page is revisited', () => {
    // A -> B -> A. Back from the second A is B, which IS where they came from.
    recordVisit('/assets');
    recordVisit('/locations');
    recordVisit('/assets');
    expect(popVisit()).toBe('/locations');
    expect(popVisit()).toBe('/assets');
  });

  it('stays bounded on a long session', () => {
    for (let i = 0; i < 60; i++) recordVisit(`/assets/019f-${i}`);
    expect(stack().length).toBeLessThanOrEqual(25);
    expect(stack()[stack().length - 1]).toBe('/assets/019f-59');
  });

  it('survives a corrupt store rather than taking navigation down with it', () => {
    sessionStorage.setItem(KEY, 'not json');
    expect(previousVisit()).toBeNull();
    recordVisit('/assets');
    expect(stack()).toEqual(['/assets']);
  });
});
