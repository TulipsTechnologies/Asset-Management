'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  INavTarget,
  LAST_HUB_STORAGE_KEY,
  labelForPath,
  resolveBackTarget,
} from '@/utils/navigation';
import { popVisit, previousVisit } from '@/utils/navHistory';

/**
 * Back to the page you came from.
 *
 * It used to be back one step up the MENU, which is a different question and often a
 * different answer: reach an asset from a report and the menu says /assets, while the operator
 * is asking for the report. The recorded journey answers the question they are actually
 * asking, and the menu map stays as the fallback for when there is no journey to read — a
 * deep link, a fresh tab, or the first page of a session.
 *
 * Renders nothing only when BOTH are silent, which is the top of the menu with nowhere behind
 * it. That is why the hub pages stay clean while /system-test, a leaf, does not.
 *
 * It belongs to the PAGE, not the app header: once this module is mounted inside TulipsHRM the
 * host supplies the chrome and this module's header is gone, so a control living there would
 * vanish with it. In the toolbar it travels with the page.
 */
export default function BackButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Resolved after mount: both the journey and the remembered hub live in sessionStorage, and
  // reading either during render would hydrate to a different answer than the browser's.
  const [target, setTarget] = useState<INavTarget | null>(null);
  const [fromHistory, setFromHistory] = useState(false);

  useEffect(() => {
    const previous = previousVisit();
    if (previous) {
      setTarget({ url: previous, label: labelForPath(previous) });
      setFromHistory(true);
      return;
    }
    const lastHub =
      typeof window === 'undefined'
        ? null
        : sessionStorage.getItem(LAST_HUB_STORAGE_KEY);
    setTarget(resolveBackTarget(pathname ?? '', lastHub));
    setFromHistory(false);
  }, [pathname]);

  const goBack = useCallback(() => {
    if (!target) return;
    // Only a journey step consumes an entry. The hierarchy fallback is a jump sideways out of
    // the recorded path, and popping for it would drop a page the operator never visited.
    const href = fromHistory ? popVisit() : null;
    router.push(href ?? target.url);
  }, [fromHistory, router, target]);

  if (!target) return null;

  return (
    <button
      type="button"
      onClick={goBack}
      title={`Back to ${target.label}`}
      className={`inline-flex shrink-0 items-center gap-2 py-1.5 pr-2 text-sm font-medium text-secondaryColor transition-colors hover:text-primarycolor ${className}`}
    >
      <i className="icon icon-left text-[11px]" />
      {/* Just "Back" — the destination stays in the tooltip rather than making the
          control's width jump about with the length of the page name. */}
      <span>Back</span>
    </button>
  );
}
