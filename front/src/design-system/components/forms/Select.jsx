import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Select({ options=[], placeholder, invalid, size='md', style, ...rest }) {
  const [f,setF] = React.useState(false);
  const h = size === 'sm' ? 'var(--height-control-sm)' : 'var(--height-control)';
  return (
    <div style={{position:'relative',display:'flex',alignItems:'center',...style}}>
      <select {...rest} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{
          appearance:'none', width:'100%', height:h, padding:'0 32px 0 10px',
          fontFamily:'var(--font-body)', fontSize: size==='sm' ? 'var(--text-xs)' : 'var(--text-sm)',
          color:'var(--text-body)', background: rest.disabled ? 'var(--papel-100)' : 'var(--papel-0)',
          border:'1px solid '+(invalid ? 'var(--border-error)' : f ? 'var(--pino-500)' : 'var(--border-default)'),
          borderRadius:'var(--radius-sm)', outline:'none',
          boxShadow: f ? 'var(--ring-focus)' : 'var(--shadow-inset)',
          transition:'var(--transition-control)', cursor:'pointer',
        }}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map(o => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
      <Icon name="chevron-down" size={15} color="var(--text-subtle)" style={{position:'absolute',right:9,pointerEvents:'none'}} />
    </div>
  );
}
