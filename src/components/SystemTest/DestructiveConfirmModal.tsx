'use client';

import { ReactNode, useEffect, useState } from 'react';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';

/**
 * The arming ritual every destructive framework call goes through (§4): the exact company
 * name typed and the system test PIN entered, both sent in the SAME request the server
 * verifies them in. The PIN field is a password input and its value lives only in this
 * modal's state — it is never displayed, never persisted, never echoed.
 */
export default function DestructiveConfirmModal({
  isOpen,
  onClose,
  title,
  consequence,
  confirmationPhrase,
  requirePhrase = true,
  confirmLabel,
  busy = false,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** What will actually happen, in plain words — shown above the inputs. */
  consequence: ReactNode;
  /**
   * The exact phrase the server expects (the company's name). When known, the confirm
   * button arms only on an exact match; when unknown, any non-empty phrase is sent and
   * the server's own comparison decides.
   */
  confirmationPhrase?: string | null;
  /** Provisioning takes only the PIN — no phrase (§5). */
  requirePhrase?: boolean;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: (payload: { confirmationPhrase: string; pin: string }) => void;
}) {
  const [typed, setTyped] = useState('');
  const [pin, setPin] = useState('');

  // A fresh open never inherits the previous attempt's phrase or PIN.
  useEffect(() => {
    if (isOpen) {
      setTyped('');
      setPin('');
    }
  }, [isOpen]);

  const phraseArmed =
    !requirePhrase ||
    (confirmationPhrase
      ? typed.trim() === confirmationPhrase
      : typed.trim().length > 0);
  const armed = phraseArmed && pin.trim().length > 0 && !busy;

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} showCloseBtn={!busy} size="md">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-red-700">{title}</h2>
        <div className="mt-2 text-sm text-gray-600">{consequence}</div>

        {requirePhrase && (
          <>
            <p className="mt-4 text-xs text-gray-500">
              Type{' '}
              {confirmationPhrase ? (
                <span className="font-mono font-medium text-secondaryColor">
                  {confirmationPhrase}
                </span>
              ) : (
                <span className="font-medium text-secondaryColor">
                  the company&apos;s exact name
                </span>
              )}{' '}
              to confirm.
            </p>
            <div className="mt-2">
              <Input
                label="Company name"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmationPhrase ?? 'Company name'}
                autoComplete="off"
              />
            </div>
          </>
        )}

        <div className="mt-4 max-w-xs">
          <Input
            label="System test PIN"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="off"
            placeholder="••••"
          />
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          Verified server-side in this same call. Five failed attempts lock the PIN for 15
          minutes.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!armed}
            loading={busy}
            onClick={() =>
              onConfirm({ confirmationPhrase: typed.trim(), pin: pin.trim() })
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
