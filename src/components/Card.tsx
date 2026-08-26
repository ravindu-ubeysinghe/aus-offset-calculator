import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  hint?: ReactNode;
  children: ReactNode;
  /** Render children flush, without the padded body wrapper. */
  flush?: boolean;
  className?: string;
}

export function Card({ title, hint, children, flush, className }: CardProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      {(title || hint) && (
        <header className="card__head">
          {title && <h2 className="card__title">{title}</h2>}
          {hint && <div className="card__hint">{hint}</div>}
        </header>
      )}
      {flush ? children : <div className="card__body">{children}</div>}
    </section>
  );
}
