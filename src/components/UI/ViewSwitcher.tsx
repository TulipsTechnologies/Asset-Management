'use client';

import { useEffect, useState } from 'react';

/**
 * A segmented control for choosing how a page renders its data. Deliberately generic —
 * it knows nothing about assets — so any list page can offer its own set of views.
 *
 * Pass a storageKey to have the choice remembered. A view mode is a working preference,
 * not navigation state: someone who works in Card view all day should not be put back in
 * the table every time they come back from an asset's detail page.
 */

export interface IViewOption<T extends string> {
  value: T;
  label: string;
  /** Glyph from the icon font, without the `icon-` prefix. */
  iconName: string;
  /** Tooltip — say what the view is FOR, not what it is called. */
  title?: string;
}

interface IProps<T extends string> {
  options: IViewOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** localStorage key; omit to keep the choice for this mount only. */
  storageKey?: string;
  className?: string;
}

/**
 * Reads a remembered view once, on mount. Returns null when there is nothing valid
 * stored — including when localStorage is unavailable, which is why every access is
 * wrapped rather than assumed.
 */
export const readStoredView = <T extends string>(
  storageKey: string | undefined,
  allowed: readonly T[]
): T | null => {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : null;
  } catch {
    return null;
  }
};

const ViewSwitcher = <T extends string>({
  options,
  value,
  onChange,
  storageKey,
  className = '',
}: IProps<T>) => {
  /*
   * Rendered only after mount. The server has no localStorage, so painting the remembered
   * view on the first client pass would disagree with the server's HTML and hydrate wrong.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const select = (next: T) => {
    if (next === value) return;
    onChange(next);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // A full or blocked store costs the user nothing but the memory of the choice.
      }
    }
  };

  return (
    <div
      role="tablist"
      aria-label="View mode"
      className={`inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-0.5 ${className}`}
    >
      {options.map((option) => {
        const active = mounted && option.value === value;
        return (
          /*
           * Presentational wrapper so the tooltip can anchor to the button without sitting
           * inside the tablist as a child the role does not allow.
           */
          <span key={option.value} role="presentation" className="relative group">
            <button
              type="button"
              role="tab"
              aria-selected={active}
              /*
               * Icon-only to stay compact, so the label has to arrive on hover instead.
               * A rendered tooltip rather than the `title` attribute: the native one waits
               * about a second and cannot be styled, which is too slow to answer "what is
               * this icon" while the pointer is already moving.
               */
              aria-label={option.label}
              onClick={() => select(option.value)}
              className={`inline-flex items-center justify-center size-8 rounded-full transition-colors ${
                active
                  ? 'bg-white text-primarycolor shadow-sm'
                  : 'text-gray-500 hover:text-secondaryColor'
              }`}
            >
              <i className={`icon icon-${option.iconName} text-sm`}></i>
            </button>

            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-secondaryColor px-2.5 py-1.5 text-left opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
            >
              <span className="block text-[11px] font-semibold leading-tight text-white">
                {option.label}
              </span>
              {option.title && (
                <span className="block text-[10px] leading-tight text-white/70 mt-0.5">
                  {option.title}
                </span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export default ViewSwitcher;
