import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Input({ iconStart, suffix, invalid, size='md', style, ...rest }) {
  const [f,setF] = React.useState(false);
  const h = size === 'sm' ? 'var(--height-control-sm)' : size === 'lg' ? 'var(--height-control-lg)' : 'var(--height-control)';
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8, height:h, padding:'0 10px',
      background: rest.disabled ? 'var(--papel-100)' : 'var(--papel-0)',
      border:'1px solid '+(invalid ? 'var(--border-error)' : f ? 'var(--pino-500)' : 'var(--border-default)'),
      borderRadius:'var(--radius-sm)',
      boxShadow: f ? (invalid ? 'var(--ring-error)' : 'var(--ring-focus)') : 'var(--shadow-inset)',
      transition:'var(--transition-control)', ...style,
    }}>
      {iconStart ? <Icon name={iconStart} size={16} color="var(--text-subtle)" /> : null}
      <input {...rest} onFocus={e=>{setF(true);rest.onFocus&&rest.onFocus(e);}} onBlur={e=>{setF(false);rest.onBlur&&rest.onBlur(e);}}
        style={{
          flex:1, minWidth:0, border:'none', outline:'none', background:'transparent',
          fontFamily:'var(--font-body)', fontSize: size==='sm' ? 'var(--text-xs)' : 'var(--text-sm)',
          color:'var(--text-body)',
        }} />
      {suffix ? <span style={{fontSize:'var(--text-xs)',color:'var(--text-subtle)',fontFamily:'var(--font-mono)'}}>{suffix}</span> : null}
    </div>
  );
}
