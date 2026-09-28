import React from 'react';
import { Icon } from './Icon.jsx';

const T = {
  neutral:{ bg:'var(--papel-100)', fg:'var(--papel-700)', bd:'var(--papel-200)' },
  brand:{ bg:'var(--pino-50)', fg:'var(--pino-700)', bd:'var(--pino-100)' },
  accent:{ bg:'var(--violeta-50)', fg:'var(--violeta-700)', bd:'var(--violeta-100)' },
  success:{ bg:'var(--exito-100)', fg:'var(--exito-600)', bd:'#C3DEDB' },
  warning:{ bg:'var(--aviso-100)', fg:'var(--aviso-600)', bd:'#EFDCB4' },
  error:{ bg:'var(--error-100)', fg:'var(--error-600)', bd:'#EDCBC7' },
};

export function Badge({ tone='neutral', icon, dot, children, style, ...rest }) {
  const t = T[tone] || T.neutral;
  return (
    <span {...rest} style={{
      display:'inline-flex', alignItems:'center', gap:6, height:22, padding:'0 8px',
      fontFamily:'var(--font-body)', fontSize:'var(--text-2xs)', fontWeight:'var(--weight-semibold)',
      letterSpacing:'0.02em', color:t.fg, background:t.bg,
      border:'1px solid '+t.bd, borderRadius:'var(--radius-xs)', whiteSpace:'nowrap', ...style,
    }}>
      {dot ? <span style={{width:6,height:6,borderRadius:'var(--radius-pill)',background:t.fg}} /> : null}
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
