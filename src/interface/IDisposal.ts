import { AssetDocumentTypeEnum } from '@/enum/assetDocumentEnums';
import { CustodyStatusEnum, LifecycleStatusEnum } from '@/enum/assetEnums';
import {
  DisposalMethodEnum,
  DisposalRequestStatusEnum,
} from '@/enum/disposalEnums';
import { ISortFilter } from '@/utils/serviceUtils';

/**
 * The execution record — exactly one per executed request, and absent until
 * the disposal has actually run.
 */
export interface IDisposalTransaction {
  id: string;
  disposalDate: string;
  actualProceeds?: number | null;
  currencyId?: string | null;
  /** Buyer, recycler, donee… */
  counterpartyName?: string | null;
  /** Invoice, gate pass, certificate number… */
  counterpartyReference?: string | null;
  notes?: string | null;
}

export interface IDisposalRequest {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;

  /**
   * The asset's live lifecycle and custody, carried on every row so the client
   * can pre-flight Execute instead of submitting a doomed form.
   */
  assetLifecycleStatus: LifecycleStatusEnum;
  assetCustodyStatus: CustodyStatusEnum;

  disposalMethod: DisposalMethodEnum;
  reason: string;
  /** Optional planning estimate — the real figure is captured at execution. */
  proposedProceeds?: number | null;
  currencyId?: string | null;
  status: DisposalRequestStatusEnum;
  requestedByEmployeeId?: string | null;
  requestedByEmployeeName?: string | null;
  requiresDataWipe: boolean;
  rejectReason?: string | null;
  cancelReason?: string | null;

  approvedOn?: string | null;
  rejectedOn?: string | null;
  cancelledOn?: string | null;
  executedOn?: string | null;

  transaction?: IDisposalTransaction | null;
  wipeCertificateCount: number;
  documentCount: number;

  createdOn: string;
  /** Base64 rowversion — REQUIRED on approve/reject/cancel/execute (concurrency contract). */
  rowVersion?: string | null;
}

/**
 * Propose that an asset leaves the register. Allowed for Active or Retired
 * assets (a Draft asset is deleted, not disposed); one active request per
 * asset.
 */
export interface ICreateDisposalRequest {
  assetId: string;
  disposalMethod: DisposalMethodEnum;
  reason: string;
  /** Optional estimate; requires a currency when supplied. */
  proposedProceeds?: number;
  /** 3-char ISO code. */
  currencyId?: string;
  /** Optional requesting-employee link (display/audit only). */
  requestedByEmployeeId?: string;
  requiresDataWipe: boolean;
}

/** Approve carries only the concurrency token — the decision itself takes no input. */
export interface IApproveDisposalRequest {
  /** Base64 rowversion. */
  rowVersion: string;
}

export interface IRejectDisposalRequest {
  reason: string;
  /** Base64 rowversion. */
  rowVersion: string;
}

export interface ICancelDisposalRequest {
  reason: string;
  /** Base64 rowversion. */
  rowVersion: string;
}

/**
 * The terminal apply — IRREVERSIBLE. Sale and TradeIn must record their
 * proceeds; proceeds always need a currency.
 */
export interface IExecuteDisposalRequest {
  /** Defaults to today server-side; the UI sends the operator's local date. */
  disposalDate?: string;
  actualProceeds?: number;
  /** 3-char ISO code — required once proceeds are recorded. */
  currencyId?: string;
  counterpartyName?: string;
  counterpartyReference?: string;
  notes?: string;
  /** Base64 rowversion. */
  rowVersion: string;
}

export interface IDataWipeCertificate {
  id: string;
  wipeMethod: string;
  wipedOn: string;
  wipedByEmployeeId?: string | null;
  wipedByEmployeeName?: string | null;
  certificateReference?: string | null;
  /** Name of the scanned certificate, when one was attached. */
  fileName?: string | null;
  notes?: string | null;
  createdOn: string;
  /** True when a scanned certificate is attached and can be downloaded. */
  hasFile: boolean;
}

/**
 * Multipart body — the scanned certificate is optional. Recordable while the
 * request is active AND after execution: a certificate can arrive late.
 */
export interface IRecordDataWipeCertificate {
  wipeMethod: string;
  wipedOn?: string;
  wipedByEmployeeId?: string;
  certificateReference?: string;
  notes?: string;
  file?: File | null;
}

export interface IDisposalDocument {
  id: string;
  documentType: AssetDocumentTypeEnum;
  title?: string | null;
  fileName?: string | null;
  notes?: string | null;
  createdOn: string;
}

/**
 * Multipart body. Disposal paperwork hangs off the REQUEST, not the asset,
 * precisely so it stays filable after execution — a certificate of destruction
 * arrives when the asset is already gone.
 */
export interface IUploadDisposalDocument {
  documentType: AssetDocumentTypeEnum;
  title?: string;
  notes?: string;
  file: File;
}

export interface IDisposalRequestFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
  status?: DisposalRequestStatusEnum;
  disposalMethod?: DisposalMethodEnum;
  assetId?: string;
  fromDate?: string;
  toDate?: string;
}
