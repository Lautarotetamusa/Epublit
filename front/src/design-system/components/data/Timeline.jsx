import React from 'react';
import { Icon } from '../core/Icon.jsx';

const TONES = {
  done:{ dot:'var(--pino-600)', line:'var(--pino-100)', fg:'var(--text-body)' },
  current:{ dot:'var(--pino-600)', line:'var(--border-subtle)', fg:'var(--text-body)' },
  pending:{ dot:'var(--papel-300)', line:'var(--border-subtle)', fg:'var(--text-subtle)' },
  error:{ dot:'var(--error-600)', line:'var(--border-subtle)', fg:'var(--text-body)' },
};

// Historial vertical de un registro (pedidos, movimientos, liquidaciones):
// cuenta lo que ya pasó, en orden, con el último hito marcado como actual.
// No es un stepper de pasos futuros: los pasos que todavía no ocurrieron no
// se inventan acá.
export function Timeline({ items=[], style, ...rest }) {
  return (
    <ol {...rest} style={{listStyle:'none',margin:0,padding:0,display:'flex',flexDirection:'column',...style}}>
      {items.map((item,i)=>{
        const tone = TONES[item.tone || 'done'] || TONES.done;
        const last = i === items.length - 1;
        const current = item.tone === 'current';
        const icon = item.tone === 'error' ? 'x' : item.tone === 'pending' ? null : 'check';

        return (
          <li key={item.id ?? i} style={{display:'grid',gridTemplateColumns:'22px 1fr',columnGap:'var(--space-3)'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
              <span style={{
                display:'inline-flex',alignItems:'center',justifyContent:'center',
                width:20,height:20,marginTop:1,borderRadius:'var(--radius-pill)',
                background: current ? 'var(--papel-0)' : tone.dot,
                border: current ? '2px solid var(--pino-600)' : '1px solid transparent',
              }}>
                {current ? (
                  <span style={{width:6,height:6,borderRadius:'var(--radius-pill)',background:'var(--pino-600)'}} />
                ) : icon ? (
                  <Icon name={icon} size={11} color="var(--papel-0)" />
                ) : null}
              </span>
              {!last ? <span style={{flex:1,width:1,minHeight:'var(--space-4)',background:tone.line}} /> : null}
            </div>
            <div style={{paddingBottom:last ? 0 : 'var(--space-4)'}}>
              <div style={{display:'flex',flexWrap:'wrap',alignItems:'baseline',gap:'var(--space-2)'}}>
                <span style={{
                  fontSize:'var(--text-sm)',
                  fontWeight: current ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                  color:tone.fg,
                }}>{item.title}</span>
                {item.timestamp ? <span style={{fontSize:'var(--text-2xs)',color:'var(--text-subtle)'}}>{item.timestamp}</span> : null}
              </div>
              {item.description ? (
                <p style={{margin:'2px 0 0',fontSize:'var(--text-xs)',color:'var(--text-muted)',textWrap:'pretty'}}>{item.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
