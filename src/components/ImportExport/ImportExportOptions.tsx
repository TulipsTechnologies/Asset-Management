'use client';

import { useRef, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import Modal from '@/components/UI/Modal';
import PhotoImportModal from './PhotoImportModal';
import {
  downloadExport,
  downloadImportTemplate,
  importFile,
  previewImport,
  fetchImportProgress,
  IAssignedCode,
  ICellOverride,
  IImportProgress,
  IImportResult,
  TExchangeEntity,
} from '@/services/dataExchange.service';

// Mirrors DataExchangeService.MaxUploadBytes / MaxRows on the backend — the server refuses
// beyond these, so this check exists only to say so before the upload spends the bandwidth.
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_ROWS = 6000;

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

/**
 * CSV, not xlsx: this file exists to be opened and its Asset Code column pasted back
 * into the sheet the operator already has, and a CSV needs no library to produce.
 * Excel-safe quoting — an asset name may legitimately contain a comma or a quote.
 */
const saveAssignedCodes = (codes: IAssignedCode[], sourceName: string) => {
  const quote = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const csv = [
    ['Excel Row', 'Asset Code', 'Asset Name'].map(quote).join(','),
    ...codes.map((c) => [c.row, c.assetCode, c.assetName].map(quote).join(',')),
  ].join('\r\n');

  // The BOM keeps Excel from mangling non-ASCII names on open.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${sourceName.replace(/\.[^.]+$/, '')}-assigned-codes.csv`;
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
  /** Bulk photo attachment lives on the same Options menu, assets only — it is the only
   *  entity with anywhere to put a photo. */
  const [photoOpen, setPhotoOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [bytes, setBytes] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IImportProgress | null>(null);
  const [preview, setPreview] = useState<IImportResult | null>(null);
  const [result, setResult] = useState<IImportResult | null>(null);
  /** True when the shown problems came from a CONFIRM that failed after a clean check —
   * the data drifted, and the right next step is re-checking, not editing the file. */
  const [drifted, setDrifted] = useState(false);
  /** Inline corrections keyed "row|column". They ride BOTH the re-check and the import,
   * so what is approved is always the same (file + fixes) pair. */
  const [fixes, setFixes] = useState<Record<string, string>>({});
  /**
   * The update-mode checkbox (assets only). Toggling it clears the verdict and re-checks,
   * so Confirm can never sit next to a stale plan; and the CONFIRM sends the server's echo
   * (preview.updateExisting), never this state — previewed == imported by construction.
   */
  const [updateExisting, setUpdateExisting] = useState(false);

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
      addToast.error('The file is larger than 64MB — split it into smaller files.');
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
    setFixes({});
    // A ticked box from the previous file must not silently ride this one's first check.
    setUpdateExisting(false);
    await runPreview(snapshot, picked.name, undefined, false);
  };

  const toOverrides = (source: Record<string, string>): ICellOverride[] =>
    Object.entries(source).map(([key, value]) => {
      const [row, ...column] = key.split('|');
      return { row: Number(row), column: column.join('|'), value };
    });

  /**
   * Polls progress for `id` until the caller's request settles. Started BEFORE the long
   * request and stopped in its `finally`, so the bar can never outlive the work it
   * describes. A failed poll is swallowed: progress is a courtesy, and an unreachable
   * counter must not turn a succeeding import into a visible error.
   */
  const trackProgress = (id: string) => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await fetchImportProgress(id);
        if (!cancelled && res?.data) setProgress(res.data);
      } catch {
        /* ignore — see above */
      }
    };
    const handle = setInterval(tick, 800);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  };

  const runPreview = async (
    blob: Blob,
    name: string,
    withFixes?: Record<string, string>,
    withUpdateExisting?: boolean
  ) => {
    setBusy(true);
    setDrifted(false);
    setProgress(null);
    const id = crypto.randomUUID();
    const stop = trackProgress(id);
    try {
      // The flag travels as an argument for the same reason withFixes does: setState is
      // async, and reading the state here would send the value from BEFORE the click.
      const res = await previewImport(
        entity, blob, name, toOverrides(withFixes ?? fixes), id,
        withUpdateExisting ?? updateExisting);
      if (res?.data) {
        setPreview(res.data);
        setResult(null);
      } else {
        addToast.error(res?.message || 'The file could not be checked.');
      }
    } catch {
      addToast.error('The file could not be checked.');
    } finally {
      stop();
      setProgress(null);
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!bytes) return;
    setBusy(true);
    setProgress(null);
    const id = crypto.randomUUID();
    const stop = trackProgress(id);
    try {
      // preview.updateExisting is the server's echo of the mode the plan was built under —
      // sending it (never the checkbox state) makes previewed==imported hold even if the
      // local state drifted through a failed re-check.
      const res = await importFile(
        entity, bytes, fileName, toOverrides(fixes), id, preview?.updateExisting ?? false);
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
      stop();
      setProgress(null);
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
    setFixes({});
    setUpdateExisting(false);
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
          // sibling Columns control.
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
          border={entity === 'assets'}
          className="!py-2"
        />
        {entity === 'assets' && (
          <CustomMenuItem
            label="Import Photos"
            onClick={() => setPhotoOpen(true)}
            icon={<i className="icon icon-file text-sm" />}
            className="!py-2"
          />
        )}
      </Dropdown>

      <PhotoImportModal
        isOpen={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onImported={onImported}
      />

      <Modal isOpen={importOpen} onClose={busy ? () => undefined : close} showCloseBtn={!busy} size="3xl">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Import {entityLabel}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Your file is checked first — nothing is written until you confirm what the
            import will do. Rows that already exist are skipped{entity === 'assets'
              ? ' (or, if you choose, update the matching assets)'
              : ''}, and a file with any problem imports nothing, so re-uploading is
            always safe.
          </p>

          {!preview && !result && (
            <div className="flex flex-wrap items-center justify-between gap-y-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 mb-4">
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
                XLSX only, max 64MB, up to {MAX_ROWS.toLocaleString()} rows
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

          {/*
            One bar for both phases. It shows a real percentage once the server knows the
            row count, and stays an indeterminate "working" state before that — a bar that
            invents a number while the file is still being read would be lying.
          */}
          {busy && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-gray-700">
                  {progress?.phase === 'Importing'
                    ? 'Importing rows…'
                    : 'Checking the file…'}
                </p>
                {progress && progress.total > 0 && (
                  <p className="text-xs text-gray-500 tabular-nums">
                    {progress.done.toLocaleString()} / {progress.total.toLocaleString()}
                    {' · '}
                    {progress.percent}%
                  </p>
                )}
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                {progress && progress.total > 0 ? (
                  <div
                    className="h-full rounded-full bg-primarycolor transition-[width] duration-300 ease-out"
                    style={{ width: `${progress.percent}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-primarycolor/60" />
                )}
              </div>
              {progress?.phase === 'Importing' && (
                <p className="mt-2 text-xs text-gray-500">
                  Everything lands together — leave this open until it finishes.
                </p>
              )}
            </div>
          )}

          {/* ---------------- the check's verdict ---------------- */}
          {preview && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-500 tabular-nums">
                {preview.rowsRead} row{preview.rowsRead === 1 ? '' : 's'} checked ·{' '}
                {preview.wouldCreate} will import
                {preview.wouldUpdate > 0 && ` · ${preview.wouldUpdate} will update existing assets`}
                {preview.skippedExisting > 0 && ` · ${preview.skippedExisting} already exist`}
              </p>

              {/* The consent switch. Assets only. Not gated on skippedExisting: a partial
                  update sheet (code + a few columns) fails as a CREATE before it can count
                  as a skip, so the operator must be able to tick this while looking at the
                  problems it will resolve. Toggling CLEARS the verdict before re-checking,
                  so the Import button can never sit next to a plan built under the other
                  mode. */}
              {entity === 'assets' && !drifted && (
                  <label className="flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50/60 px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={updateExisting}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setUpdateExisting(next);
                        setPreview(null);
                        if (bytes) void runPreview(bytes, fileName, undefined, next);
                      }}
                    />
                    <span className="text-sm text-sky-900">
                      <span className="font-medium">
                        Update matching assets with this file&apos;s values.
                      </span>{' '}
                      <span className="text-xs text-sky-800/80">
                        Rows are matched by Asset Code, Tag or Serial Number. Only filled
                        cells change anything — a blank cell always keeps the asset&apos;s
                        current value. Category, condition and lifecycle never change here.
                      </span>
                    </span>
                  </label>
                )}

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
                    {preview.problems.length === 1
                      ? '1 problem blocks the import'
                      : `${preview.problems.length} problems block the import`}{' '}
                    — nothing has been written. Fixable cells can be corrected right here:
                  </p>
                  <div className="max-h-72 overflow-auto rounded-lg border border-red-100">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50 text-left">
                        <tr>
                          <th className="px-3 py-2 w-14 font-medium text-red-800">Row</th>
                          <th className="px-3 py-2 font-medium text-red-800">Problem</th>
                          <th className="px-3 py-2 w-64 font-medium text-red-800">Fix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.problems.map((p, i) => {
                          const fixKey = p.column ? `${p.row}|${p.column}` : null;
                          return (
                            <tr key={i} className="border-t border-red-50 align-top">
                              <td className="px-3 py-2 text-gray-500 tabular-nums">{p.row}</td>
                              <td className="px-3 py-2 text-gray-700">{p.problem}</td>
                              <td className="px-3 py-2">
                                {fixKey ? (
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">
                                      {p.column}
                                    </p>
                                    <input
                                      type="text"
                                      // The correction replaces the cell for BOTH the
                                      // re-check and the import — the file itself is
                                      // never modified.
                                      defaultValue={fixes[fixKey] ?? p.currentValue ?? ''}
                                      onChange={(e) =>
                                        setFixes((current) => ({
                                          ...current,
                                          [fixKey]: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:border-primarycolor focus:outline-none"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    Not a single-cell fix — edit the file.
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {Object.keys(fixes).length > 0 && (
                    <p className="text-xs text-gray-500">
                      {Object.keys(fixes).length} fix
                      {Object.keys(fixes).length === 1 ? '' : 'es'} typed — they apply to
                      this upload only; your file on disk is not changed.
                    </p>
                  )}
                  {/* Warnings must show HERE too: "no rows to import" with the sample-row
                      warning hidden would leave the operator staring at where their one
                      row went. */}
                  {preview.warnings.map((warning, i) => (
                    <p key={`w${i}`} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      {warning}
                    </p>
                  ))}
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
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold tabular-nums">
                          {preview.wouldAutoGenerateCodes}
                        </span>{' '}
                        row{preview.wouldAutoGenerateCodes === 1 ? '' : 's'} have no Asset
                        Code and will receive generated ones
                        {preview.codeFormatExample ? (
                          <>
                            {' '}
                            that look like{' '}
                            <span className="font-mono font-semibold text-secondaryColor">
                              {preview.codeFormatExample}
                            </span>
                          </>
                        ) : (
                          ''
                        )}
                        .
                      </p>
                      {!preview.codeFormatConfigured && (
                        <p className="mt-1 text-xs text-amber-700">
                          No asset-code format has been saved for your company — the
                          default format shown will be used.
                        </p>
                      )}
                      {/* Codes are permanent (never reused, even after deletion), so the
                          moment to fix the format is BEFORE this import, not after. */}
                      <p className="mt-1 text-xs text-gray-500">
                        Not the format you want? Fix it under{' '}
                        <a
                          href="/asset-code-format"
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primarycolor underline"
                        >
                          Settings → Asset Code Format
                        </a>{' '}
                        before importing — generated codes are permanent.
                      </p>
                    </div>
                  )}

                  {/* Server strings verbatim — the single source of truth for wording. */}
                  {preview.warnings.map((warning, i) => (
                    <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      {warning}
                    </p>
                  ))}

                  {!assumptions && preview.wouldCreate + preview.wouldUpdate > 0 && (
                    <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                      The file checks out — no assumptions needed.
                    </p>
                  )}
                  {preview.wouldCreate === 0 && preview.wouldUpdate === 0 && (
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
                {result.updated > 0 &&
                  `; updated ${result.updated} existing asset${result.updated === 1 ? '' : 's'}`}
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

              {/*
                The rows that arrived without an Asset Code now have one. Handing it back
                is what makes a second upload of the same sheet safe: with these pasted
                into the Asset Code column those rows skip instead of importing twice.
              */}
              {result.assignedCodes.length > 0 && (
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                  <p className="text-xs text-gray-700">
                    <span className="font-medium text-secondaryColor">
                      {result.assignedCodes.length} row
                      {result.assignedCodes.length === 1 ? '' : 's'} received a generated
                      Asset Code.
                    </span>{' '}
                    Download them and paste the Asset Code column into your sheet — then
                    re-uploading that file skips these rows instead of creating duplicates.
                  </p>
                  <button
                    type="button"
                    onClick={() => saveAssignedCodes(result.assignedCodes, fileName)}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-secondaryColor hover:bg-gray-50"
                  >
                    <i className="icon icon-download text-xs" />
                    <span>Download assigned codes</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={close} disabled={busy}>
              {result?.imported ? 'Close' : 'Cancel'}
            </Button>
            {/* Recovery for a toggle whose re-check failed (network blip): the verdict was
                cleared on purpose, so offer the check again rather than a dead end. */}
            {!preview && !result && bytes && !busy && (
              <Button onClick={() => runPreview(bytes, fileName)}>Check the file</Button>
            )}
            {preview && drifted && (
              <Button onClick={() => bytes && runPreview(bytes, fileName)} disabled={busy}>
                {busy ? 'Checking…' : 'Check again'}
              </Button>
            )}
            {preview && hasProblems && !drifted && (
              <Button
                onClick={() => bytes && runPreview(bytes, fileName)}
                disabled={busy || Object.keys(fixes).length === 0}
              >
                {busy
                  ? 'Checking…'
                  : Object.keys(fixes).length > 0
                    ? `Check again with ${Object.keys(fixes).length} fix${Object.keys(fixes).length === 1 ? '' : 'es'}`
                    : 'Type a fix to re-check'}
              </Button>
            )}
            {preview && !hasProblems && !drifted
              && preview.wouldCreate + preview.wouldUpdate > 0 && (
              <Button onClick={confirm} disabled={busy}>
                {busy
                  ? 'Importing…'
                  : preview.wouldUpdate > 0
                    ? preview.wouldCreate > 0
                      ? `Import ${preview.wouldCreate} new · update ${preview.wouldUpdate} existing`
                      : `Update ${preview.wouldUpdate} existing asset${preview.wouldUpdate === 1 ? '' : 's'}`
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
