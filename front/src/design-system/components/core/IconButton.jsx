import React from 'react';
import { Icon } from './Icon.jsx';

const S = { sm:{ b:26, ic:14 }, md:{ b:32, ic:16 }, lg:{ b:38, ic:18 } };

export function IconButton({ icon, label, size='md', variant='ghost', active, disabled, style, ...rest }) {
  const s = S[size] || S.md;
  const [h,setH] = React.useState(false);
  const solid = variant === 'solid';
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} {...rest}
      style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:s.b, height:s.b, padding:0, borderRadius:'var(--radius-sm)',
        color: solid ? 'var(--papel-0)' : active ? 'var(--text-brand)' : 'var(--text-muted)',
        background: solid ? (h?'var(--pino-700)':'var(--pino-600)') : active ? 'var(--pino-50)' : h ? 'var(--surface-hover)' : 'transparent',
        border:'1px solid '+(variant==='outline' ? 'var(--border-default)' : 'transparent'),
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition:'var(--transition-control)', ...style,
      }}>
      <Icon name={icon} size={s.ic} />
    </button>
  );
}
