/**
 * Offset mortgage simulation.
 *
 * The model steps month by month over real calendar months, starting at the
 * current month (month 1). Within a month:
 *
 *   1. Interest accrues daily on `max(loan - offset, 0)` using the opening
 *      balances, for the actual number of days in that calendar month.
 *   2. Lump sums land, then expenses are drawn down, then the monthly
 *      contribution is added to the offset account.
 *   3. The repayment is applied: interest is covered first, the remainder
 *      reduces principal.
 *
 * A parallel baseline runs the same loan with no offset account at all, which
 * is what "interest saved" and "time saved" are measured against.
 */

export interface DatedAmount {
  id: string;
  amount: string;
  date: string;
}

export interface CalcInputs {
  loanBalance: string;
  monthlyRepayment: string;
  annualInterestRate: string;
  years: string;
  startingOffset: string;
  contributions: DatedAmount[];
  lumps: DatedAmount[];
  expenses: DatedAmount[];
}

export interface MonthRow {
  /** 1-based month number; month 1 is the current calendar month. */
  month: number;
  /** First day of the calendar month this row represents. */
  date: Date;
  /** e.g. "Aug 2026" */
  label: string;
  monthName: string;
  year: number;
  daysInMonth: number;
  openingLoan: number;
  interestPaid: number;
  principalReduction: number;
  closingLoan: number;
  /** Offset balance at the end of the month. */
  offsetBalance: number;
  /** Movements into/out of the offset account during this month. */
  contribution: number;
  lumpSum: number;
  expense: number;
  /** Interest the same month would have cost with no offset account. */
  baselineInterest: number;
  cumulativeInterestSaved: number;
}

