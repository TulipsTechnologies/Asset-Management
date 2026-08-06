'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  INavTarget,
  LAST_HUB_STORAGE_KEY,
  resolveBackTarget,
} from '@/utils/navigation';

/**
 * One step back up the menu that led here — a detail page to its list, a list to the hub
 * that offered it. Renders nothing at the top level, where the sidebar already reaches.
 *
 * It belongs to the PAGE, not the app header: once this module is mounted inside TulipsHRM
 * the host supplies the chrome and this module's header is gone, so a control living there
 * would vanish with it. In the toolbar it travels with the page.
 */
export default function BackButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Resolved after mount: the remembered hub lives in sessionStorage, and reading it during
  // render would hydrate to a different answer than the browser's.
  const [target, setTarget] = useState<INavTarget | null>(null);
  useEffect(() => {
    const lastHub =
      typeof window === 'undefined'
        ? null
        : sessionStorage.getItem(LAST_HUB_STORAGE_KEY);
    setTarget(resolveBackTarget(pathname ?? '', lastHub));
  }, [pathname]);

  if (!target) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(target.url)}
      title={`Back to ${target.label}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 py-1.5 pl-2.5 pr-3.5 text-sm text-gray-600 transition-colors hover:border-primarycolor/40 hover:text-primarycolor ${className}`}
    >
      <i className="icon icon-left text-[10px]" />
      <span className="max-w-[160px] truncate">{target.label}</span>
    </button>
  );
}
