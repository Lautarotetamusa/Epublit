const { SidebarNav, Topbar, Avatar, Button, Toast } = window.EpublitDesignSystem_2918d4;

const NAV = [
  { value:'inicio', label:'Inicio', icon:'layout-dashboard' },
  { section:'Catálogo' },
  { value:'libros', label:'Libros', icon:'book-open', badge:168 },
  { value:'autores', label:'Autores', icon:'users' },
  { section:'Comercial' },
  { value:'stock', label:'Stock', icon:'boxes' },
  { value:'pdv', label:'Puntos de venta', icon:'store' },
  { value:'liq', label:'Liquidaciones', icon:'receipt-text', badge:2 },
  { value:'remitos', label:'Remitos', icon:'truck' },
  { section:'Análisis' },
  { value:'informes', label:'Informes', icon:'chart-line' },
  { section:'Editorial' },
  { value:'config', label:'Configuración', icon:'settings' },
];

const TITLES = {
  inicio:['Sur Editora','Inicio'], libros:['Catálogo','Libros'], autores:['Catálogo','Autores'],
  stock:['Comercial','Stock'], pdv:['Comercial','Puntos de venta'], liq:['Comercial','Liquidaciones'],
  remitos:['Comercial','Remitos'], informes:['Análisis','Informes'], config:['Editorial','Configuración'],
};

function AppShell({ view, onView, toast, onToast, children }) {
  const [b, t] = TITLES[view] || ['Epublit',''];
  return (
    <div style={{position:'relative',display:'flex',height:'100%',overflow:'hidden',background:'var(--surface-page)'}}>
      <SidebarNav items={NAV} value={view} onChange={onView}
        footer={
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <Avatar name="Lucía Ferreyra" size="sm" />
            <span style={{flex:1,minWidth:0}}>
              <span style={{display:'block',fontSize:'var(--text-xs)',fontWeight:'var(--weight-semibold)',color:'var(--papel-50)'}}>Lucía Ferreyra</span>
              <span style={{display:'block',fontSize:'var(--text-2xs)',color:'rgba(217,234,232,.55)'}}>Sur Editora</span>
            </span>
          </div>
        } />
      <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}}>
        <Topbar breadcrumb={b} title={t} search="Buscar por título, autor o ISBN"
          actions={view==='libros' ? null : <Button size="sm" variant="secondary" iconStart="download">Exportar</Button>}
          user={<Avatar name="Lucía Ferreyra" size="sm" />} />
        <main style={{flex:1,overflowY:'auto',padding:'var(--space-6) var(--gutter-page) var(--space-10)'}}>
          {children}
        </main>
      </div>
      {toast ? (
        <div style={{position:'absolute',left:'calc(var(--width-sidebar) + var(--space-6))',bottom:'var(--space-6)',zIndex:70}}>
          <Toast message={toast} onClose={()=>onToast(null)} />
        </div>
      ) : null}
    </div>
  );
}
Object.assign(window, { AppShell, NAV });
