import React from 'react';

const TONE = {
  brand: 'var(--pino-600)',
  success: 'var(--exito-600)',
  accent: 'var(--violeta-600)',
  warning: 'var(--aviso-600)',
};

/* Barra de progreso lineal: cuánto de un total ya está cubierto (pagos de una
   liquidación, stock comprometido, lo que sea medible de 0 a 100). Es contenido,
   no decoración: siempre va acompañada de la cifra en mono, así el dato se lee
   aunque la barra no se mire. */
export function ProgressBar({ value = 0, tone = 'brand', label, showValue = true, size = 'md', style, ...rest }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const height = size === 'sm' ? 6 : 8;

  return (
    <div {...rest} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 110, ...style }}>
      {label || showValue ? (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          {label ? (
            <span style={{
              fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)',
              letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--text-muted)',
            }}>{label}</span>
          ) : <span />}
          {showValue ? (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontVariantNumeric: 'tabular-nums',
              color: pct >= 100 ? 'var(--text-success)' : 'var(--text-body)',
            }}>{pct}%</span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={typeof label === 'string' ? label : undefined}
        style={{ height, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}
      >
        <div style={{
          width: '100%', height: '100%', background: TONE[tone] || TONE.brand,
          transform: `scaleX(${pct / 100})`, transformOrigin: 'left',
          transition: 'transform var(--dur-normal) var(--ease-standard)',
        }} />
      </div>
    </div>
  );
}
