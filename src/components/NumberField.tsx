import { useId } from 'react';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  min?: string;
  placeholder?: string;
  help?: string;
  inputMode?: 'decimal' | 'numeric';
}

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step,
  min = '0',
  placeholder,
  help,
  inputMode = 'decimal',
}: NumberFieldProps) {
  const id = useId();
  const helpId = `${id}-help`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <div className="field__control">
        {prefix && <span className="field__prefix">{prefix}</span>}
        <input
          id={id}
          className={[
            'input',
            prefix ? 'input--prefixed' : '',
            suffix ? 'input--suffixed' : '',
          ].filter(Boolean).join(' ')}
          type="number"
          inputMode={inputMode}
          step={step}
          min={min}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={help ? helpId : undefined}
        />
        {suffix && <span className="field__suffix">{suffix}</span>}
      </div>
      {help && <p className="field__help" id={helpId}>{help}</p>}
    </div>
  );
}
