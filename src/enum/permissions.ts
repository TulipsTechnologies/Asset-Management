/**
 * Asset Management permission ids — MUST match
 * TulipsHRM.AssetManagement.Permissions.PermissionEnum. The AssetAuthToken's
 * `permissions` claim carries these as a CSV of ints.
 *
 * These are the SHARED-CONTRACT ids (1600+), not the module's old domain ids. The two
 * enums were merged into one contract and the shared members moved 27..60 → 1600..1633;
 * this mirror still carried the old numbers afterwards, so every gate below silently
 * evaluated false — the System Test and Visual Regression sections disappeared for users
 * who did hold the permission. A stale mirror fails closed and silently, which is why the
 * values are pinned here rather than derived from anything.
 *
 * Deliberately a SUBSET: internal-user administration ids exist in the backend enum but
 * are not this frontend's business.
 */
export enum Permission {
  TotalAccess = 1,

  ViewAssets = 1600,
  ViewAllAssets = 1601,
  ManageAssets = 1602,
  DeleteDraftAssets = 1603,
  ExportAssets = 1604,
  ImportAssets = 1605,
  AssignAssets = 1606,
  ReturnAssets = 1607,
  TransferAssets = 1608,
  AuditAssets = 1609,
  RequestAssetMaintenance = 1610,
  ManageWorkOrders = 1611,
  ViewDepreciation = 1612,
  RunDepreciation = 1613,
  ApproveDepreciation = 1614,
  RequestAssetDisposal = 1615,
  ApproveAssetDisposal = 1616,
  ViewAssetReports = 1617,
  ManageAssetSettings = 1618,
  ViewAssetAuditLogs = 1619,
  ResetCompanyData = 1620,

  ManageSystemTest = 1629,

  ViewVisualRegression = 1630,
  RunVisualRegression = 1631,
  ApproveVisualBaseline = 1632,
  ManageVisualExceptions = 1633,

  /** Warranty, insurance and claims (§9). */
  ViewAssetCoverage = 1634,
  ManageAssetCoverage = 1635,
}

/** OR semantics, TotalAccess short-circuits — mirrors the backend check. */
export const hasPermission = (
  userPermissions: number[],
  ...required: Permission[]
): boolean =>
  userPermissions.includes(Permission.TotalAccess) ||
  required.some((p) => userPermissions.includes(p));
