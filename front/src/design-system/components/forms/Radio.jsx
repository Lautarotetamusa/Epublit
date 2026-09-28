import React from 'react';

export function Radio({ label, description, checked, disabled, name, onChange, style, ...rest }) {
  return (
    <label {...rest} style={{display:'flex',alignItems:'flex-start',gap:9,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.55:1,...style}}>
      <input type="radio" name={name} checked={!!checked} disabled={disabled} onChange={onChange}
        style={{position:'absolute',opacity:0,width:0,height:0}} />
      <span style={{
        display:'inline-flex',alignItems:'center',justifyContent:'center',width:17,height:17,marginTop:1,
        borderRadius:'var(--radius-pill)', background:'var(--papel-0)',
        border:'1px solid '+(checked ? 'var(--pino-600)' : 'var(--border-strong)'),
        boxShadow: checked ? 'none' : 'var(--shadow-inset)',
        transition:'var(--transition-control)', flex:'0 0 auto',
      }}>
        {checked ? <span style={{width:8,height:8,borderRadius:'var(--radius-pill)',background:'var(--pino-600)'}} /> : null}
      </span>
      <span>
        <span style={{display:'block',fontSize:'var(--text-sm)',color:'var(--text-body)'}}>{label}</span>
        {description ? <span style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text-muted)',marginTop:1}}>{description}</span> : null}
      </span>
    </label>
  );
}
