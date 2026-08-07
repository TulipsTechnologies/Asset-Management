import {
  SystemTestCompanyPurposeEnum,
  SystemTestRunStatusEnum,
  VisualFunctionalStatusEnum,
  VisualLevelEnum,
  VisualReviewDecisionEnum,
  VisualStatusEnum,
} from '@/enum/systemTestEnums';
import { ISortFilter } from '@/utils/serviceUtils';

/**
 * Visual Regression DTO mirrors — MUST match the shapes VisualRegressionController
 * returns (Application/Services/SystemTest/VisualModels.cs + VisualContracts.cs).
 * Everything the runner reports (diff ratio, assertion JSON) is labeled as such in the
 * UI (§12.4); the images the review modal renders come from the SERVER files endpoint.
 */

/** A named capture size (§2). The NAME is the persisted viewport key. */
export interface IVisualViewport {
  name: string;
  width: number;
  height: number;
}

export interface IVisualDiffThresholds {
  pixelRatioPass: number;
  pixelRatioMinor: number;
  antiAliasing: number;
}

/** Declarative pre-capture step — data, not code (§1). */
export interface IVisualStep {
  kind: number;
  selector?: string | null;
  value?: string | null;
}

/** Declarative functional assertion (§1). */
export interface IVisualAssertion {
  kind: number;
  selector?: string | null;
  expected?: string | null;
}

export interface IVisualScenarioDefinition {
  key: string;
  name: string;
  route: string;
  requiredDataState: string;
  viewports: IVisualViewport[];
  level: VisualLevelEnum;
  preCaptureSteps: IVisualStep[];
  assertions: IVisualAssertion[];
  captureMode: number;
  captureSelector?: string | null;
  captureMedia: number;
  viewportOverride?: IVisualViewport | null;
  maskSelectors: string[];
  diffThresholds: IVisualDiffThresholds;
  isCritical: boolean;
  failOnJsError: boolean;
  criticalSelectors: string[];
  /** False = functional-only: assertions run, no pixel comparison (§12.12). */
  pixelCompare: boolean;
}

export interface IVisualPlannedScenario {
  definition: IVisualScenarioDefinition;
  /** The viewports this scenario captures AT THE REQUESTED LEVEL. */
  viewports: IVisualViewport[];
}

export interface IVisualModuleScenarios {
  moduleKey: string;
  displayName: string;
  /** §12.14: cross-cutting chrome masks, declared once per module. */
  sharedMaskSelectors: string[];
  scenarios: IVisualPlannedScenario[];
}

/** GET /VisualRegression/scenarios — the concrete capture plan for a level (§12.5). */
export interface IVisualScenarioSet {
  level: VisualLevelEnum;
  totalCaptures: number;
  modules: IVisualModuleScenarios[];
}

export interface IVisualResult {
  id: string;
  runId: string;
  moduleKey: string;
  scenarioKey: string;
  viewport: string;
  platform: string;
  browserVersion?: string | null;
  baselineId?: string | null;
  currentFileId?: string | null;
  diffFileId?: string | null;
  /** Runner-reported (§12.4) — the UI labels it so. */
  diffPixelRatio: number;
  visualStatus: VisualStatusEnum;
  reasonCode?: string | null;
  functionalStatus: VisualFunctionalStatusEnum;
  /** JSON array of page JS errors, as the runner submitted it. */
  jsErrors?: string | null;
  /** JSON array of failed assertions. */
  failedAssertions?: string | null;
  /** JSON array of critical selectors that did not resolve. */
  missingCriticalSelectors?: string | null;
  durationMs?: number | null;
  reviewDecision: VisualReviewDecisionEnum;
  reviewedByAppUserId?: string | null;
  reviewedOn?: string | null;
  reviewComment?: string | null;
  createdOn: string;
}

export interface IVisualResultFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  runId?: string;
  moduleKey?: string;
  scenarioKey?: string;
  viewport?: string;
  visualStatus?: VisualStatusEnum;
  functionalStatus?: VisualFunctionalStatusEnum;
}

/** GET /VisualRegression/summary — the §10 tiles. */
export interface IVisualSummary {
  latestRunId?: string | null;
  latestRunStatus?: SystemTestRunStatusEnum | null;
  latestRunStartedOn?: string | null;
  totalResults: number;
  passCount: number;
  minorDifferenceCount: number;
  reviewRequiredCount: number;
  brokenCount: number;
  newScenarioCount: number;
  viewports: string[];
  latestBaselineApprovedOn?: string | null;
  activeExceptionCount: number;
  activeBaselineCount: number;
}

export interface IVisualBaseline {
  id: string;
  moduleKey: string;
  scenarioKey: string;
  viewport: string;
  platform: string;
  browserVersion?: string | null;
  version: number;
  fileId: string;
  fileSha256: string;
  approvedByAppUserId: string;
  approvedOn: string;
  reason: string;
  appVersion?: string | null;
  gitCommit?: string | null;
  previousBaselineId?: string | null;
  isActive: boolean;
}

export interface IVisualApproveBaselineRequest {
  /** Required — approval is an audited human decision (§10). */
  reason: string;
  appVersion?: string | null;
  gitCommit?: string | null;
}

export interface IVisualKeepBaselineRequest {
  reason: string;
}

export interface IVisualExceptionCreateRequest {
  moduleKey: string;
  scenarioKey: string;
  viewport: string;
  reason: string;
  /** Required — an exception without an expiry is a permanent waiver (§3). Date-INCLUSIVE:
   * the server normalizes it to the end of the labelled day. */
  expiresOn: string;
  ticketReference?: string | null;
  /** The result under review: the server stamps its ReviewDecision=TemporaryDifference
   * in the same SaveChanges as the exception. */
  resultId?: string | null;
}

export interface IVisualException {
  id: string;
  moduleKey: string;
  scenarioKey: string;
  viewport: string;
  reason: string;
  expiresOn: string;
  ticketReference?: string | null;
  isActive: boolean;
  isExpired: boolean;
  createdBy: string;
  createdOn: string;
}

/** GET /VisualRegression/dataset-state (§6). */
export interface IVisualDatasetState {
  purpose: SystemTestCompanyPurposeEnum;
  assetCount: number;
  categoryCount: number;
  datasetPresent: boolean;
}
