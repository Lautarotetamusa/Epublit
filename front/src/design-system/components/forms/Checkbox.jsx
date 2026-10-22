import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Checkbox({ label, checked, indeterminate, disabled, onChange, style, ...rest }) {
  const on = checked || indeterminate;
  return (
    <label {...rest} style={{display:'inline-flex',alignItems:'center',gap:9,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.55:1,...style}}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={onChange}
        style={{position:'absolute',opacity:0,width:0,height:0}} />
      <span style={{
        display:'inline-flex',alignItems:'center',justifyContent:'center',width:17,height:17,
        borderRadius:'var(--radius-xs)',
        background: on ? 'var(--pino-600)' : 'var(--papel-0)',
        border:'1px solid '+(on ? 'var(--pino-600)' : 'var(--border-strong)'),
        boxShadow: on ? 'none' : 'var(--shadow-inset)',
        transition:'var(--transition-control)', flex:'0 0 auto',
      }}>
        {indeterminate ? <span style={{width:8,height:2,background:'var(--papel-0)',borderRadius:1}} />
          : checked ? <Icon name="check" size={12} color="var(--papel-0)" /> : null}
      </span>
      {label ? <span style={{fontSize:'var(--text-sm)',color:'var(--text-body)'}}>{label}</span> : null}
    </label>
  );
}
