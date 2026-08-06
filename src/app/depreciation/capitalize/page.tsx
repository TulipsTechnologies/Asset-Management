'use client';

import { Suspense } from 'react';
import CapitalizeForm from '../_components/CapitalizeForm';

/**
 * Capitalization moved out of a modal and onto a page.
 *
 * The form carries three related but separate decisions — what the asset costs, how it will
 * be measured, and what it arrived already carrying — and a dialog forced all of them into a
 * scrolling box with no room to show how they combine. On a page the arithmetic can sit
 * beside the inputs and update as they change.
 *
 * One route serves both modes: no query string capitalizes a new asset, `?bookId=` edits an
 * existing book's basis.
 */
export default function CapitalizeAssetPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 mt-10 text-center text-sm text-gray-400">Loading…</div>
      }
    >
      <CapitalizeForm />
    </Suspense>
  );
}
