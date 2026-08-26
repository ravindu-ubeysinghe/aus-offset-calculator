const currency = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const currencyCents = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Whole dollars — for headline figures and axis ticks. */
export const money = (value: number): string => currency.format(value);

/** Dollars and cents — for table cells. */
export const moneyExact = (value: number): string => currencyCents.format(value);

/** $1.2M / $840K — for tight spaces like the y-axis. */
export const moneyCompact = (value: number): string =>
  Math.abs(value) >= 10_000 ? compact.format(value) : currency.format(value);

/** "3 yrs 4 mos" from a month count. */
export function duration(months: number): string {
  if (months <= 0) return 'None';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} mo${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export const todayISO = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};
