import React from 'react';

export function Textarea({ invalid, rows=4, style, ...rest }) {
  const [f,setF] = React.useState(false);
  return (
    <textarea rows={rows} {...rest}
      onFocus={e=>{setF(true);rest.onFocus&&rest.onFocus(e);}} onBlur={e=>{setF(false);rest.onBlur&&rest.onBlur(e);}}
      style={{
        width:'100%', padding:'9px 10px', resize:'vertical',
        fontFamily:'var(--font-body)', fontSize:'var(--text-sm)', lineHeight:'var(--leading-normal)',
        color:'var(--text-body)', background:'var(--papel-0)',
        border:'1px solid '+(invalid ? 'var(--border-error)' : f ? 'var(--pino-500)' : 'var(--border-default)'),
        borderRadius:'var(--radius-sm)', outline:'none',
        boxShadow: f ? 'var(--ring-focus)' : 'var(--shadow-inset)',
        transition:'var(--transition-control)', ...style,
      }} />
  );
}
