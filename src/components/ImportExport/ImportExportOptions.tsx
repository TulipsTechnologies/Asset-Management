'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import Modal from '@/components/UI/Modal';
import {
  downloadExport,
  downloadImportTemplate,
  importFile,
  previewImport,
  IImportResult,
  TExchangeEntity,
} from '@/services/dataExchange.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const saveResponseFile = async (response: Response, fallbackName: string) => {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const match = /filename="?([^";]+)"?/.exec(
    response.headers.get('content-disposition') ?? ''
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = match?.[1] ?? fallbackName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const GROUP_LABELS: Record<string, { title: string; note: string }> = {
  categories: {
    title: 'categories will be created',
    note: 'Named after their code — rename them under Settings after the import.',
  },
  locations: {
    title: 'locations will be created',
    note: 'Locations describe places. If any of these are people, the assets they hold should be recorded with Assignments instead — you can edit or remove locations under Settings.',
  },
  suppliers: {
    title: 'suppliers will be created',
    note: 'Created as General Supplier vendors with only a name — add contact details under Settings.',
  },
};

/**
 * Options → Export / Import, now as a two-step flow: CHECK first, import second.
 *
 * The check runs the server's entire validation with zero writes and comes back with
 * every assumption the import would make — side entities it would create, Bikram Sambat
 * dates it would convert, codes it would generate. The operator reviews that instead of
 * discovering it in a wall of errors afterwards, which for real onboarding files was the
 * single biggest implementation pain.
 *
 * The file is snapshotted to bytes the moment it is checked, and the confirm sends those
 * same bytes: what was previewed is what imports, even if the file changes on disk in
 * between.
 */
