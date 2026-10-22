import React from 'react';

export function Field({ label, hint, error, required, htmlFor, children, style, ...rest }) {
  return (
    <div {...rest} style={{display:'flex',flexDirection:'column',gap:6,...style}}>
      {label ? (
        <label htmlFor={htmlFor} style={{fontSize:'var(--text-xs)',fontWeight:'var(--weight-semibold)',color:'var(--papel-700)',letterSpacing:'0.01em'}}>
          {label}{required ? <span style={{color:'var(--text-error)',marginLeft:3}}>*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span style={{fontSize:'var(--text-xs)',color:'var(--text-error)'}}>{error}</span>
        : hint ? <span style={{fontSize:'var(--text-xs)',color:'var(--text-subtle)'}}>{hint}</span> : null}
    </div>
  );
}
