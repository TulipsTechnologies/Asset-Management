export interface IReportDescriptor {
  code: string;
  name: string;
  description: string;
  isPaginated: boolean;
  supportsDateRange: boolean;
  supportsFiscalYear: boolean;
  supportsDimension: boolean;
}

export interface IReportFilter {
  pageNumber?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  fiscalYearCode?: string;
  dimension?: string;
}
