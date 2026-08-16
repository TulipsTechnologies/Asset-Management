'use client';

import { useEffect, useState } from 'react';
import { fetchAssetDocuments, downloadAssetDocument } from '@/services/assetDocument.service';

/**
 * The asset's primary photo, as a blob URL.
 *
 * Fetched, not linked. Asset photos live under a root no static-file middleware serves — /Files
 * is mapped ahead of authentication, so anything reachable by URL there is readable by anyone —
 * which means the only way to a photo is the authenticated document endpoint. An <img src> cannot
 * carry an Authorization header, so the bytes come down through the normal API client and become
 * an object URL.
 *
 * Returns null while loading, when the asset has no photo, or when the file is missing (an import
 * whose bytes failed to move into place leaves exactly that). A missing photo is the fallback
 * avatar, never an error — nothing about this page depends on it.
 */
export const useAssetPrimaryPhoto = (assetId: string | undefined): string | null => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const documents = await fetchAssetDocuments(assetId);
        const primary = (documents?.data ?? []).find((d) => d.isPrimaryPhoto);
        if (!primary || cancelled) return;

        const response = await downloadAssetDocument(primary.id);
        if (!response?.ok || cancelled) return;

        const blob = await response.blob();
        if (cancelled || blob.size === 0) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        /* No photo is a normal state for an asset — never a message. */
      }
    })();

    return () => {
      cancelled = true;
      // Revoked on unmount AND whenever the asset changes, or navigating a register of
      // photographed assets leaks a blob per visit.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return url;
};
