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

/**
 * Options → Export / Import for a data page, in the HRM style. Import opens the
 * modal: template download, xlsx picker, then either a success summary or the
 * full problem list by Excel row — an import with any problem writes NOTHING,
 * so the file can be fixed and re-uploaded as-is (existing rows are skipped).
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
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IImportResult | null>(null);

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

  const pickFile = (picked: File | null) => {
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith('.xlsx')) {
      addToast.error('Only .xlsx files are supported.');
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      addToast.error('The file is larger than 10MB — split it into smaller files.');
      return;
    }
    setFile(picked);
    setResult(null);
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await importFile(entity, file);
      if (res?.data) {
        setResult(res.data);
        if (res.data.imported) {
          addToast.success(res.message || 'Import complete.');
          onImported();
        }
      } else {
        addToast.error(res?.message || 'The import failed.');
      }
    } catch (error) {
      console.error('Import error:', error);
      addToast.error('An error occurred during the import.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setImportOpen(false);
    setFile(null);
    setResult(null);
  };

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

      <Modal isOpen={importOpen} onClose={close} size="lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Import {entityLabel}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Upload a file to bulk import records. Rows that already exist are
            skipped, and a file with any problem imports nothing — so fixing and
            re-uploading is always safe.
          </p>

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

          {!result?.imported && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className="w-full rounded-lg border-2 border-dashed border-gray-200 px-4 py-8 text-center hover:border-primarycolor/60"
            >
              <i className="icon icon-upload text-2xl text-gray-300" />
              <p className="text-sm text-gray-500 mt-2">
                {file ? file.name : 'Drag and drop a file here, or click to browse'}
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

          {result && (
            <div className="mt-4">
              {result.imported ? (
                <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                  Imported {result.created} row{result.created === 1 ? '' : 's'}
                  {result.skippedExisting > 0 &&
                    `; ${result.skippedExisting} already existed and were skipped`}
                  .
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-red-700 mb-2">
                    Nothing was imported — fix these rows and upload again:
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
                        {result.problems.map((p, i) => (
                          <tr key={i} className="border-t border-red-50">
                            <td className="px-3 py-2 text-gray-500">{p.row}</td>
                            <td className="px-3 py-2 text-gray-700">{p.problem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {result.warnings.length > 0 && (
                <p className="text-xs text-amber-700 mt-2">
                  {result.warnings.join(' ')}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={close}>
              {result?.imported ? 'Close' : 'Cancel'}
            </Button>
            {!result?.imported && (
              <Button onClick={submit} disabled={!file || busy}>
                {busy ? 'Importing…' : 'Submit'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ImportExportOptions;
