import { useCallback, useEffect, useMemo, useState } from 'react';
import { calculate, type DatedAmount } from './lib/calc';
import { loadState, saveState } from './lib/storage';
import { DEFAULT_STATE, migrate, newItem, SAMPLE_STATE, type ItemKey, type Profile } from './lib/state';
import { applyTheme, readTheme, resolveTheme, type Theme } from './lib/theme';
import { formatMonthLabel, currentAnchor } from './lib/calc';
import { Card } from './components/Card';
import { NumberField } from './components/NumberField';
import { ItemList } from './components/ItemList';
import { ProfileCard } from './components/ProfileCard';
import { Summary } from './components/Summary';
import { BalanceChart } from './components/BalanceChart';
import { ScheduleTable } from './components/ScheduleTable';
import { MoonIcon, ResetIcon, SunIcon, WarningIcon } from './components/icons';

export default function App() {
  const [state, setState] = useState<Profile>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  // Restore saved inputs once, then let every later change write through.
  useEffect(() => {
    let cancelled = false;
    void loadState<unknown>().then((saved) => {
      if (cancelled) return;
      if (saved) setState(migrate(saved));
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setField = useCallback(
    (key: 'loanBalance' | 'monthlyRepayment' | 'annualInterestRate' | 'years' | 'startingOffset' | 'name',
     value: string) => setState((current) => ({ ...current, [key]: value })),
    [],
  );

  const addItem = useCallback(
    (key: ItemKey) =>
      setState((current) => ({ ...current, [key]: [...current[key], newItem()] })),
    [],
  );

  const removeItem = useCallback(
    (key: ItemKey, id: string) =>
      setState((current) => ({
        ...current,
        [key]: current[key].filter((item) => item.id !== id),
      })),
    [],
  );

  const changeItem = useCallback(
    (key: ItemKey, id: string, field: 'amount' | 'date', value: string) =>
      setState((current) => ({
        ...current,
        [key]: current[key].map((item: DatedAmount) =>
          item.id === id ? { ...item, [field]: value } : item,
        ),
      })),
    [],
  );

  const result = useMemo(() => calculate(state), [state]);

  const startLabel = useMemo(() => formatMonthLabel(currentAnchor()), []);
  const isDark = resolveTheme(theme) === 'dark';

  const itemProps = (key: ItemKey) => ({
    items: state[key],
    onAdd: () => addItem(key),
    onRemove: (id: string) => removeItem(key, id),
    onChange: (id: string, field: 'amount' | 'date', value: string) =>
      changeItem(key, id, field, value),
  });

  return (
    <div className="app">
      <header className="appbar">
        <span className="appbar__mark" aria-hidden="true">$</span>
        <div className="appbar__titles">
          <h1 className="appbar__title">{state.name?.trim() || 'Offset Calculator'}</h1>
          <p className="appbar__subtitle">Month 1 starts {startLabel}</p>
        </div>
        <div className="appbar__actions">
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            type="button"
            className="btn btn--icon btn--ghost"
            onClick={() => setState(DEFAULT_STATE)}
            aria-label="Clear all inputs"
            title="Clear all inputs"
          >
            <ResetIcon />
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="layout__inputs">
          <ProfileCard
            profile={state}
            onNameChange={(value) => setField('name', value)}
            onImport={setState}
          />

          <Card title="Loan">
            <NumberField
              label="Loan balance"
              prefix="$"
              value={state.loanBalance}
              onChange={(value) => setField('loanBalance', value)}
              placeholder="650,000"
            />
            <NumberField
              label="Monthly repayment"
              prefix="$"
              value={state.monthlyRepayment}
              onChange={(value) => setField('monthlyRepayment', value)}
              placeholder="4,300"
            />
            <NumberField
              label="Annual interest rate"
              suffix="%"
              step="0.01"
              value={state.annualInterestRate}
              onChange={(value) => setField('annualInterestRate', value)}
              placeholder="6.10"
            />
            <NumberField
              label="Term"
              suffix="yrs"
              step="0.5"
              value={state.years}
              onChange={(value) => setField('years', value)}
              placeholder="25"
            />
          </Card>

          <Card title="Offset account">
            <NumberField
              label="Starting offset balance"
              prefix="$"
              value={state.startingOffset}
              onChange={(value) => setField('startingOffset', value)}
              placeholder="25,000"
              help="Interest is charged on the loan balance minus this amount."
            />
          </Card>

          <Card
            title="Monthly contributions"
            hint="Step changes"
          >
            <p className="field__help" style={{ marginTop: 0, marginBottom: 12 }}>
              Each entry sets the recurring monthly amount from its start date onward,
              replacing the previous one.
            </p>
            <ItemList
              {...itemProps('contributions')}
              addLabel="Add contribution"
              dateLabel="Start date"
              emptyLabel="No recurring contributions yet."
            />
          </Card>

          <Card title="Lump sums" hint="One-off deposits">
            <ItemList
              {...itemProps('lumps')}
              addLabel="Add lump sum"
              dateLabel="Date"
              emptyLabel="No lump sums yet."
            />
          </Card>

          <Card title="Expenses" hint="One-off withdrawals">
            <ItemList
              {...itemProps('expenses')}
              addLabel="Add expense"
              dateLabel="Date"
              emptyLabel="No expenses yet."
            />
          </Card>
        </div>

        <div className="layout__results">
          {result === null ? (
            <div className="empty">
              <p className="empty__title">Nothing to project yet</p>
              <p className="empty__body">
                Enter a loan balance and a term to see the interest you would save,
                a balance projection, and a month-by-month schedule.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => setState(SAMPLE_STATE)}
              >
                Load an example
              </button>
            </div>
          ) : (
            <>
              {result.warnings.map((warning) => (
                <div className="notice" key={warning} role="status">
                  <span className="notice__icon"><WarningIcon /></span>
                  <span>{warning}</span>
                </div>
              ))}

              <Summary result={result} />

              <Card title="Balance projection" hint="Tap or hover for a month">
                <BalanceChart rows={result.rows} />
              </Card>

              <ScheduleTable rows={result.rows} profileName={state.name} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
