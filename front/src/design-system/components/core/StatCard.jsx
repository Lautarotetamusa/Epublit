import React from 'react';
import { Icon } from './Icon.jsx';

export function StatCard({ label, value, unit, delta, deltaTone='success', icon, style, ...rest }) {
  const dc = deltaTone === 'error' ? 'var(--text-error)' : deltaTone === 'muted' ? 'var(--text-muted)' : 'var(--text-success)';
  return (
    <div {...rest} style={{
      background:'var(--surface-card)', border:'1px solid var(--border-subtle)',
      borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-xs)',
      padding:'var(--space-4) var(--space-5)', ...style,
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--space-3)'}}>
        <span style={{fontSize:'var(--text-2xs)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-caps)',textTransform:'uppercase',color:'var(--text-muted)'}}>{label}</span>
        {icon ? <Icon name={icon} size={16} color="var(--pino-400)" /> : null}
      </div>
      <div style={{display:'flex',alignItems:'baseline',gap:6,marginTop:'var(--space-3)'}}>
        <span style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-medium)',letterSpacing:'var(--tracking-tight)',color:'var(--text-body)'}}>{value}</span>
        {unit ? <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{unit}</span> : null}
      </div>
      {delta ? <div style={{marginTop:4,fontSize:'var(--text-xs)',fontWeight:'var(--weight-medium)',color:dc}}>{delta}</div> : null}
    </div>
  );
}
