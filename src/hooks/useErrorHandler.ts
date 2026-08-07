'use client';
import { useToast } from '@/components/Providers/ToastProvider';
import { getBaseUrl } from '@/utils/constants';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useErrorHandler() {
  const router = useRouter();
  const { addToast } = useToast();

  const handleError = useCallback(
    (error: any) => {
      switch (error.statusCode) {
        case 401:
          // Session expired/invalid. httpService already cleared the module token
          // after its retry failed; send the user back to the hub sign-in so they
          // aren't stranded on a broken page.
          addToast.error('Your session has expired. Please sign in again.');
          if (typeof window !== 'undefined') {
            window.location.href = `${getBaseUrl()}${
              process.env.NEXT_PUBLIC_LOGOUT_URL
            }?redirect=${encodeURIComponent(window.location.href)}`;
          }
          break;
        case 403:
          router.push('/403');
          break;
        default:
          addToast.error(error.message);
          break;
      }
      return { statusCode: error.statusCode, message: error.message };
    },
    [router],
  );

  return handleError;
}
