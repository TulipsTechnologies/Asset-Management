/**
 * System Test & Demo framework enums — MUST match the explicit values of
 * TulipsHRM.AssetManagement.Domain.Enums.SystemTest* (append-only enums).
 */

export enum SystemTestCompanyPurposeEnum {
  /** Regression scratchpad: reset, seeded and asserted under a fixed clock. */
  TestCompany = 1,
  /** Showroom register: demo data lives here; regression never runs here. */
  DemoCompany = 2,
}

export enum SystemTestRunKindEnum {
  HealthCheck = 1,
  Regression = 2,
  DemoData = 3,
  /** Frontend visual + functional UI regression (visual design §3). Appended. */
  VisualRegression = 4,
}

export enum SystemTestRunStatusEnum {
  Running = 1,
  Passed = 2,
  PassedWithWarnings = 3,
  Failed = 4,
  /** Force-terminated through the abort endpoint (§12.4). */
  Cancelled = 5,
  /** A Running row whose heartbeat went stale and was reclaimed by a later starter (§12.4). */
  Abandoned = 6,
}

export enum SystemTestRunItemStatusEnum {
  Pass = 1,
  Warning = 2,
  Failed = 3,
  Info = 4,
}

export const COMPANY_PURPOSE_LABELS: Record<SystemTestCompanyPurposeEnum, string> = {
  [SystemTestCompanyPurposeEnum.TestCompany]: 'Test Company',
  [SystemTestCompanyPurposeEnum.DemoCompany]: 'Demo Company',
};

export const RUN_KIND_LABELS: Record<SystemTestRunKindEnum, string> = {
  [SystemTestRunKindEnum.HealthCheck]: 'Health Check',
  [SystemTestRunKindEnum.Regression]: 'Regression',
  [SystemTestRunKindEnum.DemoData]: 'Demo Data',
  [SystemTestRunKindEnum.VisualRegression]: 'Visual Regression',
};

export const RUN_STATUS_LABELS: Record<SystemTestRunStatusEnum, string> = {
  [SystemTestRunStatusEnum.Running]: 'Running',
  [SystemTestRunStatusEnum.Passed]: 'Passed',
  [SystemTestRunStatusEnum.PassedWithWarnings]: 'Passed with warnings',
  [SystemTestRunStatusEnum.Failed]: 'Failed',
  [SystemTestRunStatusEnum.Cancelled]: 'Cancelled',
  [SystemTestRunStatusEnum.Abandoned]: 'Abandoned',
};

/** Badge classes for a run status — green/amber/red family used across the module. */
export const RUN_STATUS_BADGE: Record<SystemTestRunStatusEnum, string> = {
  [SystemTestRunStatusEnum.Running]: 'bg-blue-50 text-blue-800',
  [SystemTestRunStatusEnum.Passed]: 'bg-green-100 text-green-800',
  [SystemTestRunStatusEnum.PassedWithWarnings]: 'bg-amber-100 text-amber-800',
  [SystemTestRunStatusEnum.Failed]: 'bg-red-100 text-red-800',
  [SystemTestRunStatusEnum.Cancelled]: 'bg-gray-100 text-gray-800',
  [SystemTestRunStatusEnum.Abandoned]: 'bg-gray-100 text-gray-800',
};

export const RUN_ITEM_STATUS_LABELS: Record<SystemTestRunItemStatusEnum, string> = {
  [SystemTestRunItemStatusEnum.Pass]: 'Pass',
  [SystemTestRunItemStatusEnum.Warning]: 'Warning',
  [SystemTestRunItemStatusEnum.Failed]: 'Failed',
  [SystemTestRunItemStatusEnum.Info]: 'Info',
};

