import { LoadingSvg } from "@tulipstechnologies/common";

interface ConfirmationModalProps {
  message: string;
  onConfirm: () => void;
  onClose: () => void;
  isOpen: boolean;
  loading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  message,
  onConfirm,
  onClose,
  isOpen,
  loading = false,
}) => {
  if (!isOpen) return null;

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
            className="px-4 py-2 bg-green-400 text-white rounded hover:bg-green-400"
          >
            {loading ? <LoadingSvg /> : "Yes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
