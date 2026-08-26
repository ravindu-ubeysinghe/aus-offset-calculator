import type { DatedAmount } from '../lib/calc';
import { PlusIcon, TrashIcon } from './icons';

interface ItemListProps {
  items: DatedAmount[];
  onChange: (id: string, key: 'amount' | 'date', value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel: string;
  emptyLabel: string;
  dateLabel: string;
}

export function ItemList({
  items,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  emptyLabel,
  dateLabel,
}: ItemListProps) {
  return (
    <>
      {items.length === 0 ? (
        <p className="items__empty">{emptyLabel}</p>
      ) : (
        <div className="items">
          {items.map((item, index) => (
            <div className="item" key={item.id}>
              <div className="field__control">
                <span className="field__prefix">$</span>
                <input
                  className="input input--prefixed"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="Amount"
                  aria-label={`Amount for entry ${index + 1}`}
                  value={item.amount}
                  onChange={(event) => onChange(item.id, 'amount', event.target.value)}
                />
              </div>
              <input
                className="input"
                type="date"
                aria-label={`${dateLabel} for entry ${index + 1}`}
                value={item.date}
                onChange={(event) => onChange(item.id, 'date', event.target.value)}
              />
              <button
                type="button"
                className="btn btn--icon btn--danger"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove entry ${index + 1}`}
                title="Remove"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn items__add" onClick={onAdd} style={{ width: '100%' }}>
        <PlusIcon /> {addLabel}
      </button>
    </>
  );
}
