'use client';

import { useEffect, useState } from 'react';
import { fetchVisualFileObjectUrl } from '@/services/visualRegression.service';

/**
 * An image served by the authenticated visual files endpoint (§12.1). A bare
 * `<img src="/api/VisualRegression/files/…">` would arrive with no Authorization
 * header and be refused, so the PNG is fetched through the normal service pipeline,
 * held as an object URL, and revoked the moment the fileId changes or the component
 * unmounts — a review session pages through many multi-megabyte captures and each
 * un-revoked URL pins its decoded bitmap in memory.
 */
export default function VisualImage({
  fileId,
  alt,
  className = '',
}: {
  /** Null renders the "no image" placeholder (first runs have no baseline/diff). */
  fileId?: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!fileId) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    fetchVisualFileObjectUrl(fileId)
      .then((created) => {
        if (cancelled) {
          // The modal moved on before the fetch landed — release immediately.
          window.URL.revokeObjectURL(created);
          return;
        }
        objectUrl = created;
        setUrl(created);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (!fileId)
    return (
      <div
        className={`flex items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400 ${className}`}
      >
        No image
      </div>
    );

  if (failed)
    return (
      <div
        className={`flex items-center justify-center rounded border border-red-200 bg-red-50 px-2 text-center text-xs text-red-600 ${className}`}
      >
        Could not load the image
      </div>
    );

  if (!url)
    return (
      <div
        className={`flex animate-pulse items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs text-gray-400 ${className}`}
      >
        Loading…
      </div>
    );

  return (
    // Full-resolution inspection: the capture is wider than any modal column, so a
    // click opens the blob in its own tab at 1:1.
    <a href={url} target="_blank" rel="noreferrer" title="Open full size">
      {/* eslint-disable-next-line @next/next/no-img-element -- object URLs cannot go through next/image */}
      <img src={url} alt={alt} className={`rounded border border-gray-200 ${className}`} />
    </a>
  );
}
