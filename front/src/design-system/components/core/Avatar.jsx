import React from 'react';

const S = { sm:24, md:32, lg:40 };

export function Avatar({ name='', size='md', tone='brand', style, ...rest }) {
  const px = S[size] || S.md;
  const initials = name.trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
  const t = tone === 'accent'
    ? { bg:'var(--violeta-100)', fg:'var(--violeta-700)' }
    : tone === 'neutral' ? { bg:'var(--papel-200)', fg:'var(--papel-700)' }
    : { bg:'var(--pino-100)', fg:'var(--pino-700)' };
  return (
    <span title={name} {...rest} style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:px, height:px, borderRadius:'var(--radius-pill)',
      background:t.bg, color:t.fg, fontFamily:'var(--font-body)',
      fontSize: px <= 24 ? 'var(--text-2xs)' : 'var(--text-xs)', fontWeight:'var(--weight-bold)',
      letterSpacing:'0.02em', flex:'0 0 auto', ...style,
    }}>{initials}</span>
  );
}
