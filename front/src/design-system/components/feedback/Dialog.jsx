import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

export function Dialog({ open=true, title, description, footer, width=520, onClose, children, style, ...rest }) {
  if (!open) return null;
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center',
      padding:'var(--space-6)', background:'rgba(12,33,32,.42)', backdropFilter:'blur(2px)',
    }} onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()} {...rest} style={{
        width, maxWidth:'100%', background:'var(--surface-card)',
        border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)',
        boxShadow:'var(--shadow-overlay)', overflow:'hidden', ...style,
      }}>
        <header style={{display:'flex',alignItems:'flex-start',gap:'var(--space-4)',padding:'var(--space-5) var(--space-5) var(--space-3)'}}>
          <div style={{flex:1}}>
            <h3 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-lg)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:0}}>{title}</h3>
            {description ? <p style={{margin:'4px 0 0',fontSize:'var(--text-sm)',color:'var(--text-muted)',textWrap:'pretty'}}>{description}</p> : null}
          </div>
          {onClose ? <IconButton icon="x" label="Cerrar" size="sm" onClick={onClose} /> : null}
        </header>
        <div style={{padding:'var(--space-2) var(--space-5) var(--space-5)'}}>{children}</div>
        {footer ? (
          <footer style={{display:'flex',justifyContent:'flex-end',gap:'var(--space-2)',padding:'var(--space-4) var(--space-5)',borderTop:'1px solid var(--border-subtle)',background:'var(--papel-50)'}}>{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
