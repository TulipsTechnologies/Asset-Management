/**
 * Asset Management permission ids — MUST match the implicit int values of
 * TulipsHRM.AssetManagement.Domain.Enums.Permissions (append-only enum).
 * The JWT `permissions` claim carries these as a CSV of ints.
 */
export enum Permission {
  TotalAccess = 1,

  ViewAssets = 27,
  ViewAllAssets = 28,
  ManageAssets = 29,
  DeleteDraftAssets = 30,
  ExportAssets = 31,
  ImportAssets = 32,
  AssignAssets = 33,
  ReturnAssets = 34,
  TransferAssets = 35,
  AuditAssets = 36,
  RequestAssetMaintenance = 37,
  ManageWorkOrders = 38,
  ViewDepreciation = 39,
  RunDepreciation = 40,
  ApproveDepreciation = 41,
  RequestAssetDisposal = 42,
  ApproveAssetDisposal = 43,
  ViewAssetReports = 44,
  ManageAssetSettings = 45,
  ViewAssetAuditLogs = 46,
  ResetCompanyData = 47,
  /** §12.15: pinned to 56 — the backend enum appends it after ReviewTaxDepreciation (55). */
  ManageSystemTest = 56,
}

/** OR semantics, TotalAccess short-circuits — mirrors the backend check. */
export const hasPermission = (
  userPermissions: number[],
  ...required: Permission[]
): boolean =>
  userPermissions.includes(Permission.TotalAccess) ||
  required.some((p) => userPermissions.includes(p));
