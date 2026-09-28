import React from 'react';

export function Switch({ label, checked, disabled, onChange, style, ...rest }) {
  return (
    <label {...rest} style={{display:'inline-flex',alignItems:'center',gap:10,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.55:1,...style}}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={onChange} style={{position:'absolute',opacity:0,width:0,height:0}} />
      <span style={{
        position:'relative', width:34, height:19, borderRadius:'var(--radius-pill)',
        background: checked ? 'var(--pino-600)' : 'var(--papel-300)',
        transition:'background-color var(--dur-fast) var(--ease-standard)', flex:'0 0 auto',
      }}>
        <span style={{
          position:'absolute', top:2, left: checked ? 17 : 2, width:15, height:15,
          borderRadius:'var(--radius-pill)', background:'var(--papel-0)', boxShadow:'var(--shadow-sm)',
          transition:'left var(--dur-fast) var(--ease-standard)',
        }} />
      </span>
      {label ? <span style={{fontSize:'var(--text-sm)',color:'var(--text-body)'}}>{label}</span> : null}
    </label>
  );
}
