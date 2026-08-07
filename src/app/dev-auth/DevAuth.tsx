'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';

import Button from '@/components/UI/Button';
import { parseJwt } from '@/services/auth.service';
import { clearActiveCompanyId, clearAssetToken } from '@/services/assetToken';
import { appUrl, isDevAuthBypass } from '@/utils/constants';

const sanitizeToken = (raw: string): string =>
  raw.trim().replace(/^["']|["']$/g, '');

const DevAuth = () => {
  const searchParams = useSearchParams();
  const [tokenInput, setTokenInput] = useState('');
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');
  const [bypassActive, setBypassActive] = useState<boolean | null>(null);

  useEffect(() => {
    setBypassActive(isDevAuthBypass(window.location.hostname));
  }, []);

  const claims = useMemo(() => {
    const cleaned = sanitizeToken(tokenInput);
    if (!cleaned) return null;
    return parseJwt(cleaned);
  }, [tokenInput]);

  const isExpired = useMemo(() => {
    if (!claims?.exp) return false;
    return claims.exp * 1000 < Date.now();
  }, [claims]);

  /** The middleware hands over a basePath-absolute path; only the fallback needs prefixing. */
  const resolveRedirect = (): string => {
    const redirect = searchParams.get('redirect');
    if (redirect && redirect.startsWith('/')) return redirect;
    return appUrl('/dashboard');
  };

  const handleSave = () => {
    setError('');
    const cleaned = sanitizeToken(tokenInput);
    if (!cleaned) {
      setError('Paste an AuthToken JWT first.');
      return;
    }

    const decoded = parseJwt(cleaned);
    if (!decoded) {
      setError('Could not decode the token. Check that it is a valid JWT.');
      return;
    }

    Cookies.set('AuthToken', cleaned, { path: '/', sameSite: 'lax' });
    // A stale module token from a previous session would otherwise be used
    // until its first 401; AuthContext re-exchanges from the new hub token.
    clearAssetToken();

    const cleanedUser = userInput.trim();
    if (cleanedUser) {
      try {
        JSON.parse(cleanedUser);
        Cookies.set('user', cleanedUser, { path: '/', sameSite: 'lax' });
      } catch {
        setError('The user cookie value must be valid JSON.');
        return;
      }
    }

    window.location.replace(resolveRedirect());
  };

  const handleClear = () => {
    Cookies.remove('AuthToken', { path: '/' });
    Cookies.remove('user', { path: '/' });
    clearAssetToken();
    clearActiveCompanyId();
    setTokenInput('');
    setUserInput('');
    setError('');
  };

  if (bypassActive === null) {
    return null;
  }

  if (!bypassActive) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <p className="text-sm text-gray-500">
          Dev auth is only available on localhost in development.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-xl space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Localhost Dev Auth
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste an AuthToken from webdev (or another local module) to continue.
            The cookie is written on localhost and you are sent back to the page
            you tried to open.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">AuthToken</span>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder="eyJhbGciOi..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs text-gray-800 outline-none focus:border-primarycolor focus:ring-1 focus:ring-primarycolor"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">
            user cookie (optional)
          </span>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder='{"userId":1,"fullName":"..."}'
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs text-gray-800 outline-none focus:border-primarycolor focus:ring-1 focus:ring-primarycolor"
          />
        </label>

        {claims && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-1">
            <p>
              <span className="font-medium">username:</span>{' '}
              {String(claims.username ?? '—')}
            </p>
            <p>
              <span className="font-medium">userId / AppUserId:</span>{' '}
              {String(claims.userId ?? claims.AppUserId ?? '—')}
            </p>
            <p>
              <span className="font-medium">companyId:</span>{' '}
              {String(claims.companyId ?? '—')}
            </p>
            <p>
              <span className="font-medium">expires:</span>{' '}
              {claims.exp ? new Date(claims.exp * 1000).toLocaleString() : '—'}
            </p>
            {isExpired && (
              <p className="font-medium text-red-600">
                This token is already expired.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave}>Save &amp; continue</Button>
          <Button variant="outline" onClick={handleClear}>
            Clear cookies
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DevAuth;
