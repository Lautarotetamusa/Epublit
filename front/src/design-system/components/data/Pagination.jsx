import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

export function Pagination({ page=1, pageCount=1, total, onChange, style, ...rest }) {
  return (
    <div {...rest} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-4)',...style}}>
      <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>
        {total != null ? total + ' registros · ' : ''}Página {page} de {pageCount}
      </span>
      <div style={{display:'flex',alignItems:'center',gap:'var(--space-1)'}}>
        <IconButton icon="chevron-left" label="Anterior" size="sm" variant="outline" disabled={page<=1} onClick={()=>onChange&&onChange(page-1)} />
        <IconButton icon="chevron-right" label="Siguiente" size="sm" variant="outline" disabled={page>=pageCount} onClick={()=>onChange&&onChange(page+1)} />
      </div>
    </div>
  );
}
