import React from 'react';

export function Tabs({ items=[], value, onChange, style, ...rest }) {
  return (
    <div role="tablist" {...rest} style={{
      display:'flex', alignItems:'center', gap:'var(--space-5)',
      borderBottom:'1px solid var(--border-subtle)', ...style,
    }}>
      {items.map(it => {
        const id = typeof it === 'string' ? it : it.value;
        const label = typeof it === 'string' ? it : it.label;
        const count = typeof it === 'string' ? null : it.count;
        const on = id === value;
        return (
          <button key={id} role="tab" aria-selected={on} onClick={()=>onChange&&onChange(id)}
            style={{
              display:'inline-flex', alignItems:'center', gap:6, padding:'0 0 9px',
              border:'none', background:'transparent', cursor:'pointer',
              fontFamily:'var(--font-body)', fontSize:'var(--text-sm)',
              fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              color: on ? 'var(--text-brand)' : 'var(--text-muted)',
              boxShadow: on ? 'inset 0 -2px 0 var(--pino-600)' : 'none',
              transition:'var(--transition-control)',
            }}>
            {label}
            {count != null ? (
              <span style={{
                fontSize:'var(--text-2xs)', fontFamily:'var(--font-mono)',
                color: on ? 'var(--pino-600)' : 'var(--text-subtle)',
                background: on ? 'var(--pino-50)' : 'var(--papel-100)',
                borderRadius:'var(--radius-xs)', padding:'1px 5px',
              }}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
