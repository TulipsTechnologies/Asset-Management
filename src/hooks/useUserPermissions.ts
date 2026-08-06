'use client';

import { useCallback, useEffect, useState } from 'react';
import cookies from 'js-cookie';
import { hasPermission, Permission } from '@/enum/permissions';
import { fetchUserPermissionsList } from '@/utils/helpers';

/**
 * The caller's permission ids, decoded from the JWT after mount. `ready` stays false for
 * the first render — cookies are a browser fact, and reading them during render would
 * hydrate to a different answer than the server produced.
 */
export function useUserPermissions() {
  const [permissions, setPermissions] = useState<number[] | null>(null);

  useEffect(() => {
    setPermissions(fetchUserPermissionsList(cookies.get('AuthToken') ?? ''));
  }, []);

  const can = useCallback(
    (...required: Permission[]) =>
      permissions != null && hasPermission(permissions, ...required),
    [permissions]
  );

  return { permissions, ready: permissions != null, can };
}
