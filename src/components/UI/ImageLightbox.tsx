'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * A photo at full size, over everything else.
 *
 * Portalled to <body> rather than rendered in place: the thumbnails that open it live inside
 * cards and table rows that clip their overflow and establish their own stacking contexts, so
 * an in-place overlay would be cropped by its own card.
 *
 * Closes on Escape and on a backdrop click, and restores the page's scroll on the way out.
 */
const ImageLightbox = ({
  src,
  alt,
  caption,
  onClose,
}: {
  /** Blob URL of the image. When null the lightbox renders nothing. */
  src: string | null;
  alt: string;
  /** Shown under the image — normally the asset code and name. */
  caption?: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (!src) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    // The page behind must not scroll while the overlay is up.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [src, onClose]);

  if (!src || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <i className="icon icon-close text-sm" />
      </button>

      {/* Stops a click on the image itself from closing, so it can be inspected. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
      />

      {caption && (
        <p className="mt-3 max-w-full truncate text-center text-sm text-white/80">
          {caption}
        </p>
      )}
    </div>,
    document.body
  );
};

export default ImageLightbox;