const ImportExportOptions = ({
  entity,
  entityLabel,
  onImported,
}: {
  entity: TExchangeEntity;
  entityLabel: string;
  onImported: () => void;
}) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [bytes, setBytes] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<IImportResult | null>(null);
  const [result, setResult] = useState<IImportResult | null>(null);
  /** True when the shown problems came from a CONFIRM that failed after a clean check —
   * the data drifted, and the right next step is re-checking, not editing the file. */
  const [drifted, setDrifted] = useState(false);

  const download = async (kind: 'template' | 'export') => {
    try {
      const response =
        kind === 'template'
          ? await downloadImportTemplate(entity)
          : await downloadExport(entity);
      await saveResponseFile(response, `${entity}-${kind}.xlsx`);
    } catch {
      addToast.error(`Could not download the ${kind}.`);
    }
  };

  const pickFile = async (picked: File | null) => {
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.xlsx')) {
      addToast.error('Only .xlsx files are supported.');
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      addToast.error('The file is larger than 10MB — split it into smaller files.');
      return;
    }
    // Snapshot NOW. A File object is a live reference the OS can change under us;
    // these bytes are what gets checked and, if confirmed, imported.
    const snapshot = new Blob([await picked.arrayBuffer()]);
    setFileName(picked.name);
    setBytes(snapshot);
    setPreview(null);
    setResult(null);
    setDrifted(false);
    await runPreview(snapshot, picked.name);
  };

  const runPreview = async (blob: Blob, name: string) => {
    setBusy(true);
    setDrifted(false);
    try {
      const res = await previewImport(entity, blob, name);
      if (res?.data) {
        setPreview(res.data);
        setResult(null);
      } else {
        addToast.error(res?.message || 'The file could not be checked.');
      }
    } catch {
      addToast.error('The file could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!bytes) return;
    setBusy(true);
    try {
      const res = await importFile(entity, bytes, fileName);
      if (res?.data) {
        if (res.data.imported) {
          setResult(res.data);
          setPreview(null);
          addToast.success(res.message || 'Import complete.');
          onImported();
        } else {
          /*
           * A clean check followed by a failing commit means the DATA changed in the
           * window — a colleague created the same vendor, took the same code. The file
           * is not broken; a fresh check will very likely clear it. Keep the bytes and
           * offer exactly that.
           */
          setPreview(res.data);
          setDrifted(true);
        }
      } else {
        addToast.error(res?.message || 'The import failed.');
      }
    } catch {
      addToast.error('An error occurred during the import.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setImportOpen(false);
    setFileName('');
    setBytes(null);
    setPreview(null);
    setResult(null);
    setDrifted(false);
  };

  const hasProblems = (preview?.problems.length ?? 0) > 0;
  const assumptions =
    (preview?.plannedEntities.length ?? 0) > 0 ||
    (preview?.dateConversions.length ?? 0) > 0 ||
    (preview?.warnings.length ?? 0) > 0 ||
    (preview?.wouldAutoGenerateCodes ?? 0) > 0;

  return (
    <>
      <Dropdown
        buttonChildren={
          // A div, not <Button>: Dropdown wraps this in its own <button>, and
          // nested buttons are invalid HTML (hydration error). Styled like the
          // sibling Manage Columns control.
          <div className="text-sm flex items-center gap-x-2 font-medium whitespace-nowrap">
            <i className="icon icon-dials text-gray-500 text-base" />
            <span>Options</span>
          </div>
        }
      >
        <CustomMenuItem
          label="Export"
          onClick={() => download('export')}
          icon={<i className="icon icon-export text-sm" />}
          border
          className="!py-2"
        />
        <CustomMenuItem
          label="Import"
          onClick={() => setImportOpen(true)}
          icon={<i className="icon icon-import text-sm" />}
          className="!py-2"
        />
      </Dropdown>

      <Modal isOpen={importOpen} onClose={busy ? () => undefined : close} showCloseBtn={!busy} size="3xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Import {entityLabel}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Your file is checked first — nothing is written until you confirm what the
            import will do. Rows that already exist are skipped, and a file with any
            problem imports nothing, so re-uploading is always safe.
          </p>

          {!preview && !result && (
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 mb-4">
              <div className="flex items-center gap-3">
                <i className="icon icon-file text-lg text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-secondaryColor">
                    Sample Template
                  </p>
                  <p className="text-xs text-gray-400">
                    Download to see the required columns and format
                  </p>
                </div>
              </div>
              <Button onClick={() => download('template')}>
                <i className="icon icon-download text-xs" />
                <span>Download</span>
              </Button>
            </div>
          )}

          {!result && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="w-full rounded-lg border-2 border-dashed border-gray-200 px-4 py-5 text-center hover:border-primarycolor/60"
            >
              <i className="icon icon-upload text-2xl text-gray-300" />
              <p className="text-sm text-gray-500 mt-2">
                {fileName
                  ? `${fileName} — choose another file to start over`
                  : 'Drag and drop a file here, or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                XLSX only, max 10MB, up to 2,000 rows
              </p>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              pickFile(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />

          {busy && !preview && !result && (
            <p className="text-sm text-gray-500 text-center py-3">Checking the file…</p>
          )}

          {/* ---------------- the check's verdict ---------------- */}
          {preview && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-500 tabular-nums">
                {preview.rowsRead} row{preview.rowsRead === 1 ? '' : 's'} checked ·{' '}
                {preview.wouldCreate} will import
                {preview.skippedExisting > 0 && ` · ${preview.skippedExisting} already exist`}
              </p>

              {drifted && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-800">
                    The data changed while importing — nothing was written.
                  </p>
                  <p className="text-xs text-amber-700/80 mt-0.5">
                    Someone may have created the same record in the meantime. Check the
                    file again — the conflict usually resolves itself.
                  </p>
                </div>
              )}

              {hasProblems ? (
                <>
                  <p className="text-sm font-medium text-red-700">
                    {preview.problems.length} problem
                    {preview.problems.length === 1 ? '' : 's'} block the import — nothing
                    has been written:
                  </p>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-red-100">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50 text-left">
                        <tr>
                          <th className="px-3 py-2 w-16 font-medium text-red-800">Row</th>
                          <th className="px-3 py-2 font-medium text-red-800">Problem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.problems.map((p, i) => (
                          <tr key={i} className="border-t border-red-50">
                            <td className="px-3 py-2 text-gray-500 tabular-nums">{p.row}</td>
                            <td className="px-3 py-2 text-gray-700">{p.problem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  {assumptions && (
                    <p className="text-sm font-medium text-secondaryColor">
                      The import will make these assumptions — review before confirming:
                    </p>
                  )}

                  {preview.plannedEntities.map((group) => {
                    const meta = GROUP_LABELS[group.kind] ?? {
                      title: `${group.kind} will be created`,
                      note: '',
                    };
                    return (
                      <details
                        key={group.kind}
                        className="rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-2.5"
                      >
                        <summary className="cursor-pointer text-sm text-sky-900">
                          <span className="font-semibold tabular-nums">
                            {group.names.length}
                          </span>{' '}
                          {meta.title}{' '}
                          <span className="text-xs text-sky-700/70">
                            (used by {group.rowCount} row{group.rowCount === 1 ? '' : 's'} — click to see all)
                          </span>
                        </summary>
                        {meta.note && (
                          <p className="text-xs text-sky-800/80 mt-1.5">{meta.note}</p>
                        )}
                        <p className="text-xs text-sky-900/90 mt-1.5 leading-relaxed">
                          {group.names.join(' · ')}
                        </p>
                      </details>
                    );
                  })}

                  {preview.dateConversions.length > 0 && (
                    <details className="rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-2.5">
                      <summary className="cursor-pointer text-sm text-violet-900">
                        <span className="font-semibold tabular-nums">
                          {preview.dateConversions.length}
                        </span>{' '}
                        date{preview.dateConversions.length === 1 ? '' : 's'} will be read
                        as Bikram Sambat and converted to AD{' '}
                        <span className="text-xs text-violet-700/70">(click to audit each)</span>
                      </summary>
                      <div className="max-h-44 overflow-y-auto mt-2 rounded border border-violet-100 bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-violet-50 text-left">
                            <tr>
                              <th className="px-2 py-1.5 font-medium text-violet-900">Row</th>
                              <th className="px-2 py-1.5 font-medium text-violet-900">Column</th>
                              <th className="px-2 py-1.5 font-medium text-violet-900">In the file (BS)</th>
                              <th className="px-2 py-1.5 font-medium text-violet-900">Will import as (AD)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {preview.dateConversions.map((c, i) => (
                              <tr key={i} className="border-t border-violet-50">
                                <td className="px-2 py-1.5 text-gray-500 tabular-nums">{c.row}</td>
                                <td className="px-2 py-1.5 text-gray-700">{c.column}</td>
                                <td className="px-2 py-1.5 text-gray-700 tabular-nums">{c.from}</td>
                                <td className="px-2 py-1.5 text-gray-700 tabular-nums">{c.to}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}

                  {preview.wouldAutoGenerateCodes > 0 && (
                    <p className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-700">
                      <span className="font-semibold tabular-nums">
                        {preview.wouldAutoGenerateCodes}
                      </span>{' '}
                      row{preview.wouldAutoGenerateCodes === 1 ? '' : 's'} have no code and
                      will receive generated ones.
                    </p>
                  )}

                  {/* Server strings verbatim — the single source of truth for wording. */}
                  {preview.warnings.map((warning, i) => (
                    <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      {warning}
                    </p>
                  ))}

                  {!assumptions && preview.wouldCreate > 0 && (
                    <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                      The file checks out — no assumptions needed.
                    </p>
                  )}
                  {preview.wouldCreate === 0 && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
                      Nothing new to import — every row already exists.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---------------- after a real import ---------------- */}
          {result?.imported && (
            <div className="mt-4">
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                Imported {result.created} row{result.created === 1 ? '' : 's'}
                {result.skippedExisting > 0 &&
                  `; ${result.skippedExisting} already existed and were skipped`}
                .
              </p>
              {result.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.warnings.map((warning, i) => (
                    <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={close} disabled={busy}>
              {result?.imported ? 'Close' : 'Cancel'}
            </Button>
            {preview && drifted && (
              <Button onClick={() => bytes && runPreview(bytes, fileName)} disabled={busy}>
                {busy ? 'Checking…' : 'Check again'}
              </Button>
            )}
            {preview && !hasProblems && !drifted && preview.wouldCreate > 0 && (
              <Button onClick={confirm} disabled={busy}>
                {busy
                  ? 'Importing…'
                  : `Import ${preview.wouldCreate} row${preview.wouldCreate === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ImportExportOptions;
