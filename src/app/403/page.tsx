'use client';

import { useRouter } from 'next/navigation';

const ForbiddenPage = () => {
  const router = useRouter();

  return (
    <div className="flex h-full min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <i className="icon icon-lock text-[24px] text-red-500"></i>
        </div>
        <h1 className="text-xl font-semibold text-secondaryColor">
          Access denied
        </h1>
        <span className="mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
          403
        </span>
        <p className="mt-4 text-sm text-gray-500">
          You don&apos;t have permission to view this page. If you believe this
          is a mistake, contact your administrator.
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

export default ForbiddenPage;
