'use client';

import { useEffect, useState } from 'react';
import {
  downloadAssetDocument,
  fetchAssetDocuments,
} from '@/services/assetDocument.service';
import { AssetDocumentTypeEnum } from '@/enum/assetDocumentEnums';
import { IAssetDocument } from '@/interface/IAssetDocument';

/**
 * One asset's photo, resolved to a blob URL — shared by every surface that shows one.
 *
 * Asset photos are NOT reachable by URL: /Files is mapped ahead of authentication, so the
 * only way to the bytes is the authenticated document endpoint, and an <img src> cannot
 * carry an Authorization header. The bytes therefore come down through the normal API
 * client and become an object URL.
 *
 * WHY A MODULE-LEVEL CACHE. A card grid renders 25 assets at once and each photo costs two
 * requests (list the documents, download the chosen one). Without a cache, paging back and
 * forth re-fetches every photo, and two components showing the same asset fetch it twice.
 * The cache makes it once per asset per page session.
 *
 * The blob URLs are deliberately NEVER revoked: a cache whose entries are revoked hands out
 * dead URLs, which is worse than holding them. They die with the document on navigation.
 * `null` is cached too — an asset with no photo must not be asked about again.
 */

const photoCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

/** Anything that should be treated as a picture, in priority order below. */
const isImage = (d: IAssetDocument) =>
  d.documentType === AssetDocumentTypeEnum.Photo ||
  (d.contentType ?? '').toLowerCase().startsWith('image/') ||
  /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(d.fileName ?? '');

/**
 * The asset's picture: the flagged primary if there is one, else the first Photo-type
 * document, else anything that is an image. Most uploads never tick "primary", so an asset
 * that simply HAS a picture still shows it.
 */
export const resolveAssetPhoto = (assetId: string): Promise<string | null> => {
  if (photoCache.has(assetId)) return Promise.resolve(photoCache.get(assetId)!);

  const existing = inFlight.get(assetId);
  if (existing) return existing;

  const request = (async (): Promise<string | null> => {
    try {
      const documents = await fetchAssetDocuments(assetId);
      const all = documents?.data ?? [];
      const chosen = all.find((d) => d.isPrimaryPhoto) ?? all.find(isImage);
      if (!chosen) return null;

      const response = await downloadAssetDocument(chosen.id);
      if (!response?.ok) return null;

      const blob = await response.blob();
      if (blob.size === 0) return null;

      return URL.createObjectURL(blob);
    } catch {
      // No photo is a normal state for an asset — never an error the user sees.
      return null;
    }
  })();

  inFlight.set(assetId, request);
  request.then((url) => {
    photoCache.set(assetId, url);
    inFlight.delete(assetId);
  });

  return request;
};

/**
 * The asset's photo URL, or null while loading / when there is none.
 *
 * `enabled` exists so a card grid can defer the fetch until the card scrolls into view —
 * photos are stored at original camera size, so fetching all of them up front would pull
 * far more than the visible rows need.
 */
export const useAssetPhoto = (
  assetId: string | undefined,
  enabled = true
): string | null => {
  const [url, setUrl] = useState<string | null>(() =>
    assetId ? (photoCache.get(assetId) ?? null) : null
  );

  useEffect(() => {
    if (!assetId || !enabled) return;

    const cached = photoCache.get(assetId);
    if (cached !== undefined) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    resolveAssetPhoto(assetId).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [assetId, enabled]);

  return url;
};
