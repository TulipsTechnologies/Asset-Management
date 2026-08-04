export interface IDashboardCounts {
  assetsTotal: number;
  assetsActive: number;
  assetsUnderMaintenance: number;
  assetsNotVerified: number;
  assetsMissing: number;
  workOrdersOpen: number;
  maintenanceRequestsOpen: number;
  transfersActive: number;
  discrepanciesOpen: number;
  assetsHeld: number;
  disposalsApprovedPending: number;
  returnsPending: number;
  recoveryCasesOpen: number;
  assetsAssigned: number;
  assetsUnassigned: number;
  assetsInTransfer: number;
  assetsCapitalized: number;
  assetsFullyDepreciated: number;
  journalProposalsPending: number;
  runsUnfinished: number;
}

export interface IDashboardItem {
  entityId: string;
  name: string;
  owner?: string | null;
  date?: string | null;
  daysOpen: number;
}

export interface IMonthlyAmount {
  year: number;
  month: number;
  total: number;
}

export interface IAssetDashboard {
  counts: IDashboardCounts;
  pendingReturns: IDashboardItem[];
  openRecoveryCases: IDashboardItem[];
  overdueWorkOrders: IDashboardItem[];
  breakdownAssets: IDashboardItem[];
  approvedDisposals: IDashboardItem[];
  monthlyDepreciation: IMonthlyAmount[];
}
