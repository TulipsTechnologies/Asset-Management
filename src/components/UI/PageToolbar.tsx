'use client';

import { ReactNode } from 'react';
import BackButton from '@/components/UI/BackButton';

/**
 * The action row that sits at the top of a detail page: the way back on the
 * left, the page's own actions on the right, a hairline rule beneath.
 *
 * Detail pages used to bury Back among the actions on the right, where it read
 * as one more thing to do to the record rather than the way out of it.
 *
 * Actions belong in <Button variant="toolbar"> (or `toolbarDanger` for the
 * destructive one) so every page's cluster looks the same.
 */
export default function PageToolbar({
  actions,
  back,
  className = '',
}: {
  actions?: ReactNode;
  /** Overrides the resolved Back control — for a destination the hub map cannot infer. */
  back?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-gray-100 pb-3 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {back ?? <BackButton />}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
