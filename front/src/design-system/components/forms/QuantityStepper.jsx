import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

const clamp = (n, min, max) => Math.min(max ?? Infinity, Math.max(min, n));

export function QuantityStepper({ value, min = 1, max, onChange, disabled, size = 'md', style, ...rest }) {
  const h = size === 'sm' ? 'var(--height-control-sm)' : 'var(--height-control)';

  const commit = (n) => {
    if (Number.isNaN(n)) return;
    onChange(clamp(n, min, max));
  };

  return (
    <div {...rest} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      <IconButton
        icon="minus"
        label="Reducir cantidad"
        size={size}
        variant="outline"
        disabled={disabled || value <= min}
        onClick={() => commit(value - 1)}
      />
      <input
        key={value}
        type="text"
        inputMode="numeric"
        defaultValue={value}
        disabled={disabled}
        onChange={(e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
        onBlur={(e) => commit(e.target.value === '' ? value : Number(e.target.value))}
        style={{
          width: 40, height: h, textAlign: 'center', flex: '0 0 auto',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-body)',
          background: disabled ? 'var(--papel-100)' : 'var(--papel-0)',
        }}
      />
      <IconButton
        icon="plus"
        label="Aumentar cantidad"
        size={size}
        variant="outline"
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => commit(value + 1)}
      />
    </div>
  );
}
