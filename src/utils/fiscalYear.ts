import { IUpsertFiscalPeriod } from '@/interface/IDepreciation';

/** Bikram Sambat months in fiscal order — the year opens in Shrawan. */
export const BS_MONTHS = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra', 'Baisakh', 'Jestha', 'Ashadh',
];

/** Throws on an invalid Date — every caller below guards its inputs first. */
const iso = (date: Date) => date.toISOString().slice(0, 10);

const isValid = (date: Date) => !Number.isNaN(date.getTime());

/**
 * Twelve period drafts from a year-start date, using 31/30 alternation.
 *
 * A STARTING POINT ONLY. Real Bikram Sambat months run 29–32 days and are fixed
 * astronomically from the published patro — there is no closed form, which is exactly why
 * the backend refuses to generate periods and demands them explicitly. Every date these
 * produce stays editable, and must be checked against the patro before the figures matter.
 */
export const draftFiscalPeriods = (startDate: string): IUpsertFiscalPeriod[] => {
  const drafts: IUpsertFiscalPeriod[] = [];
  let cursor = new Date(startDate);
  // A partially-typed date is not a year to draft — return nothing rather than throw
  // "Invalid time value" from inside the drafting arithmetic.
  if (!isValid(cursor)) return drafts;

  for (let i = 0; i < 12; i++) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + (i % 2 === 0 ? 31 : 30) - 1);
    drafts.push({
      periodOrdinal: i + 1,
      monthName: BS_MONTHS[i],
      startDate: iso(start),
      endDate: iso(end),
    });
    cursor = new Date(end);
    cursor.setDate(cursor.getDate() + 1);
  }

  return drafts;
};

/** "2083/84" from 2083. */
export const fiscalYearCode = (startYear: number) =>
  `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;

/** The BS start year a code opens with: "2083/84" → 2083. */
export const fiscalYearStartYear = (code: string) => Number(code.trim().slice(0, 4));

export interface IDraftedFiscalYear {
  code: string;
  startDate: string;
  endDate: string;
  periods: IUpsertFiscalPeriod[];
}

/**
 * Drafts `count` fiscal years running BACKWARDS from an existing one, each ending the day
 * before the next begins.
 *
 * Chained from a real year rather than computed from a Gregorian date, because the module
 * has no Gregorian-to-BS conversion — anchoring on a year that already exists keeps the
 * sequence contiguous and the codes correct, which a date-derived guess would not.
 * Returned oldest-first so they can be created in calendar order.
 */
export const draftEarlierFiscalYears = (
  earliestCode: string,
  earliestStartDate: string,
  count: number
): IDraftedFiscalYear[] => {
  const years: IDraftedFiscalYear[] = [];
  const startYear = fiscalYearStartYear(earliestCode);
  let nextStart = new Date(earliestStartDate);
  if (!isValid(nextStart) || !Number.isFinite(startYear) || count < 1 || count > 100)
    return years;

  for (let back = 1; back <= count; back++) {
    // Step back a year, then let the drafted months decide the real end date so the new
    // year finishes exactly the day before the one after it.
    const provisionalStart = new Date(nextStart);
    provisionalStart.setFullYear(provisionalStart.getFullYear() - 1);

    const periods = draftFiscalPeriods(iso(provisionalStart));
    // Pull the whole year so its last day is the day before the following year opens.
    const drift =
      (new Date(periods[11].endDate).getTime() -
        new Date(iso(new Date(nextStart.getTime() - 86400000))).getTime()) /
      86400000;

    const correctedStart = new Date(provisionalStart);
    correctedStart.setDate(correctedStart.getDate() - drift);
    const corrected = draftFiscalPeriods(iso(correctedStart));

    years.unshift({
      code: fiscalYearCode(startYear - back),
      startDate: corrected[0].startDate,
      endDate: corrected[11].endDate,
      periods: corrected,
    });

    nextStart = new Date(corrected[0].startDate);
  }

  return years;
};
