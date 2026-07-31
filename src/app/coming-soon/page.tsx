'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const ComingSoonCard = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feature = searchParams.get('feature') || 'This feature';

  return (
    <div className="flex h-full min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
          <i className="icon icon-hourglass text-[24px] text-amber-500"></i>
        </div>
        <h1 className="text-xl font-semibold text-secondaryColor">{feature}</h1>
        <span className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
          Phase 2
        </span>
        <p className="mt-4 text-sm text-gray-500">
          This module is planned for Phase 2 and will be available in an
          upcoming release.
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primarycolor px-5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <i className="icon icon-left text-[10px]"></i>
          Back
        </button>
      </div>
    </div>
  );
};

const ComingSoonPage = () => (
  <Suspense fallback={null}>
    <ComingSoonCard />
  </Suspense>
);

export default ComingSoonPage;
