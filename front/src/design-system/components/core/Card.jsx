import React from 'react';

export function Card({ title, subtitle, actions, footer, padded=true, children, style, ...rest }) {
  return (
    <section {...rest} style={{
      background:'var(--surface-card)', border:'1px solid var(--border-subtle)',
      borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-sm)', overflow:'hidden', ...style,
    }}>
      {(title || actions) ? (
        <header style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:'var(--space-4)',
          padding:'var(--space-4) var(--space-5)', borderBottom:'1px solid var(--border-subtle)',
        }}>
          <div>
            {title ? <h3 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-md)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:0}}>{title}</h3> : null}
            {subtitle ? <p style={{margin:'2px 0 0',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{subtitle}</p> : null}
          </div>
          {actions ? <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>{actions}</div> : null}
        </header>
      ) : null}
      <div style={{padding: padded ? 'var(--space-5)' : 0}}>{children}</div>
      {footer ? (
        <footer style={{padding:'var(--space-3) var(--space-5)',borderTop:'1px solid var(--border-subtle)',background:'var(--papel-50)',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{footer}</footer>
      ) : null}
    </section>
  );
}
