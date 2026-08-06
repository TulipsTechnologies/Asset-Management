import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';

interface ConfirmationModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  isOpen: boolean;
  loading?: boolean;
  /**
   * Confirm in a destructive (red) style. Auto-on when the message is about deleting or
   * removing, so a delete never asks for confirmation behind a green, go-ahead button.
   */
  danger?: boolean;
}

/**
 * Quick yes/no confirm, built on UI/Modal like every other dialog so it gets
 * Escape-to-close, the body scroll lock, focus management and the portal for free.
 */
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  message,
  onConfirm,
  onClose,
  isOpen,
  loading = false,
  danger,
}) => {
  // Prefix match, not whole-word: these messages say "deleted", "deletion", "removing",
  // "discarded" far more often than the bare verb.
  const isDanger = danger ?? /\b(delet|remov|discard)/i.test(message);

  const handleConfirm = () => {
    if (loading) return;
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseBtn={false}>
      <div className="p-6">
        <p className="text-gray-800">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            No
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={loading}
          >
            Yes
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmationModal;
