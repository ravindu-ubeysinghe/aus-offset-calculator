import type { CalcInputs, DatedAmount } from './calc';

export type ItemKey = 'contributions' | 'lumps' | 'expenses';

/**
 * A saved set of inputs. `name` is not part of the simulation — it exists so a
 * profile stays identifiable once you have several of them exported as files.
 */
export interface Profile extends CalcInputs {
  name: string;
}

export const DEFAULT_STATE: Profile = {
  name: '',
  loanBalance: '',
  monthlyRepayment: '',
  annualInterestRate: '',
  years: '',
  startingOffset: '',
  contributions: [],
  lumps: [],
  expenses: [],
};

export const SAMPLE_STATE: Profile = {
  name: 'Example home loan',
  loanBalance: '650000',
  monthlyRepayment: '4300',
  annualInterestRate: '6.1',
  years: '25',
  startingOffset: '25000',
  contributions: [],
  lumps: [],
  expenses: [],
};

export function newItem(): DatedAmount {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, amount: '', date: '' };
}

/**
 * Accept whatever was in storage and coerce it into a valid state. Entries
 * saved by the original calculator have no `id` and used `startDate`/`date`
 * key names, so migrate those rather than dropping them.
 */
export function migrate(raw: unknown): Profile {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  const source = raw as Record<string, unknown>;

  const text = (key: string): string => {
    const value = source[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  };

  const items = (key: string): DatedAmount[] => {
    const value = source[key];
    if (!Array.isArray(value)) return [];
    return value.map((entry) => {
      const item = (entry ?? {}) as Record<string, unknown>;
      const date = item.date ?? item.startDate;
      return {
        id: typeof item.id === 'string' ? item.id : newItem().id,
        amount: item.amount === undefined || item.amount === null ? '' : String(item.amount),
        date: typeof date === 'string' ? date : '',
      };
    });
  };

  return {
    name: text('name'),
    loanBalance: text('loanBalance'),
    monthlyRepayment: text('monthlyRepayment'),
    annualInterestRate: text('annualInterestRate'),
    years: text('years'),
    startingOffset: text('startingOffset'),
    contributions: items('contributions'),
    lumps: items('lumps'),
    expenses: items('expenses'),
  };
}
