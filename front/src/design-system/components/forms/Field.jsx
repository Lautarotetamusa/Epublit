import React from 'react';
import { FieldContext } from './fieldContext.js';

export function Field({ label, hint, error, required, htmlFor, children, style, ...rest }) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;
  const messageId = (error || hint) ? `${id}-mensaje` : undefined;
  return (
    <div {...rest} style={{display:'flex',flexDirection:'column',gap:6,...style}}>
      {label ? (
        <label htmlFor={id} style={{fontSize:'var(--text-xs)',fontWeight:'var(--weight-semibold)',color:'var(--papel-700)',letterSpacing:'0.01em'}}>
          {label}{required ? <span aria-hidden="true" style={{color:'var(--text-error)',marginLeft:3}}>*</span> : null}
        </label>
      ) : null}
      <FieldContext.Provider value={{ id, required, messageId }}>{children}</FieldContext.Provider>
      {error ? <span id={messageId} style={{fontSize:'var(--text-xs)',color:'var(--text-error)'}}>{error}</span>
        : hint ? <span id={messageId} style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{hint}</span> : null}
    </div>
  );
}
