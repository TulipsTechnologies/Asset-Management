'use client';

import { useEffect, useRef, useState } from 'react';
import ImageLightbox from '@/components/UI/ImageLightbox';
import { useAssetPhoto } from './assetPhoto';

const SIZES = {
  sm: 'h-9 w-9 rounded-md',
  md: 'h-11 w-11 rounded-lg',
  lg: 'h-16 w-16 rounded-xl',
} as const;

const GLYPH_SIZE = {
  sm: 'text-[13px]',
  md: 'text-[17px]',
  lg: 'text-2xl',
} as const;

/**
 * An asset's picture wherever an asset is shown: its photo if it has one, the tinted glyph
 * if it does not, and a click-to-enlarge on the photo.
 *
 * LAZY BY DEFAULT. Photos are stored at original camera size with no thumbnail pipeline, so a
 * grid of 25 cards fetching every photo on mount would pull far more than the screen needs —
 * the walk-around view over venue Wi-Fi is exactly where that hurts. The fetch is therefore
 * deferred until the thumb scrolls into view, and the result is cached per asset so scrolling
 * back is free. Pass `eager` for the single large thumb on a detail page, where the photo IS
 * the point and there is only one.
 */
const AssetPhotoThumb = ({
  assetId,
  assetCode,
  assetName,
  size = 'md',
  eager = false,
  className = '',
}: {
  assetId: string;
  assetCode?: string;
  assetName?: string;
  size?: keyof typeof SIZES;
  eager?: boolean;
  className?: string;
}) => {
  const holder = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (visible || !holder.current) return;
    // A generous margin so the photo is usually there by the time the card is read.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '200px' }
    );
    observer.observe(holder.current);
    return () => observer.disconnect();
  }, [visible]);

  const photo = useAssetPhoto(assetId, visible);
  const label = [assetCode, assetName].filter(Boolean).join(' · ');

  return (
    <>
      <div ref={holder} className={`shrink-0 ${className}`}>
        {photo ? (
          <button
            type="button"
            // The thumb usually sits inside a card whose own click opens the asset — this
            // must enlarge the photo instead of navigating.
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setZoomed(true);
            }}
            title={`View photo${label ? ` — ${label}` : ''}`}
            className={`group relative block overflow-hidden bg-gray-100 ${SIZES[size]}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={label || 'Asset photo'}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition-colors group-hover:bg-black/35 group-hover:text-white">
              <i className="icon icon-expand text-[11px]" />
            </span>
          </button>
        ) : (
          <span
            className={`flex items-center justify-center bg-blue-50 ${SIZES[size]}`}
            title={label || undefined}
          >
            <i className={`icon icon-briefcase text-blue-600 ${GLYPH_SIZE[size]}`} />
          </span>
        )}
      </div>

      {zoomed && (
        <ImageLightbox
          src={photo}
          alt={label || 'Asset photo'}
          caption={label || undefined}
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  );
};

export default AssetPhotoThumb;
