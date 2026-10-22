import React from 'react';
import { Icon } from '../core/Icon.jsx';

// `new URL(..., import.meta.url)` (no un string relativo suelto): un
// <img src="../../assets/..."> se resuelve contra la URL de la página, no
// del módulo, así que rompe apenas la app tiene rutas fuera de "/".
const defaultLogoSrc = new URL('../../assets/logo-epublit-lockup-light.png', import.meta.url).href;

export function SidebarNav({ items=[], value, onChange, logoSrc=defaultLogoSrc, footer, style, ...rest }) {
  return (
    <nav {...rest} style={{
      display:'flex', flexDirection:'column', width:'var(--width-sidebar)', flex:'0 0 auto',
      background:'var(--papel-900)', color:'var(--papel-300)', ...style,
    }}>
      <div style={{display:'flex',alignItems:'center',height:'var(--height-topbar)',padding:'0 var(--space-5)',borderBottom:'1px solid rgba(255,255,255,.07)'}}>
        <img src={logoSrc} alt="Epublit" style={{height:22,width:'auto',display:'block'}} />
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:2,padding:'var(--space-4) var(--space-3)',flex:1,overflowY:'auto'}}>
        {items.map(it => {
          if (it.section) return <div key={it.section} style={{padding:'var(--space-4) var(--space-2) var(--space-1)',fontSize:'var(--text-2xs)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-caps)',textTransform:'uppercase',color:'rgba(255,255,255,.45)'}}>{it.section}</div>;
          const on = it.value === value;
          return (
            <button key={it.value} onClick={()=>onChange&&onChange(it.value)}
              style={{
                display:'flex', alignItems:'center', gap:10, width:'100%',
                padding:'8px 10px', border:'none', borderRadius:'var(--radius-sm)',
                background: on ? 'rgba(255,255,255,.10)' : 'transparent',
                color: on ? 'var(--papel-0)' : 'var(--papel-300)',
                fontFamily:'var(--font-body)', fontSize:'var(--text-sm)',
                fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)',
                textAlign:'left', cursor:'pointer', transition:'var(--transition-control)',
              }}>
              <Icon name={it.icon} size={17} color={on ? 'var(--papel-100)' : 'rgba(255,255,255,.75)'} />
              <span style={{flex:1}}>{it.label}</span>
              {it.badge ? <span style={{fontSize:'var(--text-2xs)',fontFamily:'var(--font-mono)',color:'var(--papel-900)',background:'var(--papel-200)',borderRadius:'var(--radius-xs)',padding:'1px 5px'}}>{it.badge}</span> : null}
            </button>
          );
        })}
      </div>
      {footer ? <div style={{padding:'var(--space-3) var(--space-4)',borderTop:'1px solid rgba(255,255,255,.07)'}}>{footer}</div> : null}
    </nav>
  );
}
