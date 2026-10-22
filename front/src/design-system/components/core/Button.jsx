import React from 'react';
import { Icon } from './Icon.jsx';

const V = {
  primary:{ bg:'var(--pino-600)', fg:'var(--papel-0)', bd:'var(--pino-600)', hb:'var(--pino-700)', ab:'var(--pino-800)' },
  accent:{ bg:'var(--violeta-600)', fg:'var(--papel-0)', bd:'var(--violeta-600)', hb:'var(--violeta-700)', ab:'var(--violeta-800)' },
  secondary:{ bg:'var(--papel-0)', fg:'var(--text-body)', bd:'var(--border-default)', hb:'var(--papel-100)', ab:'var(--papel-200)' },
  ghost:{ bg:'transparent', fg:'var(--text-brand)', bd:'transparent', hb:'var(--pino-50)', ab:'var(--pino-100)' },
  danger:{ bg:'var(--error-600)', fg:'var(--papel-0)', bd:'var(--error-600)', hb:'#8E2A23', ab:'#76221C' },
};
const S = {
  sm:{ h:'var(--height-control-sm)', px:10, fs:'var(--text-xs)', gap:6, ic:14 },
  md:{ h:'var(--height-control)', px:14, fs:'var(--text-sm)', gap:8, ic:16 },
  lg:{ h:'var(--height-control-lg)', px:20, fs:'var(--text-base)', gap:9, ic:18 },
};

export function Button({ variant='primary', size='md', iconStart, iconEnd, fullWidth, disabled, loading, children, style, ...rest }) {
  const v = V[variant] || V.primary, s = S[size] || S.md;
  const [h,setH] = React.useState(false), [a,setA] = React.useState(false);
  const off = disabled || loading;
  return (
    <button type="button" disabled={off}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>{setH(false);setA(false);}}
      onMouseDown={()=>setA(true)} onMouseUp={()=>setA(false)}
      {...rest}
      style={{
        display:'inline-flex', alignItems:'center', justifyContent:'center', gap:s.gap,
        height:s.h, padding:'0 '+s.px+'px', width: fullWidth ? '100%' : undefined,
        fontFamily:'var(--font-body)', fontSize:s.fs, fontWeight:'var(--weight-semibold)',
        letterSpacing:'0.01em', lineHeight:1, whiteSpace:'nowrap',
        color:v.fg, background: off ? 'var(--papel-100)' : (a ? v.ab : h ? v.hb : v.bg),
        border:'1px solid '+(off ? 'var(--border-subtle)' : v.bd),
        borderRadius:'var(--radius-sm)',
        boxShadow: variant==='secondary' && !off ? 'var(--shadow-xs)' : 'none',
        cursor: off ? 'not-allowed' : 'pointer',
        opacity: off ? 0.65 : 1,
        transition:'var(--transition-control)', ...style,
      }}>
      {loading ? <Icon name="loader-circle" size={s.ic} style={{animation:'epublit-spin 900ms linear infinite'}} />
        : iconStart ? <Icon name={iconStart} size={s.ic} /> : null}
      {children}
      {iconEnd && !loading ? <Icon name={iconEnd} size={s.ic} /> : null}
    </button>
  );
}
