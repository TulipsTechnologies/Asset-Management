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

/** One location as the dashboard needs it: what is here, and what is wrong here. */
export interface IDashboardLocationNode {
  /** Null for exactly one row: the "(No location)" bucket. */
  id: string | null;
  parentId: string | null;
  name: string;
  /** 1 = building … 3 = room; 0 for the unlocated bucket. */
  depth: number;
  /** Assets DIRECTLY here — subtree totals are rolled up client-side. */
  assetCount: number;
  missingCount: number;
  discrepancyCount: number;
  underMaintenanceCount: number;
  neverVerifiedCount: number;
  verifiedCount: number;
  topCategories: { name: string; count: number }[];
}

export interface IAssetDashboard {
  counts: IDashboardCounts;
  /** The whole physical hierarchy, flat — selecting a location costs no extra request. */
  locationHierarchy: IDashboardLocationNode[];
  pendingReturns: IDashboardItem[];
  openRecoveryCases: IDashboardItem[];
  overdueWorkOrders: IDashboardItem[];
  breakdownAssets: IDashboardItem[];
  approvedDisposals: IDashboardItem[];
  monthlyDepreciation: IMonthlyAmount[];
}
