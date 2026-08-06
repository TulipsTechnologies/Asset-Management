import {
  SystemTestCompanyPurposeEnum,
  SystemTestRunItemStatusEnum,
  SystemTestRunKindEnum,
  SystemTestRunStatusEnum,
} from '@/enum/systemTestEnums';
import { ISortFilter } from '@/utils/serviceUtils';

/** One row of a run — one shape serves health findings, regression scenarios and demo steps. */
export interface ISystemTestRunItem {
  id: string;
  moduleKey: string;
  itemKey: string;
  name: string;
  status: SystemTestRunItemStatusEnum;
  /** Health findings carry "Info" | "Warning" | "Critical"; other kinds may omit it. */
  severity?: string | null;
  reasonCode?: string | null;
  recordReference?: string | null;
  expected?: string | null;
  actual?: string | null;
  recommendation?: string | null;
  message?: string | null;
  durationMs?: number | null;
  sequence: number;
  /** ReasonDetail.Values style — decimals as numbers, dates ISO (§12.8). */
  valuesJson?: string | null;
  /** Scenario key on assertion rows (§12.8). */
  groupKey?: string | null;
}

export interface ISystemTestRun {
  id: string;
  companyId: string;
  kind: SystemTestRunKindEnum;
  moduleKey?: string | null;
  status: SystemTestRunStatusEnum;
  startedOn: string;
  completedOn?: string | null;
  durationMs?: number | null;
  totalSteps: number;
  completedSteps: number;
  currentStep?: string | null;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  triggeredByAppUserId: string;
  /** The fixed instant a regression run executed under (§12.5). */
  clockInstant?: string | null;
  lastProgressOn?: string | null;
  /** Populated by GET /runs/{id}; the paged list ships runs without items. */
  items: ISystemTestRunItem[];
}

export interface ISystemTestRunFilter extends ISortFilter {
  pageNumber?: number;
  pageSize?: number;
  kind?: SystemTestRunKindEnum;
  status?: SystemTestRunStatusEnum;
  moduleKey?: string;
}

export interface ISystemTestModule {
  moduleKey: string;
  displayName: string;
}

/** GET /modules — the module dimension each capability page renders (§12.14). */
export interface ISystemTestModules {
  demoData: ISystemTestModule[];
  healthCheck: ISystemTestModule[];
  regression: ISystemTestModule[];
}

export interface ISystemTestProvisionedCompany {
  companyId: string;
  companyName: string;
  subdomain: string;
  code?: string | null;
  purpose: SystemTestCompanyPurposeEnum;
}

export interface ISystemTestEnvironment {
  /** The CURRENT company's registration, if any. */
  currentCompanyPurpose?: SystemTestCompanyPurposeEnum | null;
  provisionedCompanies: ISystemTestProvisionedCompany[];
  /** The current company's Running run, if one is in progress. */
  runningRunId?: string | null;
}

export interface ISystemTestProvisionResult {
  companies: ISystemTestProvisionedCompany[];
  notes: string[];
}

export interface ISystemTestDemoDataRequest {
  /** Null/undefined = all registered demo providers. */
  moduleKey?: string | null;
  /** True ⇒ the module's reset runs first. */
  refresh: boolean;
  /** Must equal the company's exact name. */
  confirmationPhrase: string;
  pin: string;
}

export interface ISystemTestRegressionRequest {
  moduleKey?: string | null;
  confirmationPhrase: string;
  pin: string;
}
