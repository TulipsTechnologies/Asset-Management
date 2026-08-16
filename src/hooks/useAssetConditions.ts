'use client';

import { useCallback, useEffect, useState } from 'react';
import { IAssetConditionLookup } from '@/interface/IAssetConditionType';
import { fetchAssetConditionLookup } from '@/services/assetConditionType.service';

/**
 * The condition scale, fetched once and shared.
 *
 * Nine screens record a condition and two of them live in modals that remount on every open,
 * so a per-consumer fetch would issue the same request nine times a page. The cache is
 * module-scoped and the in-flight promise is shared, which also means a modal opened during
 * the first load resolves from that same request rather than starting a second.
 *
 * Call `refreshAssetConditions()` after any settings mutation, or a rename stays invisible on
 * every other screen until a hard reload.
 */

let cache: IAssetConditionLookup[] | null = null;
let inFlight: Promise<IAssetConditionLookup[]> | null = null;

const load = (): Promise<IAssetConditionLookup[]> => {
  if (cache) return Promise.resolve(cache);
  if (!inFlight)
    inFlight = fetchAssetConditionLookup()
      .then((response) => {
        cache = response?.data ?? [];
        return cache;
      })
      .finally(() => {
        inFlight = null;
      });
  return inFlight;
};

/** Drops the cache so the next consumer re-fetches. */
export const refreshAssetConditions = () => {
  cache = null;
  inFlight = null;
};

export const useAssetConditions = (
  /** A condition the current record already holds — included even if deactivated. */
  includeId?: string | null
) => {
  const [conditions, setConditions] = useState<IAssetConditionLookup[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);

    // A held id is per-record, so it bypasses the shared cache with its own fetch.
    const request = includeId
      ? fetchAssetConditionLookup(includeId).then((response) => response?.data ?? [])
      : load();

    setLoading(!cache || !!includeId);
    request
      .then((rows) => {
        if (!live) return;
        setConditions(rows);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [includeId]);

  const nameById = useCallback(
    (id?: string | null) => conditions.find((c) => c.id === id)?.name,
    [conditions]
  );

  return {
    conditions,
    loading,
    failed,
    /** Ready for a Select. An inactive row is labelled so nobody re-picks it by accident. */
    options: conditions.map((c) => ({
      value: c.id,
      label: c.isActive ? c.name : `${c.name} (inactive)`,
    })),
    /**
     * What a Select should show instead of options. "No matches" is the component's default
     * and reads as "your search found nothing" — actively wrong while a fetch is in flight.
     */
    emptyText: loading
      ? 'Loading conditions…'
      : failed
        ? 'Could not load conditions'
        : undefined,
    nameById,
  };
};

export default useAssetConditions;
