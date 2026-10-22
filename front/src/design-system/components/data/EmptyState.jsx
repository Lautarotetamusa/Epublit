import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function EmptyState({ icon='book-open', title, description, action, style, ...rest }) {
  return (
    <div {...rest} style={{
      display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',
      gap:'var(--space-3)',padding:'var(--space-12) var(--space-6)',...style,
    }}>
      <span style={{
        display:'inline-flex',alignItems:'center',justifyContent:'center',width:44,height:44,
        borderRadius:'var(--radius-pill)',background:'var(--pino-50)',border:'1px solid var(--pino-100)',
      }}>
        <Icon name={icon} size={20} color="var(--pino-600)" />
      </span>
      <h4 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-md)',fontWeight:'var(--weight-semibold)',margin:0}}>{title}</h4>
      {description ? <p style={{margin:0,maxWidth:'42ch',fontSize:'var(--text-sm)',color:'var(--text-muted)',textWrap:'pretty'}}>{description}</p> : null}
      {action ? <div style={{marginTop:'var(--space-2)'}}>{action}</div> : null}
    </div>
  );
}
