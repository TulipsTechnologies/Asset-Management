'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import CustomCheckbox from '@/components/UI/CustomCheckBox';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import ImageLightbox from '@/components/UI/ImageLightbox';
import Select from '@/components/UI/Select';
import { IAssetDocument } from '@/interface/IAssetDocument';
import {
  deleteAssetDocument,
  downloadAssetDocument,
  fetchAssetDocuments,
  uploadAssetDocument,
} from '@/services/assetDocument.service';
import { saveBlobResponse } from '@/utils/serviceUtils';
import {
  AssetDocumentTypeEnum,
  DOCUMENT_TYPE_LABELS,
} from '@/enum/assetDocumentEnums';
import { shortDate } from '@/components/Assets/AssetViewShared';

// Delegates to the module's one date formatter. This was one of 18 identical local copies
// rendering the locale default ("8/20/2026"), which reads as a different day outside the US
// and disagreed with the dashboard and the printed sheets.
const formatDate = (value?: string | null) => shortDate(value);

/**
 * Documents & photos attached to an asset: list, upload (multipart), blob
 * download and delete-with-confirm. `readOnly` (Disposed assets) hides
 * upload/delete — the record is frozen but stays downloadable.
 */
const AssetDocumentsSection = ({
  assetId,
  readOnly = false,
}: {
  assetId: string;
  readOnly?: boolean;
}) => {
  const { addToast } = useToast();

  const [documents, setDocuments] = useState<IAssetDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    documentType: '',
    title: '',
    isPrimaryPhoto: false,
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [deleting, setDeleting] = useState<IAssetDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadDocuments = useCallback(() => {
    fetchAssetDocuments(assetId)
      .then((res) => {
        if (res?.success) setDocuments(res.data ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [assetId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const openUpload = () => {
    setUploadForm({ documentType: '', title: '', isPrimaryPhoto: false });
    setUploadFile(null);
    setUploadError('');
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!uploadForm.documentType || !uploadFile) {
      setUploadError('Pick a document type and a file');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadAssetDocument(assetId, {
        documentType: Number(uploadForm.documentType) as AssetDocumentTypeEnum,
        title: uploadForm.title.trim() || undefined,
        isPrimaryPhoto: uploadForm.isPrimaryPhoto,
        file: uploadFile,
      });
      if (res?.success) {
        addToast.success(res.message || 'Document uploaded');
        setUploadOpen(false);
        loadDocuments();
      } else {
        addToast.error(res?.message || 'Failed to upload the document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      addToast.error('An error occurred while uploading the document');
    } finally {
      setUploading(false);
    }
  };

  /**
   * An image opened full size. The bytes come through the authenticated endpoint exactly as
   * a download does — the blob URL is revoked when the viewer closes so a long session
   * browsing documents does not accumulate them.
   */
  const [viewing, setViewing] = useState<{ url: string; label: string } | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const isImageDoc = (doc: IAssetDocument) =>
    doc.documentType === AssetDocumentTypeEnum.Photo ||
    (doc.contentType ?? '').toLowerCase().startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(doc.fileName ?? '');

  const handleView = async (doc: IAssetDocument) => {
    setViewingId(doc.id);
    try {
      const res = await downloadAssetDocument(doc.id);
      if (!res?.ok) throw new Error('download failed');
      const blob = await res.blob();
      setViewing({
        url: URL.createObjectURL(blob),
        label: doc.title || doc.fileName,
      });
    } catch (error) {
      console.error('Error opening image:', error);
      addToast.error('Failed to open the image');
    } finally {
      setViewingId(null);
    }
  };

  const closeViewer = () => {
    if (viewing) URL.revokeObjectURL(viewing.url);
    setViewing(null);
  };

  const handleDownload = async (doc: IAssetDocument) => {
    setDownloadingId(doc.id);
    try {
      const res = await downloadAssetDocument(doc.id);
      await saveBlobResponse(res, doc.fileName);
    } catch (error) {
      console.error('Error downloading document:', error);
      addToast.error('Failed to download the document');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (doc: IAssetDocument) => {
    try {
      const res = await deleteAssetDocument(doc.id);
      if (res?.success) {
        addToast.success(res.message || 'Document deleted');
      } else {
        addToast.error(res?.message || 'Failed to delete the document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      addToast.error('An error occurred while deleting the document');
    } finally {
      loadDocuments();
    }
  };

  return (
    <div className="bg-white rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Documents
        </h2>
        {!readOnly && (
          <Button variant="ghost" onClick={openUpload}>
            <i className="icon icon-plus text-xs" />
            <span>Upload</span>
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-gray-400">
          No documents attached to this asset yet.
        </p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0"
            >
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {DOCUMENT_TYPE_LABELS[doc.documentType] ?? 'Other'}
              </span>
              <span className="font-medium text-secondaryColor">
                {doc.fileName}
              </span>
              {doc.title && <span className="text-gray-500">{doc.title}</span>}
              {doc.isPrimaryPhoto && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  Primary photo
                </span>
              )}
              <span className="text-gray-400">{formatDate(doc.uploadedOn)}</span>
              <span className="ml-auto flex items-center gap-3">
                {isImageDoc(doc) && (
                  <button
                    onClick={() => handleView(doc)}
                    disabled={viewingId === doc.id}
                    className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {viewingId === doc.id ? 'Opening…' : 'View'}
                  </button>
                )}
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="text-xs text-primarycolor hover:underline disabled:opacity-50"
                >
                  {downloadingId === doc.id ? 'Downloading…' : 'Download'}
                </button>
                {!readOnly && (
                  <button
                    onClick={() => setDeleting(doc)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <ImageLightbox
          src={viewing.url}
          alt={viewing.label}
          caption={viewing.label}
          onClose={closeViewer}
        />
      )}

      {/* Upload modal */}
      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} size="md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-4">
            Upload Document
          </h2>
          <div className="grid grid-cols-1 gap-y-5">
            <Select
              label="Document Type"
              required
              placeholder="Select type"
              options={Object.entries(DOCUMENT_TYPE_LABELS).map(
                ([value, label]) => ({ value, label })
              )}
              value={uploadForm.documentType}
              onChange={(e) => {
                setUploadForm((prev) => ({
                  ...prev,
                  documentType: e.target.value,
                }));
                setUploadError('');
              }}
            />
            <Input
              label="Title"
              value={uploadForm.title}
              onChange={(e) =>
                setUploadForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Optional label, e.g. Purchase invoice 2026"
            />
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-500">
                File<span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="file"
                onChange={(e) => {
                  setUploadFile(e.target.files?.[0] ?? null);
                  setUploadError('');
                }}
                className="w-full py-2 text-sm text-gray-600 border-b border-gray-300"
              />
            </div>
            <CustomCheckbox
              title="Primary photo (shown as the asset's picture)"
              checked={uploadForm.isPrimaryPhoto}
              onChange={() =>
                setUploadForm((prev) => ({
                  ...prev,
                  isPrimaryPhoto: !prev.isPrimaryPhoto,
                }))
              }
            />
          </div>
          {uploadError && (
            <p className="text-sm text-red-600 mt-3">{uploadError}</p>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmationModal
        isOpen={deleting !== null}
        message={`Delete "${deleting?.fileName ?? ''}"? This cannot be undone.`}
        onConfirm={() => {
          if (deleting) handleDelete(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
};

export default AssetDocumentsSection;
