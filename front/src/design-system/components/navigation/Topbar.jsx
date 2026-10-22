import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { IconButton } from '../core/IconButton.jsx';

export function Topbar({ title, breadcrumb, search, onSearch, actions, user, style, ...rest }) {
  return (
    <header {...rest} style={{
      display:'flex', alignItems:'center', gap:'var(--space-4)',
      height:'var(--height-topbar)', flex:'0 0 auto',
      padding:'0 var(--gutter-page)', background:'var(--papel-0)',
      borderBottom:'1px solid var(--border-subtle)', ...style,
    }}>
      <div style={{minWidth:0}}>
        {breadcrumb ? <div style={{fontSize:'var(--text-2xs)',letterSpacing:'var(--tracking-wide)',textTransform:'uppercase',color:'var(--text-subtle)'}}>{breadcrumb}</div> : null}
        {title ? <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-lg)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title}</h2> : null}
      </div>
      <div style={{flex:1}} />
      {search ? (
        <div style={{display:'flex',alignItems:'center',gap:8,width:280,height:'var(--height-control-sm)',padding:'0 10px',background:'var(--papel-50)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)'}}>
          <Icon name="search" size={15} color="var(--text-subtle)" />
          <input placeholder={typeof search === 'string' ? search : 'Buscar'} onChange={e=>onSearch&&onSearch(e.target.value)}
            style={{flex:1,minWidth:0,border:'none',outline:'none',background:'transparent',fontFamily:'var(--font-body)',fontSize:'var(--text-xs)',color:'var(--text-body)'}} />
        </div>
      ) : null}
      {actions}
      <IconButton icon="bell" label="Notificaciones" />
      {user}
    </header>
  );
}
