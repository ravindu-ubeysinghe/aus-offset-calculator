import { useMemo, useState } from 'react';
import type { MonthRow } from '../lib/calc';
import { moneyExact } from '../lib/format';
import { DownloadIcon } from './icons';
import { saveTextFile, slugify } from '../lib/download';

interface ScheduleTableProps {
  rows: MonthRow[];
  profileName: string;
}

type Grouping = 'monthly' | 'yearly';

interface DisplayRow {
  key: string;
  primary: string;
  secondary: string;
  openingLoan: number;
  interestPaid: number;
  principalReduction: number;
  closingLoan: number;
  offsetBalance: number;
  cumulativeInterestSaved: number;
}

/** Roll the monthly schedule up into calendar years. */
function byYear(rows: MonthRow[]): DisplayRow[] {
  const groups = new Map<number, MonthRow[]>();
  for (const row of rows) {
    const bucket = groups.get(row.year);
    if (bucket) bucket.push(row);
    else groups.set(row.year, [row]);
  }

  return [...groups.entries()].map(([year, months]) => {
    const first = months[0];
    const last = months[months.length - 1];
    return {
      key: String(year),
      primary: String(year),
      secondary: `${first.monthName}–${last.monthName} · ${months.length} mo`,
      openingLoan: first.openingLoan,
      interestPaid: months.reduce((sum, m) => sum + m.interestPaid, 0),
      principalReduction: months.reduce((sum, m) => sum + m.principalReduction, 0),
      closingLoan: last.closingLoan,
      offsetBalance: last.offsetBalance,
      cumulativeInterestSaved: last.cumulativeInterestSaved,
    };
  });
}

function byMonth(rows: MonthRow[]): DisplayRow[] {
  return rows.map((row) => ({
    key: String(row.month),
    primary: row.label,
    secondary: `Month ${row.month}`,
    openingLoan: row.openingLoan,
    interestPaid: row.interestPaid,
    principalReduction: row.principalReduction,
    closingLoan: row.closingLoan,
    offsetBalance: row.offsetBalance,
    cumulativeInterestSaved: row.cumulativeInterestSaved,
  }));
}

function toCsv(rows: MonthRow[]): string {
  const header = [
    'Month #', 'Month', 'Year', 'Opening loan', 'Interest paid',
    'Principal reduction', 'Closing loan', 'Offset balance',
    'Contribution', 'Lump sum', 'Expense', 'Cumulative interest saved',
  ];
  const body = rows.map((row) => [
    row.month, row.monthName, row.year,
    row.openingLoan.toFixed(2), row.interestPaid.toFixed(2),
    row.principalReduction.toFixed(2), row.closingLoan.toFixed(2),
    row.offsetBalance.toFixed(2), row.contribution.toFixed(2),
    row.lumpSum.toFixed(2), row.expense.toFixed(2),
    row.cumulativeInterestSaved.toFixed(2),
  ].join(','));
  return [header.join(','), ...body].join('\n');
}

function exportCsv(rows: MonthRow[], profileName: string) {
  const stem = slugify(profileName, 'offset');
  void saveTextFile(`${stem}-schedule.csv`, toCsv(rows));
}

export function ScheduleTable({ rows, profileName }: ScheduleTableProps) {
  const [grouping, setGrouping] = useState<Grouping>('monthly');

  const display = useMemo(
    () => (grouping === 'yearly' ? byYear(rows) : byMonth(rows)),
    [rows, grouping],
  );

  return (
    <section className="card">
      <header className="card__head card__head--controls" style={{ paddingBottom: 14 }}>
        <h2 className="card__title">Loan status</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
          <div className="segmented" role="group" aria-label="Table grouping">
            <button
              type="button"
              className="segmented__btn"
              aria-pressed={grouping === 'monthly'}
              onClick={() => setGrouping('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className="segmented__btn"
              aria-pressed={grouping === 'yearly'}
              onClick={() => setGrouping('yearly')}
            >
              Yearly
            </button>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => exportCsv(rows, profileName)}
            title="Export the monthly schedule as CSV"
          >
            <DownloadIcon /> CSV
          </button>
        </div>
      </header>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{grouping === 'yearly' ? 'Year' : 'Month'}</th>
              <th scope="col">Opening loan</th>
              <th scope="col">Interest paid</th>
              <th scope="col">Principal paid</th>
              <th scope="col">Closing loan</th>
              <th scope="col">Offset balance</th>
              <th scope="col">Interest saved</th>
            </tr>
          </thead>
          <tbody>
            {display.map((row) => (
              <tr key={row.key}>
                <th scope="row" style={{ position: 'sticky', left: 0 }}>
                  <span className="cell-month">
                    <span className="cell-month__label">{row.primary}</span>
                    <span className="cell-month__n">{row.secondary}</span>
                  </span>
                </th>
                <td>{moneyExact(row.openingLoan)}</td>
                <td>{moneyExact(row.interestPaid)}</td>
                <td>{moneyExact(row.principalReduction)}</td>
                <td>{moneyExact(row.closingLoan)}</td>
                <td>{moneyExact(row.offsetBalance)}</td>
                <td className="cell-saved">{moneyExact(row.cumulativeInterestSaved)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table__footer">
        <span>
          {display.length} {grouping === 'yearly' ? 'years' : 'months'} · {rows[0]?.label} to{' '}
          {rows[rows.length - 1]?.label}
        </span>
        <span>Scroll sideways for every column</span>
      </div>
    </section>
  );
}
