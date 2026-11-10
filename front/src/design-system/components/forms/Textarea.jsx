import React from 'react';
import { FieldContext } from './fieldContext.js';

export const Textarea = React.forwardRef(function Textarea({ invalid, rows=4, style, id, ...rest }, ref) {
  const [f,setF] = React.useState(false);
  const field = React.useContext(FieldContext);
  return (
    <textarea ref={ref} rows={rows} id={id ?? field?.id} aria-required={field?.required || undefined} {...rest}
      onFocus={e=>{setF(true);rest.onFocus?.(e);}} onBlur={e=>{setF(false);rest.onBlur?.(e);}}
      style={{
        width:'100%', padding:'9px 10px', resize:'vertical',
        fontFamily:'var(--font-body)', fontSize:'var(--text-sm)', lineHeight:'var(--leading-normal)',
        color:'var(--text-body)', caretColor:'var(--pino-600)', background:'var(--papel-0)',
        border:'1px solid '+(invalid ? 'var(--border-error)' : f ? 'var(--pino-500)' : 'var(--border-default)'),
        borderRadius:'var(--radius-sm)', outline:'none',
        boxShadow: f ? 'var(--ring-focus)' : 'var(--shadow-inset)',
        transition:'var(--transition-control)', ...style,
      }} />
  );
});
