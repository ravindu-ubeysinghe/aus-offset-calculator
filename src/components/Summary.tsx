import type { CalcResult } from '../lib/calc';
import { duration, money } from '../lib/format';

interface SummaryProps {
  result: CalcResult;
}

/**
 * Spell out what the saving is measured against. The two scenarios run for
 * different lengths of time — that is the whole point — so naming both end
 * dates keeps the headline from looking inconsistent with the schedule below,
 * which only runs as far as the offset loan does.
 */
function comparison(result: CalcResult): string {
  const { payoffLabel, baselinePayoffLabel } = result;

  if (payoffLabel && baselinePayoffLabel) {
    return `Your loan clears in ${payoffLabel}. The same loan and repayment with no offset account would run until ${baselinePayoffLabel}.`;
  }
  if (payoffLabel) {
    return `Your loan clears in ${payoffLabel}. The same loan with no offset account would not clear within the term.`;
  }
  return `Measured against the same loan and repayment with no offset account, over the full ${duration(result.rows.length).toLowerCase()} shown below.`;
}

export function Summary({ result }: SummaryProps) {
  const tiles: Array<{ label: string; value: string; muted?: boolean }> = [
    { label: 'Interest paid', value: money(result.totalInterestPaid) },
    { label: 'Interest without offset', value: money(result.baselineTotalInterest), muted: true },
    {
      label: 'Loan cleared',
      value: result.payoffLabel ?? 'Not within term',
      muted: result.payoffLabel === null,
    },
    { label: 'Remaining balance', value: money(result.remainingLoan) },
    { label: 'Final offset balance', value: money(result.finalOffset) },
    { label: 'Total contributed', value: money(result.totalContributed), muted: true },
  ];

  return (
    <>
      <section className="card hero">
        <p className="hero__label">Total interest saved</p>
        <p className="hero__value">{money(result.totalInterestSaved)}</p>
        <p className="hero__note">{comparison(result)}</p>
        {result.monthsSaved !== null && result.monthsSaved > 0 && (
          <span className="hero__badge">
            Paid off {duration(result.monthsSaved).toLowerCase()} sooner
          </span>
        )}
      </section>

      <div className="tiles">
        {tiles.map((tile) => (
          <div className="tile" key={tile.label}>
            <p className="tile__label">{tile.label}</p>
            <p className={`tile__value${tile.muted ? ' tile__value--muted' : ''}`}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
