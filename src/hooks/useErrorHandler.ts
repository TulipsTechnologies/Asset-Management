'use client';
import { useToast } from '@/components/Providers/ToastProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export function useErrorHandler() {
  const router = useRouter();
  const { addToast } = useToast();

  const handleError = useCallback(
    (error: any) => {
      switch (error.statusCode) {
        case 401:
          // Session expired/invalid. httpService already cleared the auth cookie;
          // send the user to sign-in so they aren't stranded on a broken page.
          addToast.error('Your session has expired. Please sign in again.');
          if (typeof window !== 'undefined')
            router.push('/signin?redirect=' + window.location.href);
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
