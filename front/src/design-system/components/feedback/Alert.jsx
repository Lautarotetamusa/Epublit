import React from 'react';
import { Icon } from '../core/Icon.jsx';

const T = {
  info:{ bg:'var(--violeta-50)', bd:'var(--violeta-200)', fg:'var(--violeta-800)', ic:'info' },
  success:{ bg:'var(--pino-50)', bd:'var(--pino-200)', fg:'var(--pino-800)', ic:'circle-check' },
  warning:{ bg:'var(--aviso-100)', bd:'#EFDCB4', fg:'#7A5210', ic:'triangle-alert' },
  error:{ bg:'var(--error-100)', bd:'#EDCBC7', fg:'#7A241E', ic:'circle-alert' },
};

export function Alert({ tone='info', title, children, onClose, style, ...rest }) {
  const t = T[tone] || T.info;
  return (
    <div role="status" {...rest} style={{
      display:'flex', alignItems:'flex-start', gap:'var(--space-3)',
      padding:'var(--space-3) var(--space-4)', background:t.bg,
      border:'1px solid '+t.bd, borderRadius:'var(--radius-md)', color:t.fg, ...style,
    }}>
      <Icon name={t.ic} size={17} style={{marginTop:1}} />
      <div style={{flex:1,minWidth:0}}>
        {title ? <div style={{fontSize:'var(--text-sm)',fontWeight:'var(--weight-semibold)'}}>{title}</div> : null}
        {children ? <div style={{fontSize:'var(--text-sm)',opacity:.9,marginTop:title?2:0,textWrap:'pretty'}}>{children}</div> : null}
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Cerrar"
          style={{display:'flex',border:'none',background:'transparent',color:'inherit',cursor:'pointer',padding:2,opacity:.7}}>
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}