export const RUN_ITEM_STATUS_BADGE: Record<SystemTestRunItemStatusEnum, string> = {
  [SystemTestRunItemStatusEnum.Pass]: 'bg-green-100 text-green-800',
  [SystemTestRunItemStatusEnum.Warning]: 'bg-amber-100 text-amber-800',
  [SystemTestRunItemStatusEnum.Failed]: 'bg-red-100 text-red-800',
  [SystemTestRunItemStatusEnum.Info]: 'bg-blue-50 text-blue-800',
};

/** True once a run can no longer change — polling stops on this. */
export const isRunTerminal = (status: SystemTestRunStatusEnum): boolean =>
  status !== SystemTestRunStatusEnum.Running;

// ---- Visual Regression framework (visual design §3, appended) ----------------------

/** Backend classification of one captured scenario×viewport (visual design §4). */
export enum VisualStatusEnum {
  Pass = 1,
  MinorDifference = 2,
  ReviewRequired = 3,
  /** Never downgraded by a temporary exception (visual design §3/§4). */
  Broken = 4,
  /** No active baseline — a proposed baseline awaiting explicit approval (§4). */
  NewScenario = 5,
}

/** Outcome of a scenario's declarative functional assertions (visual design §3). */
export enum VisualFunctionalStatusEnum {
  Pass = 1,
  Failed = 2,
}

/** An operator's review decision on one visual result (visual design §3). */
export enum VisualReviewDecisionEnum {
  None = 0,
  KeptExisting = 1,
  ApprovedNewBaseline = 2,
  TemporaryDifference = 3,
}

/** Run depth (visual design §2/§7): a scenario runs at its level and every deeper one. */
export enum VisualLevelEnum {
  Smoke = 1,
  Regression = 2,
  Full = 3,
}

export const VISUAL_STATUS_LABELS: Record<VisualStatusEnum, string> = {
  [VisualStatusEnum.Pass]: 'Pass',
  [VisualStatusEnum.MinorDifference]: 'Minor difference',
  [VisualStatusEnum.ReviewRequired]: 'Review required',
  [VisualStatusEnum.Broken]: 'Broken',
  [VisualStatusEnum.NewScenario]: 'New scenario',
};

/** Same green/amber/red/blue family the run badges use — status colors, never reused. */
export const VISUAL_STATUS_BADGE: Record<VisualStatusEnum, string> = {
  [VisualStatusEnum.Pass]: 'bg-green-100 text-green-800',
  [VisualStatusEnum.MinorDifference]: 'bg-amber-100 text-amber-800',
  [VisualStatusEnum.ReviewRequired]: 'bg-orange-100 text-orange-800',
  [VisualStatusEnum.Broken]: 'bg-red-100 text-red-800',
  [VisualStatusEnum.NewScenario]: 'bg-blue-50 text-blue-800',
};

export const VISUAL_FUNCTIONAL_LABELS: Record<VisualFunctionalStatusEnum, string> = {
  [VisualFunctionalStatusEnum.Pass]: 'Pass',
  [VisualFunctionalStatusEnum.Failed]: 'Failed',
};

export const VISUAL_FUNCTIONAL_BADGE: Record<VisualFunctionalStatusEnum, string> = {
  [VisualFunctionalStatusEnum.Pass]: 'bg-green-100 text-green-800',
  [VisualFunctionalStatusEnum.Failed]: 'bg-red-100 text-red-800',
};

export const VISUAL_DECISION_LABELS: Record<VisualReviewDecisionEnum, string> = {
  [VisualReviewDecisionEnum.None]: 'Not reviewed',
  [VisualReviewDecisionEnum.KeptExisting]: 'Kept existing baseline',
  [VisualReviewDecisionEnum.ApprovedNewBaseline]: 'Approved new baseline',
  [VisualReviewDecisionEnum.TemporaryDifference]: 'Temporary difference',
};

export const VISUAL_LEVEL_LABELS: Record<VisualLevelEnum, string> = {
  [VisualLevelEnum.Smoke]: 'Smoke',
  [VisualLevelEnum.Regression]: 'Regression',
  [VisualLevelEnum.Full]: 'Full',
};
