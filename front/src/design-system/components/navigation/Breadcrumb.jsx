import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Breadcrumb({ items=[], onNavigate, style, ...rest }) {
  return (
    <nav {...rest} style={{display:'flex',alignItems:'center',gap:6,fontSize:'var(--text-xs)',...style}}>
      {items.map((it,i) => {
        const label = typeof it === 'string' ? it : it.label;
        const last = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 ? <Icon name="chevron-right" size={13} color="var(--papel-400)" /> : null}
            <span onClick={last ? undefined : ()=>onNavigate&&onNavigate(it,i)}
              style={{
                color: last ? 'var(--text-body)' : 'var(--text-muted)',
                fontWeight: last ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                cursor: last ? 'default' : 'pointer',
              }}>{label}</span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
