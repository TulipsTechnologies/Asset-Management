'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';
import {
  IPhotoImportResult,
  importPhotos,
  previewPhotoImport,
} from '@/services/dataExchange.service';

/** Mirrors AssetPhotoImportService.MaxUploadBytes / MaxPhotos on the backend. */
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_PHOTOS = 2000;

/**
 * Bulk photo attachment: a ZIP of images named after Asset Codes.
 *
 * Same two-step consent as the sheet importer, and for the same reason — the operator sees
 * every binding ("AST-0001.jpg → Reception Sofa") before a byte is written. Three properties
 * are load-bearing and easy to lose in a refactor:
 *
 *  1. The bytes are SNAPSHOTTED at check time and the confirm sends those same bytes.
 *  2. The confirm sends the server's ECHO of the replace flag (`result.replaceExistingPrimary`),
 *     never this component's checkbox state — so a failed re-check can never leave the flag
 *     and the plan disagreeing.
 *  3. Toggling the flag CLEARS the verdict before re-checking, so the confirm button can
 *     never sit next to a plan built under the other mode.
 */
const PhotoImportModal = ({
  isOpen,
  onClose,
  onImported,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [bytes, setBytes] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<IPhotoImportResult | null>(null);
  const [result, setResult] = useState<IPhotoImportResult | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const reset = () => {
    setFileName('');
    setBytes(null);
    setPreview(null);
    setResult(null);
    setReplaceExisting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const runPreview = async (blob: Blob, name: string, withReplace: boolean) => {
    setBusy(true);
    try {
      // The flag travels as an ARGUMENT, not read from state: setState is async, so reading
      // it here would send the value from before the click.
      const res = await previewPhotoImport(blob, name, withReplace);
      if (res?.data) {
        setPreview(res.data);
        setResult(null);
      } else {
        addToast.error(res?.message || 'The archive could not be checked.');
      }
    } catch {
      addToast.error('The archive could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (picked: File | null) => {
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.zip')) {
      addToast.error('Photos must be uploaded as a single .zip file.');
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      addToast.error('The archive is larger than 64MB — split it into several files.');
      return;
    }
    const snapshot = new Blob([await picked.arrayBuffer()]);
    setFileName(picked.name);
    setBytes(snapshot);
    setPreview(null);
    setResult(null);
    setReplaceExisting(false);
    await runPreview(snapshot, picked.name, false);
  };

  const confirm = async () => {
    if (!bytes || !preview) return;
    setBusy(true);
    try {
      const res = await importPhotos(bytes, fileName, preview.replaceExistingPrimary);
      if (res?.data) {
        setResult(res.data);
        setPreview(null);
        if (res.data.imported) {
          addToast.success(res.message || 'Photos attached.');
          onImported();
        } else {
          addToast.error(res.message || 'Nothing was attached.');
        }
      } else {
        addToast.error(res?.message || 'The photos could not be attached.');
      }
    } catch {
      addToast.error('An error occurred while attaching the photos.');
    } finally {
      setBusy(false);
    }
  };

  const shown = preview ?? result;
  const blocked = (shown?.problems.length ?? 0) > 0;

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => undefined : close} showCloseBtn={!busy} size="3xl">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-secondaryColor mb-1">Import Asset Photos</h2>
        <p className="text-xs text-gray-400 mb-4">
          Upload a .zip of images named after the asset codes they belong to — e.g.{' '}
          <span className="font-mono text-gray-500">AST-0001.jpg</span>. Folders inside the zip
          are fine. For several photos of one asset add{' '}
          <span className="font-mono text-gray-500">~</span> and anything after it:{' '}
          <span className="font-mono text-gray-500">AST-0001~rear.jpg</span>. Your archive is
          checked first — nothing is attached until you confirm.
        </p>

        {!result && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="w-full rounded-lg border-2 border-dashed border-gray-200 px-4 py-5 text-center hover:border-primarycolor/60"
          >
            <i className="icon icon-upload text-2xl text-gray-300" />
            <p className="text-sm text-gray-500 mt-2">
              {fileName
                ? `${fileName} — choose another file to start over`
                : 'Drag and drop a .zip here, or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              ZIP only, max 64MB, up to {MAX_PHOTOS.toLocaleString()} images (5MB each)
            </p>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />

        {busy && (
          <p className="mt-4 text-sm text-gray-500">
            {preview ? 'Attaching photos…' : 'Checking the archive…'} Leave this open until it
            finishes.
          </p>
        )}

        {shown && !busy && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-gray-500 tabular-nums">
              {shown.filesRead} image{shown.filesRead === 1 ? '' : 's'} found ·{' '}
              {preview ? `${shown.wouldAttach} will attach` : `${shown.attached} attached`} to{' '}
              {shown.assetsAffected} asset{shown.assetsAffected === 1 ? '' : 's'}
              {shown.issues.length > 0 && ` · ${shown.issues.length} excluded`}
            </p>

            {/* Anything in problems means NOTHING was written — never show a success box. */}
            {blocked &&
              shown.problems.map((problem, i) => (
                <p
                  key={i}
                  className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3"
                >
                  {problem}
                </p>
              ))}

            {preview && !blocked && (
              <label className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={replaceExisting}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setReplaceExisting(next);
                    // Clear the verdict FIRST: the confirm button must never sit beside a
                    // plan built under the other mode.
                    setPreview(null);
                    if (bytes) void runPreview(bytes, fileName, next);
                  }}
                />
                <span className="text-sm text-sky-900">
                  <span className="font-medium">Replace existing primary photos.</span>{' '}
                  <span className="text-xs text-sky-800/80">
                    By default an asset that already has a photo is left completely untouched.
                    Tick this to let the archive take over the main photo — the current one is
                    kept on the asset as an extra, never deleted.
                  </span>
                </span>
              </label>
            )}

            {shown.warnings.map((warning, i) => (
              <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                {warning}
              </p>
            ))}

            {shown.plan.length > 0 && (
              <details open className="rounded-lg border border-gray-200">
                <summary className="cursor-pointer px-4 py-2.5 text-sm text-secondaryColor">
                  <span className="font-semibold tabular-nums">{shown.plan.length}</span> photo
                  {shown.plan.length === 1 ? '' : 's'}{' '}
                  {preview ? 'will be attached' : 'attached'}
                  {shown.primariesReplaced > 0 && (
                    <span className="text-xs text-amber-700">
                      {' '}
                      — replacing the main photo on {shown.primariesReplaced} asset
                      {shown.primariesReplaced === 1 ? '' : 's'}
                    </span>
                  )}
                </summary>
                <div className="max-h-64 overflow-y-auto border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left sticky top-0">
                      <tr>
                        <th className="px-3 py-2 font-medium text-gray-600">File</th>
                        <th className="px-3 py-2 font-medium text-gray-600">Asset</th>
                        <th className="px-3 py-2 w-28 font-medium text-gray-600">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.plan.map((b, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-600">
                            {b.fileName}
                          </td>
                          <td className="px-3 py-1.5 text-gray-700">
                            <span className="font-medium">{b.assetCode}</span>{' '}
                            <span className="text-gray-500">{b.assetName}</span>
                          </td>
                          <td className="px-3 py-1.5 text-xs">
                            {b.isPrimary ? (
                              <span className="text-secondaryColor">
                                Main photo
                                {b.demotesExistingPrimary && (
                                  <span className="text-amber-700"> (replaces)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-gray-400">Extra</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {shown.issues.length > 0 && (
              <details className="rounded-lg border border-amber-100 bg-amber-50/50">
                <summary className="cursor-pointer px-4 py-2.5 text-sm text-amber-900">
                  <span className="font-semibold tabular-nums">{shown.issues.length}</span> file
                  {shown.issues.length === 1 ? '' : 's'} will not be attached{' '}
                  <span className="text-xs text-amber-700/70">(click to see why)</span>
                </summary>
                <div className="max-h-56 overflow-y-auto border-t border-amber-100 bg-white">
                  <table className="w-full text-xs">
                    <tbody>
                      {shown.issues.map((issue, i) => (
                        <tr key={i} className="border-t border-amber-50">
                          <td className="px-3 py-1.5 font-mono text-gray-600 align-top w-1/3">
                            {issue.fileName}
                          </td>
                          <td className="px-3 py-1.5 text-gray-700">{issue.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {preview && !blocked && preview.wouldAttach === 0 && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
                Nothing to attach — every image in the archive was excluded.
              </p>
            )}
            {result?.imported && (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                {result.attached} photo{result.attached === 1 ? '' : 's'} attached to{' '}
                {result.assetsAffected} asset{result.assetsAffected === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={close} disabled={busy}>
            {result?.imported ? 'Close' : 'Cancel'}
          </Button>
          {/* Recovery for a toggle whose re-check failed: the verdict was cleared on purpose,
              so offer the check again rather than a dead end. */}
          {!preview && !result && bytes && !busy && (
            <Button onClick={() => runPreview(bytes, fileName, replaceExisting)}>
              Check the archive
            </Button>
          )}
          {preview && !blocked && preview.wouldAttach > 0 && (
            <Button onClick={confirm} disabled={busy}>
              {busy
                ? 'Attaching…'
                : `Attach ${preview.wouldAttach} photo${preview.wouldAttach === 1 ? '' : 's'}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PhotoImportModal;
