'use client';

import BackButton from '@/components/UI/BackButton';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import {
  fetchResetPreview,
  IResetPreview,
  resetCompanyData,
  seedDemoData,
} from '@/services/masterData.service';

/** "AssetCategory" → "Asset Category", so counts read like the screens they came from. */
const humanize = (name: string) =>
  name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');

const MasterDataResetPage = () => {
  const { addToast } = useToast();

  const [preview, setPreview] = useState<IResetPreview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [typed, setTyped] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchResetPreview();
      if (res?.success && res.data) {
        setPreview(res.data);
        setLoadError('');
      } else {
        // Never fall through to the "already empty" branch — a refusal is not an
        // empty register, and confusing the two would be alarming in both directions.
        setPreview(null);
        setLoadError(res?.message || 'Could not load the reset preview.');
      }
    } catch {
      setPreview(null);
      setLoadError('Could not reach the server to load the reset preview.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = Object.entries(preview?.counts ?? {}).sort((a, b) => b[1] - a[1]);
  const totalRows = rows.reduce((sum, [, count]) => sum + count, 0);
  const armed =
    !!preview?.canReset &&
    typed.trim() === preview.confirmationPhrase &&
    totalRows > 0;

  const runReset = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await resetCompanyData(typed.trim());
      if (res?.success) {
        addToast.success(res.message || 'Company data reset');
        setTyped('');
        setConfirmOpen(false);
        load();
      } else {
        addToast.error(res?.message || 'The reset could not be completed');
        setConfirmOpen(false);
        load();
      }
    } catch {
      addToast.error('An error occurred during the reset');
    } finally {
      setBusy(false);
    }
  };

  const runSeed = async () => {
    setBusy(true);
    try {
      const res = await seedDemoData();
      if (res?.success) {
        addToast.success(res.message || 'Demo data loaded');
        (res.data?.skipped ?? []).forEach((note) => addToast.info(note, 12000));
        load();
      } else {
        addToast.error(res?.message || 'Demo data could not be loaded');
      }
    } catch {
      addToast.error('An error occurred while loading demo data');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl">
      <BackButton className="mb-3" />
      <h1 className="text-lg font-semibold text-secondaryColor">Master Data Reset</h1>
      <p className="text-xs text-gray-500 mt-0.5">
        Clear a pilot or demo register so the real one starts clean, or load a demo set
        into an empty company.
      </p>

      {/* ---------------------------------------------------------- demo data */}
      <section className="mt-7 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-secondaryColor">Load demo data</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Creates a small representative register — five categories, two locations, two
          vendors, three employees and seven assets — through the same validation as
          hand entry. Only runs on a company with no assets.
        </p>
        <Button onClick={runSeed} disabled={busy || loading} className="mt-4">
          <i className="icon icon-plus text-xs" />
          <span>Load demo data</span>
        </Button>
      </section>

      {/* -------------------------------------------------------------- reset */}
      <section className="mt-6 rounded-xl border border-red-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-red-700">
          Reset this company&apos;s asset data
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Permanently deletes every asset and everything attached to it — assignments,
          transfers, returns, verification campaigns, maintenance, disposals,
          depreciation books — plus asset categories, locations and vendors.{' '}
          <span className="font-medium text-secondaryColor">This cannot be undone.</span>
          <br />
          Only Asset Management data is touched.{' '}
          <span className="font-medium text-secondaryColor">Employees are kept</span> —
          they belong to TulipsHRM, and this module only borrows them as custodians. Your
          users, permissions, fiscal calendar, asset code format and capitalization policy
          are kept too.
        </p>

        {loading ? (
          <p className="text-sm text-gray-400 mt-4">Loading…</p>
        ) : loadError ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {loadError}
          </p>
        ) : preview?.blocker ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {preview.blocker}
          </p>
        ) : totalRows === 0 ? (
          <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            There is nothing to delete — this company&apos;s register is already empty.
          </p>
        ) : (
          <>
            <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-600">Record type</th>
                    <th className="px-3 py-2 w-28 font-medium text-gray-600">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([entity, count]) => (
                    <tr key={entity} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-gray-700">{humanize(entity)}</td>
                      <td className="px-3 py-2 text-gray-500">{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Type <span className="font-mono font-medium text-secondaryColor">
                {preview?.confirmationPhrase}
              </span>{' '}
              to confirm you mean to delete {totalRows.toLocaleString()} record
              {totalRows === 1 ? '' : 's'}.
            </p>
            <div className="mt-2 max-w-sm">
              <Input
                label="Company name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={preview?.confirmationPhrase}
              />
            </div>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!armed || busy}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <i className="icon icon-trash text-xs" />
              <span>Reset company data</span>
            </button>
          </>
        )}
      </section>

      <Modal
        isOpen={confirmOpen}
        onClose={busy ? () => undefined : () => setConfirmOpen(false)}
        showCloseBtn={!busy}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-red-700">
            Delete {totalRows.toLocaleString()} record
            {totalRows === 1 ? '' : 's'}?
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Every asset in <span className="font-medium">{preview?.companyName}</span> and
            its whole history will be permanently deleted. This cannot be undone and there
            is no backup taken by this action. Employees and other modules&apos; data are
            not touched.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={runReset} disabled={busy}>
              {busy ? 'Deleting…' : 'Yes, delete everything'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MasterDataResetPage;
