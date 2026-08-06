'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Permission } from '@/enum/permissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';

/**
 * Every /system-test page sits behind ManageSystemTest — the same fence the backend
 * controller stacks on the whole section. Without it the page routes to /403 rather
 * than rendering controls whose every call would be refused.
 */
export default function SystemTestGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, can } = useUserPermissions();
  const allowed = can(Permission.ManageSystemTest);

  useEffect(() => {
    if (ready && !allowed) router.replace('/403');
  }, [ready, allowed, router]);

  if (!ready || !allowed) return null;
  return <>{children}</>;
}
