const { Button } = window.EpublitDesignSystem_2918d4;

function SiteHeader({ page, onPage }) {
  const links = [['producto','Producto'],['ecommerce','Ecommerce'],['precios','Precios'],['ayuda','Ayuda']];
  return (
    <header style={{position:'sticky',top:0,zIndex:20,background:'var(--pino-900)',borderBottom:'1px solid rgba(255,255,255,.08)'}}>
      <div style={{maxWidth:'var(--width-content)',margin:'0 auto',height:64,display:'flex',alignItems:'center',gap:'var(--space-8)',padding:'0 var(--gutter-page)'}}>
        <img src="../../assets/logo-epublit-lockup-light.png" alt="Epublit" style={{height:24,width:'auto'}} />
        <nav style={{display:'flex',alignItems:'center',gap:'var(--space-6)'}}>
          {links.map(([v,l])=>(
            <button key={v} onClick={()=>onPage(v)} style={{
              border:'none',background:'transparent',cursor:'pointer',padding:0,
              fontFamily:'var(--font-body)',fontSize:'var(--text-sm)',
              fontWeight: page===v ? 'var(--weight-semibold)' : 'var(--weight-medium)',
              color: page===v ? 'var(--papel-0)' : 'var(--pino-200)',
            }}>{l}</button>
          ))}
        </nav>
        <div style={{flex:1}} />
        <a href="#" style={{fontSize:'var(--text-sm)',fontWeight:'var(--weight-medium)',color:'var(--pino-200)',textDecoration:'none'}}>Ingresar</a>
        <Button variant="accent" size="sm" iconEnd="arrow-right" onClick={()=>onPage('demo')}>Pedir una demo</Button>
      </div>
    </header>
  );
}
Object.assign(window, { SiteHeader });
