import React from 'react';

export function Tooltip({ label, placement='top', children, style, ...rest }) {
  const [open,setOpen] = React.useState(false);
  const pos = placement === 'bottom'
    ? { top:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)' }
    : { bottom:'calc(100% + 6px)', left:'50%', transform:'translateX(-50%)' };
  return (
    <span {...rest} onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}
      style={{position:'relative',display:'inline-flex',...style}}>
      {children}
      {open ? (
        <span role="tooltip" style={{
          position:'absolute', ...pos, zIndex:40, padding:'5px 8px',
          background:'var(--pino-900)', color:'var(--papel-50)',
          fontSize:'var(--text-2xs)', fontWeight:'var(--weight-medium)', lineHeight:1.35,
          borderRadius:'var(--radius-xs)', boxShadow:'var(--shadow-lg)',
          whiteSpace:'nowrap', pointerEvents:'none',
        }}>{label}</span>
      ) : null}
    </span>
  );
}
