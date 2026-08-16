'use client';

import { useEffect, useState } from 'react';
import { getActiveCompanyId } from '@/services/assetToken';
import { requestApi } from '@/services/httpService';

/**
 * The company every request on this page is scoped to, by name.
 *
 * There was no way to answer "which company am I looking at?" from the screen. The id lives in a
 * cookie, the API scopes silently to it, and the only symptom of being in the wrong one is data
 * that looks plausible but belongs to someone else — the failure that preceded this hook was an
 * operator running a destructive reset against a company they did not know they were in.
 *
 * Resolved once per id and cached for the tab: the name cannot change under us, every page mounts
 * this, and a company lookup per navigation would be pure noise in the network log.
 */
const nameCache = new Map<string, string>();

export interface IActiveCompany {
  id: string;
  /** Null until resolved, and if the lookup fails — the id is shown instead, never nothing. */
  name: string | null;
}

export const useActiveCompany = (): IActiveCompany | null => {
  const [company, setCompany] = useState<IActiveCompany | null>(null);

  useEffect(() => {
    const id = getActiveCompanyId();
    if (!id) {
      setCompany(null);
      return;
    }

    const cached = nameCache.get(id.toLowerCase());
    if (cached) {
      setCompany({ id, name: cached });
      return;
    }

    let cancelled = false;
    setCompany({ id, name: null });

    (async () => {
      try {
        const res = await requestApi({
          apiEndpoint: '/Companies',
          method: 'GET',
          completeData: true,
        });
        const companies = Array.isArray(res?.data) ? res.data : [];
        const match = companies.find(
          (c: { id?: string }) => c?.id?.toLowerCase() === id.toLowerCase()
        );
        if (match?.name) nameCache.set(id.toLowerCase(), match.name);
        if (!cancelled) setCompany({ id, name: match?.name ?? null });
      } catch {
        // Leave the name null — the badge falls back to the id, which still answers
        // "am I where I think I am?" better than showing nothing.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return company;
};
