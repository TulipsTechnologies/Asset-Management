import { LoadingSvg } from "@tulipstechnologies/common";

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

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  message,
  onConfirm,
  onClose,
  isOpen,
  loading = false,
  danger,
}) => {
  if (!isOpen) return null;

  // Prefix match, not whole-word: these messages say "deleted", "deletion", "removing",
  // "discarded" far more often than the bare verb.
  const isDanger = danger ?? /\b(delet|remov|discard)/i.test(message);

  const handleConfirm = () => {
    if (loading) return;
    onConfirm();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      style={{ margin: 0, padding: 0 }}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-gray-800 mb-6">{message}</p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
          >
            No
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-400 hover:bg-green-500'
            }`}
          >
            {loading ? <LoadingSvg /> : 'Yes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
