import React from 'react';

export function SegmentedControl({ options=[], value, onChange, disabled, size='md', style, ...rest }) {
  const h = size === 'sm' ? 'var(--height-control-sm)' : 'var(--height-control)';
  return (
    <div role="radiogroup" {...rest} style={{
      display: 'inline-flex', width: '100%', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)', overflow: 'hidden', ...style,
    }}>
      {options.map((o, i) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        const on = v === value;
        return (
          <button key={v} type="button" role="radio" aria-checked={on} disabled={disabled}
            onClick={() => onChange && onChange(v)}
            style={{
              flex: 1, height: h, padding: '0 14px',
              border: 'none', borderLeft: i > 0 ? '1px solid ' + (on ? 'var(--pino-600)' : 'var(--border-default)') : 'none',
              background: on ? 'var(--pino-600)' : 'var(--papel-0)',
              color: on ? 'var(--papel-0)' : 'var(--text-body)',
              fontFamily: 'var(--font-body)', fontSize: size === 'sm' ? 'var(--text-xs)' : 'var(--text-sm)',
              fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
              transition: 'var(--transition-control)',
            }}>{l}</button>
        );
      })}
    </div>
  );
}