export interface CalcResult {
  rows: MonthRow[];
  totalInterestPaid: number;
  baselineTotalInterest: number;
  totalInterestSaved: number;
  remainingLoan: number;
  finalOffset: number;
  totalContributed: number;
  /** Month number the loan is cleared in, or null if not within the term. */
  payoffMonth: number | null;
  payoffLabel: string | null;
  /** Baseline payoff month with no offset (may run past the term). */
  baselinePayoffMonth: number | null;
  baselinePayoffLabel: string | null;
  /** Months earlier the loan clears thanks to the offset, or null if unknown. */
  monthsSaved: number | null;
  warnings: string[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** How far the no-offset baseline is allowed to run when hunting for payoff. */
const BASELINE_MONTH_CAP = 1200;

/** First day of the current calendar month — the anchor for month 1. */
export function currentAnchor(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Calendar month that month number `n` (1-based) falls in. */
export function monthDate(anchor: Date, n: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + (n - 1), 1);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function formatMonthLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Parse a `YYYY-MM-DD` value from a date input as a *local* date. `new Date(s)`
 * would read it as UTC and shift it a day for anyone west of Greenwich.
 */
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Which 1-based month number a date falls in, by calendar month rather than by
 * counting elapsed days. Anything already in the past clamps to month 1.
 */
export function monthNumberFor(anchor: Date, value: string): number | null {
  const date = parseLocalDate(value);
  if (!date) return null;
  const diff =
    (date.getFullYear() - anchor.getFullYear()) * 12 +
    (date.getMonth() - anchor.getMonth());
  return Math.max(1, diff + 1);
}

interface ScheduledAmount {
  month: number;
  amount: number;
}

function toScheduled(items: DatedAmount[], anchor: Date): ScheduledAmount[] {
  return items
    .map((item) => {
      const amount = Number(item.amount);
      if (!item.amount || !item.date || !Number.isFinite(amount) || amount === 0) {
        return null;
      }
      const month = monthNumberFor(anchor, item.date);
      return month === null ? null : { month, amount };
    })
    .filter((x): x is ScheduledAmount => x !== null)
    .sort((a, b) => a.month - b.month);
}

/** Sum of every scheduled amount landing in a given month. */
function amountIn(schedule: ScheduledAmount[], month: number): number {
  let total = 0;
  for (const entry of schedule) {
    if (entry.month === month) total += entry.amount;
  }
  return total;
}

/**
 * Amortise a loan with no offset account, to measure the offset against.
 * Returns total interest over `horizonMonths` plus the month it clears in.
 */
function runBaseline(
  loan: number,
  repayment: number,
  dailyRate: number,
  anchor: Date,
  horizonMonths: number,
): { interestByMonth: number[]; totalInterest: number; payoffMonth: number | null } {
  const interestByMonth: number[] = [];
  let balance = loan;
  let totalInterest = 0;
  let payoffMonth: number | null = null;

  for (let month = 1; month <= BASELINE_MONTH_CAP; month++) {
    const days = daysInMonth(monthDate(anchor, month));
    const interest = balance * dailyRate * days;
    const principal = Math.max(repayment - interest, 0);

    if (month <= horizonMonths) {
      interestByMonth.push(interest);
      totalInterest += interest;
    }
    balance = Math.max(balance - principal, 0);

    if (balance <= 0) {
      payoffMonth = month;
      // Nothing accrues after payoff, so the rest of the horizon is zeroes.
      while (interestByMonth.length < horizonMonths) interestByMonth.push(0);
      break;
    }
    // The repayment never covers the interest, so this loan never clears. Keep
    // accruing until the horizon is filled, then stop — there is no payoff.
    if (principal <= 0 && month >= horizonMonths) break;
  }

  return { interestByMonth, totalInterest, payoffMonth };
}

export function calculate(inputs: CalcInputs, now: Date = new Date()): CalcResult | null {
  const startingLoan = Number(inputs.loanBalance) || 0;
  const monthlyRepayment = Number(inputs.monthlyRepayment) || 0;
  const annualRate = Number(inputs.annualInterestRate) || 0;
  const years = Number(inputs.years) || 0;
  const startingOffset = Number(inputs.startingOffset) || 0;

  if (startingLoan <= 0 || years <= 0) return null;

  const anchor = currentAnchor(now);
  const totalMonths = Math.max(1, Math.round(years * 12));
  const dailyRate = annualRate / 100 / 365;

  const lumps = toScheduled(inputs.lumps, anchor);
  const expenses = toScheduled(inputs.expenses, anchor);
  // Contributions are a step function: each entry sets the recurring monthly
  // amount from its start month onward, replacing the previous amount.
  const contributionSteps = toScheduled(inputs.contributions, anchor);

  const baseline = runBaseline(startingLoan, monthlyRepayment, dailyRate, anchor, totalMonths);

  let loan = startingLoan;
  let offset = startingOffset;
  let totalInterestPaid = 0;
  let cumulativeInterestSaved = 0;
  let totalContributed = 0;
  let payoffMonth: number | null = null;

  const rows: MonthRow[] = [];

  for (let month = 1; month <= totalMonths && loan > 0; month++) {
    const date = monthDate(anchor, month);
    const days = daysInMonth(date);
    const openingLoan = loan;

    const effectiveLoan = Math.max(loan - offset, 0);
    const interestPaid = effectiveLoan * dailyRate * days;

    const lumpSum = amountIn(lumps, month);
    offset += lumpSum;

    const expense = amountIn(expenses, month);
    const appliedExpense = Math.min(expense, offset);
    offset = Math.max(offset - expense, 0);

    // Most recent contribution step at or before this month wins.
    let contribution = 0;
    for (const step of contributionSteps) {
      if (step.month <= month) contribution = step.amount;
    }
    offset += contribution;
    totalContributed += contribution;

    const principalReduction = Math.max(monthlyRepayment - interestPaid, 0);
    loan = Math.max(loan - principalReduction, 0);

    const baselineInterest = baseline.interestByMonth[month - 1] ?? 0;
    totalInterestPaid += interestPaid;
    cumulativeInterestSaved += baselineInterest - interestPaid;

    if (loan <= 0 && payoffMonth === null) payoffMonth = month;

    rows.push({
      month,
      date,
      label: formatMonthLabel(date),
      monthName: MONTH_NAMES[date.getMonth()],
      year: date.getFullYear(),
      daysInMonth: days,
      openingLoan,
      interestPaid,
      principalReduction,
      closingLoan: loan,
      offsetBalance: offset,
      contribution,
      lumpSum,
      expense: appliedExpense,
      baselineInterest,
      cumulativeInterestSaved,
    });
  }

  const warnings: string[] = [];
  const firstRow = rows[0];
  if (firstRow && firstRow.principalReduction <= 0) {
    warnings.push(
      'The monthly repayment does not cover the first month of interest, so the loan balance never reduces. Increase the repayment or lower the rate.',
    );
  }
  if (monthlyRepayment <= 0) {
    warnings.push('No monthly repayment entered, so nothing is paid off.');
  }

  const monthsSaved =
    payoffMonth !== null && baseline.payoffMonth !== null
      ? Math.max(0, baseline.payoffMonth - payoffMonth)
      : null;

  return {
    rows,
    totalInterestPaid,
    baselineTotalInterest: baseline.totalInterest,
    totalInterestSaved: baseline.totalInterest - totalInterestPaid,
    remainingLoan: loan,
    finalOffset: offset,
    totalContributed,
    payoffMonth,
    payoffLabel: payoffMonth !== null ? formatMonthLabel(monthDate(anchor, payoffMonth)) : null,
    baselinePayoffMonth: baseline.payoffMonth,
    baselinePayoffLabel:
      baseline.payoffMonth !== null
        ? formatMonthLabel(monthDate(anchor, baseline.payoffMonth))
        : null,
    monthsSaved,
    warnings,
  };
}
