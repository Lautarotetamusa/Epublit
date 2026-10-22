import React from 'react';
import { Icon } from '../core/Icon.jsx';

export function Toast({ tone='success', message, action, onClose, style, ...rest }) {
  const ic = tone === 'error' ? 'circle-alert' : tone === 'warning' ? 'triangle-alert' : 'circle-check';
  const fg = tone === 'error' ? '#F3C7C3' : tone === 'warning' ? '#F1DAAE' : 'var(--pino-200)';
  return (
    <div role="status" {...rest} style={{
      display:'inline-flex', alignItems:'center', gap:'var(--space-3)',
      padding:'10px 14px', background:'var(--pino-900)', color:'var(--papel-50)',
      borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-overlay)',
      fontSize:'var(--text-sm)', maxWidth:420, ...style,
    }}>
      <Icon name={ic} size={16} color={fg} />
      <span style={{flex:1}}>{message}</span>
      {action ? <span style={{fontWeight:'var(--weight-semibold)',color:'var(--pino-200)',cursor:'pointer'}}>{action}</span> : null}
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Cerrar" style={{display:'flex',border:'none',background:'transparent',color:'var(--papel-400)',cursor:'pointer',padding:0}}>
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </div>
  );
}
