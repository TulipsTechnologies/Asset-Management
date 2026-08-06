'use client';

import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';
import ReasonBanner from '@/components/UI/ReasonBanner';
import { IBulkResult } from '@/utils/bulkActions';

/**
 * Confirm a bulk delete, then report it.
 *
 * One dialog for both halves on purpose: the operator confirms, and the answer appears in
 * the same place they were already looking, listing every row that was refused and the
 * server's own reason for it. A toast cannot carry that — these masters refuse partially by
 * design (a category with assets, a vendor still supplying one), so "some went, some did
 * not" is the ordinary result rather than an error.
 */
export default function BulkDeleteModal({
  open,
  entityLabel,
  count,
  running,
  result,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /** Singular noun: "category", "vendor". */
  entityLabel: string;
  count: number;
  running: boolean;
  result: IBulkResult | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const plural = count === 1 ? entityLabel : `${entityLabel}s`;

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="p-6">
        {!result ? (
          <>
            <h2 className="text-lg font-semibold text-secondaryColor">
              Delete {count} {plural}?
            </h2>
            <p className="mt-1.5 text-sm text-gray-600">
              Each one is checked on its own. Any that something still depends on is kept, and
              you will be told which and why.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose} disabled={running}>
                Cancel
              </Button>
              <Button onClick={onConfirm} disabled={running}>
                {running ? `Deleting… ` : `Delete ${count} ${plural}`}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-secondaryColor">
              {result.refused.length === 0
                ? `${result.succeeded.length} ${
                    result.succeeded.length === 1 ? entityLabel : `${entityLabel}s`
                  } deleted`
                : 'Some were kept'}
            </h2>
            <p className="mt-1.5 text-sm text-gray-600">
              {result.succeeded.length} deleted · {result.refused.length} kept
            </p>

            {result.refused.length > 0 && (
              <div className="mt-4 max-h-72 overflow-y-auto">
                <ReasonBanner
                  reasons={result.refused.map((item) => ({
                    // A refusal without a code is still a refusal worth showing; the banner
                    // keys its tone off the code, so an empty one falls back to plain error.
                    code: item.reasonCode ?? '',
                    message: item.message ?? 'It could not be deleted.',
                    subject: item.label,
                  }))}
                />
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
