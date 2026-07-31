'use client';

import { ReactNode, useRef } from 'react';
import { getBaseUrl } from '@/utils/constants';

/**
 * Resolve a file path from the API against the API base URL.
 *
 * The backend no longer serves uploads from a static /Files path: DTO
 * photoPath/filePath fields now carry short-lived HMAC-signed URLs of the form
 * `/api/Files/content?path=...&exp=...&sig=...` (10-minute expiry). This helper
 * just prefixes the API origin; the signature in the URL is the access grant,
 * so <img> tags need no Authorization header.
 */
export const fileUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${getBaseUrl()}/${path.replace(/^\//, '')}`;
};

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

/**
 * Employee-profile style page header: rounded photo (or fallback) on the
 * left, bold title with badges, gray subtitle, chip row, and an optional
 * right-side info slot. Optionally exposes a camera overlay to change the
 * photo.
 */
const ProfileHeader = ({
  photoUrl,
  fallback,
  title,
  titleBadges,
  subtitle,
  chips,
  rightSlot,
  actions,
  onPhotoSelected,
  photoUploading = false,
}: {
  photoUrl?: string | null;
  /** Rendered inside the avatar circle when there is no photo. */
  fallback: ReactNode;
  title: string;
  titleBadges?: ReactNode;
  subtitle?: string | null;
  chips?: ReactNode;
  /** Right-side info slot, e.g. current vehicle. */
  rightSlot?: ReactNode;
  actions?: ReactNode;
  /** When provided, a small camera overlay lets the user change the photo. */
  onPhotoSelected?: (file: File) => void;
  photoUploading?: boolean;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 mb-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative shrink-0">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={title}
              className="size-16 rounded-full object-cover object-center border border-gray-100"
            />
          ) : (
            <div className="size-16 rounded-full bg-primarycolor text-white flex items-center justify-center text-xl font-bold">
              {fallback}
            </div>
          )}
          {onPhotoSelected && (
            <>
              <button
                type="button"
                aria-label="Change photo"
                disabled={photoUploading}
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-primarycolor"
              >
                <i
                  className={`icon ${
                    photoUploading ? 'icon-hourglass' : 'icon-edit'
                  } text-[10px]`}
                ></i>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPhotoSelected(file);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 basis-52">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-secondaryColor break-words">
              {title}
            </h1>
            {titleBadges}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          )}
          {chips && (
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {chips}
            </div>
          )}
        </div>

        {rightSlot && (
          <div className="hidden md:block text-right shrink-0 border-l border-gray-100 pl-4">
            {rightSlot}
          </div>
        )}

        {actions && (
          <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
