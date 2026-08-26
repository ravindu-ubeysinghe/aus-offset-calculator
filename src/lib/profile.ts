/**
 * Reading and writing a loan profile as CSV.
 *
 * The file is a uniform four-column table — `Section, Field, Value, Date` — so
 * it opens cleanly in a spreadsheet even though the underlying data is not
 * really tabular (scalar settings plus three lists of dated amounts). The
 * Section column is what tells the two shapes apart on the way back in.
 */

import { parseCsv, toCsv, withoutBlankRows } from './csv';
import { DEFAULT_STATE, newItem, type Profile } from './state';
import type { DatedAmount } from './calc';

export const PROFILE_CSV_HEADER = ['Section', 'Field', 'Value', 'Date'];

/** The keys of `Profile` that hold a plain string rather than a list. */
type ScalarKey =
  | 'name'
  | 'loanBalance'
  | 'monthlyRepayment'
  | 'annualInterestRate'
  | 'years'
  | 'startingOffset';

/** Scalar fields, in file order. Field labels are the on-disk contract. */
const SCALARS: Array<{ section: string; field: string; key: ScalarKey }> = [
  { section: 'Profile', field: 'Name', key: 'name' },
  { section: 'Loan', field: 'Loan balance', key: 'loanBalance' },
  { section: 'Loan', field: 'Monthly repayment', key: 'monthlyRepayment' },
  { section: 'Loan', field: 'Annual interest rate', key: 'annualInterestRate' },
  { section: 'Loan', field: 'Term (years)', key: 'years' },
  { section: 'Offset', field: 'Starting balance', key: 'startingOffset' },
];

const LIST_SECTIONS: Record<string, 'contributions' | 'lumps' | 'expenses'> = {
  contribution: 'contributions',
  'monthly contribution': 'contributions',
  'lump sum': 'lumps',
  lump: 'lumps',
  expense: 'expenses',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ProfileParseError extends Error {}

export interface ImportResult {
  profile: Profile;
  /** Rows that were understood but had to be dropped, for the user to see. */
  skipped: string[];
}

export function profileToCsv(profile: Profile): string {
  const rows: Array<Array<string | number>> = [PROFILE_CSV_HEADER];

  for (const { section, field, key } of SCALARS) {
    rows.push([section, field, String(profile[key] ?? ''), '']);
  }
  for (const item of profile.contributions) {
    rows.push(['Contribution', '', item.amount, item.date]);
  }
  for (const item of profile.lumps) {
    rows.push(['Lump sum', '', item.amount, item.date]);
  }
  for (const item of profile.expenses) {
    rows.push(['Expense', '', item.amount, item.date]);
  }

  return toCsv(rows);
}

/** Keep a value only if it reads as a number; anything else is not an amount. */
function numericOrNull(value: string): string | null {
  if (value.trim() === '') return null;
  const cleaned = value.replace(/[$,\s]/g, '');
  return Number.isFinite(Number(cleaned)) ? cleaned : null;
}

export function csvToProfile(text: string): ImportResult {
  const rows = withoutBlankRows(parseCsv(text));
  if (rows.length === 0) {
    throw new ProfileParseError('That file is empty.');
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  if (header[0] !== 'section' || header[1] !== 'field') {
    throw new ProfileParseError(
      'That does not look like a profile CSV. Export a profile first to see the expected columns.',
    );
  }

  const profile: Profile = {
    ...DEFAULT_STATE,
    contributions: [],
    lumps: [],
    expenses: [],
  };
  const skipped: string[] = [];
  let matched = 0;

  rows.slice(1).forEach((row, index) => {
    const lineNumber = index + 2; // 1-based, and past the header
    const section = (row[0] ?? '').trim().toLowerCase();
    const field = (row[1] ?? '').trim().toLowerCase();
    const value = (row[2] ?? '').trim();
    const date = (row[3] ?? '').trim();

    const listKey = LIST_SECTIONS[section];
    if (listKey) {
      const amount = numericOrNull(value);
      if (amount === null) {
        skipped.push(`Line ${lineNumber}: "${value}" is not an amount.`);
        return;
      }
      // Spreadsheet apps love to rewrite dates. Rather than guess whether
      // 03/04/2027 is March or April, say so and let the user fix the file.
      if (!ISO_DATE.test(date)) {
        skipped.push(`Line ${lineNumber}: date "${date}" is not YYYY-MM-DD.`);
        return;
      }
      const item: DatedAmount = { ...newItem(), amount, date };
      profile[listKey].push(item);
      matched++;
      return;
    }

    const scalar = SCALARS.find(
      (entry) => entry.section.toLowerCase() === section && entry.field.toLowerCase() === field,
    );
    if (!scalar) return; // Unknown row — ignore it rather than fail the import.

    if (scalar.key === 'name') {
      profile.name = value;
    } else {
      const amount = numericOrNull(value);
      if (amount === null) {
        if (value !== '') skipped.push(`Line ${lineNumber}: "${value}" is not a number.`);
        return;
      }
      profile[scalar.key] = amount;
    }
    matched++;
  });

  if (matched === 0) {
    throw new ProfileParseError('No profile rows were recognised in that file.');
  }

  return { profile, skipped };
}
