'use client';

import { ReactNode, useEffect, useState } from 'react';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import TextArea from '@/components/UI/TextArea';
import { IVisualResult } from '@/interface/IVisualRegression';

/**
 * The three review decisions of §10, each an audited human act with a REQUIRED reason.
 * None of them takes the destructive PIN — approval resets nothing (§5); the arming
 * ritual here is the reason text, because "approved by whom, why" is what the audit
 * row exists to answer.
 */

const scenarioLine = (result: IVisualResult) => (
  <p className="mt-1 text-xs text-gray-500">
    <span className="font-mono font-medium text-secondaryColor">{result.scenarioKey}</span>
    {' · '}
    {result.viewport}
    {' · '}
    {result.platform}
  </p>
);

const DecisionShell = ({
  isOpen,
  onClose,
  busy,
  title,
  titleClass = 'text-secondaryColor',
  result,
  children,
  armed,
  confirmLabel,
  confirmVariant = 'primary',
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  busy: boolean;
  title: string;
  titleClass?: string;
  result: IVisualResult;
  children: ReactNode;
  armed: boolean;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
}) => (
  <Modal isOpen={isOpen} onClose={() => !busy && onClose()} showCloseBtn={!busy} size="md">
    <div className="p-6">
      <h2 className={`text-lg font-semibold ${titleClass}`}>{title}</h2>
      {scenarioLine(result)}
      {children}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={confirmVariant}
          disabled={!armed || busy}
          loading={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);

/** §4: the ONLY path that creates a baseline version — reason required, audited. */
export function ApproveBaselineModal({
  isOpen,
  onClose,
  result,
  busy,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: IVisualResult;
  busy: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  return (
    <DecisionShell
      isOpen={isOpen}
      onClose={onClose}
      busy={busy}
      title="Approve new baseline"
      result={result}
      armed={reason.trim().length > 0}
      confirmLabel="Approve baseline"
      onConfirm={() => onConfirm(reason.trim())}
    >
      <p className="mt-3 text-sm text-gray-600">
        This run&apos;s current capture becomes the next baseline version. The previous
        version is kept and linked — baselines are never deleted — and every later run
        diffs against this image.
      </p>
      <div className="mt-4">
        <TextArea
          label="Reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What changed, and why the new rendering is the intended one"
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        Recorded in the audit log with both image hashes and your user.
      </p>
    </DecisionShell>
  );
}

/** The difference is a defect: the existing baseline stays authoritative. */
export function KeepBaselineModal({
  isOpen,
  onClose,
  result,
  busy,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: IVisualResult;
  busy: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  return (
    <DecisionShell
      isOpen={isOpen}
      onClose={onClose}
      busy={busy}
      title="Keep existing baseline"
      result={result}
      armed={reason.trim().length > 0}
      confirmLabel="Keep existing"
      onConfirm={() => onConfirm(reason.trim())}
    >
      <p className="mt-3 text-sm text-gray-600">
        Marks this difference as a defect to fix: the active baseline stays as it is and
        this result is recorded as reviewed with your reasoning.
      </p>
      <div className="mt-4">
        <TextArea
          label="Reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why the current rendering is wrong"
        />
      </div>
    </DecisionShell>
  );
}

/**
 * §3: a time-boxed waiver — downgrades ReviewRequired to MinorDifference until the
 * expiry, never Broken. Expiry is mandatory; a ticket reference keeps it honest.
 */
export function TemporaryDifferenceModal({
  isOpen,
  onClose,
  result,
  busy,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  result: IVisualResult;
  busy: boolean;
  onConfirm: (payload: { reason: string; expiresOn: string; ticketReference: string | null }) => void;
}) {
  const [reason, setReason] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [ticket, setTicket] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setExpiresOn('');
      setTicket('');
    }
  }, [isOpen]);

  const armed = reason.trim().length > 0 && expiresOn.trim().length > 0;

  return (
    <DecisionShell
      isOpen={isOpen}
      onClose={onClose}
      busy={busy}
      title="Accept as temporary difference"
      titleClass="text-amber-700"
      result={result}
      armed={armed}
      confirmLabel="Create exception"
      onConfirm={() =>
        onConfirm({
          reason: reason.trim(),
          expiresOn,
          ticketReference: ticket.trim() || null,
        })
      }
    >
      <p className="mt-3 text-sm text-gray-600">
        Until the expiry, this scenario×viewport classifies as a minor difference instead
        of review-required. Broken results are never excepted, and an expired exception
        reverts on its own — nothing to clean up.
      </p>
      <div className="mt-4 space-y-4">
        <TextArea
          label="Reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why the difference is known and acceptable for now"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Input
              label="Expires on"
              type="date"
              required
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Inclusive: the exception stays valid through the end of this day.
            </p>
          </div>
          <Input
            label="Ticket reference"
            value={ticket}
            onChange={(e) => setTicket(e.target.value)}
            placeholder="e.g. AST-123 (optional)"
            autoComplete="off"
          />
        </div>
      </div>
    </DecisionShell>
  );
}
