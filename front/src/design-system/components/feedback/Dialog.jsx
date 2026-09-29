import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

export function Dialog({ open=true, title, description, footer, width=520, onClose, children, style, ...rest }) {
  if (!open) return null;
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:60, display:'flex', alignItems:'center', justifyContent:'center',
      padding:'var(--space-6)', background:'rgba(12,33,32,.42)', backdropFilter:'blur(2px)',
      // Red de seguridad para viewports muy bajos: si aun con el tope de alto
      // del panel no entrara nada, scrollea el fondo en vez de recortar.
      overflowY:'auto',
    }} onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()} {...rest} style={{
        width, maxWidth:'100%', background:'var(--surface-card)',
        // Sin tope de alto, un diálogo con contenido largo (ej. la tabla de
        // libros de una colección) crecía más que el viewport y, como el panel
        // va centrado, el sobrante se repartía arriba y abajo: quedaban
        // invisibles el título, el buscador y el pie. Con el tope + el cuerpo
        // scrolleable, encabezado y pie quedan siempre a la vista.
        maxHeight:'calc(100vh - var(--space-12))', display:'flex', flexDirection:'column',
        border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-lg)',
        boxShadow:'var(--shadow-overlay)', overflow:'hidden', ...style,
      }}>
        <header style={{display:'flex',alignItems:'flex-start',gap:'var(--space-4)',flex:'0 0 auto',padding:'var(--space-5) var(--space-5) var(--space-3)'}}>
          <div style={{flex:1}}>
            <h3 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-lg)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:0}}>{title}</h3>
            {description ? <p style={{margin:'4px 0 0',fontSize:'var(--text-sm)',color:'var(--text-muted)',textWrap:'pretty'}}>{description}</p> : null}
          </div>
          {onClose ? <IconButton icon="x" label="Cerrar" size="sm" onClick={onClose} /> : null}
        </header>
        <div style={{padding:'var(--space-2) var(--space-5) var(--space-5)',overflowY:'auto',flex:'1 1 auto',minHeight:0}}>{children}</div>
        {footer ? (
          <footer style={{display:'flex',justifyContent:'flex-end',gap:'var(--space-2)',flex:'0 0 auto',padding:'var(--space-4) var(--space-5)',borderTop:'1px solid var(--border-subtle)',background:'var(--papel-50)'}}>{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
