'use client';
import { store } from '@/store';
import { ReactNode } from 'react';
import { Provider } from 'react-redux';
import dynamic from 'next/dynamic';
import SiteLayout from '../Layout/RootLayout';

const ToastProvider = dynamic(
  () => import('./ToastProvider').then((mod) => mod.ToastProvider),
  {
    ssr: false,
  }
);
const AuthProvider = dynamic(
  () => import('@/contexts/AuthContext').then((mod) => mod.AuthProvider),
  {
    ssr: false,
  }
);

const RootProvider = ({ children }: { children: ReactNode }) => {
  return (
    <Provider store={store}>
      <ToastProvider>
        <AuthProvider>
          <SiteLayout>{children}</SiteLayout>
        </AuthProvider>
      </ToastProvider>
    </Provider>
  );
};

export default RootProvider;
