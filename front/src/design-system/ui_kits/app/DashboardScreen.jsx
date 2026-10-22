const { StatCard, Card, Table, Badge, Button, Alert, Icon } = window.EpublitDesignSystem_2918d4;

function DashboardScreen({ onOpenBook }) {
  const { libros, liquidaciones, money } = window.EpublitData;
  const bajos = libros.filter(l => l.estado !== 'ok');
  return (
    <div style={{display:'grid',gap:'var(--space-5)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'var(--space-4)'}}>
        <StatCard label="Ventas del mes" value={money(1842500)} delta="+12% vs. julio" icon="banknote" />
        <StatCard label="Ejemplares vendidos" value="1.204" unit="ej." delta="+3% vs. julio" icon="package" />
        <StatCard label="Títulos activos" value="168" delta="6 nuevos este mes" deltaTone="muted" icon="book-open" />
        <StatCard label="Por liquidar" value={money(1044300)} delta="2 liquidaciones pendientes" deltaTone="error" icon="receipt-text" />
      </div>
      {bajos.length ? (
        <Alert tone="warning" title="Stock por debajo del mínimo">
          {bajos.length} títulos quedaron con menos de 40 ejemplares en depósito.
        </Alert>
      ) : null}
      <div style={{display:'grid',gridTemplateColumns:'1.5fr 1fr',gap:'var(--space-4)',alignItems:'start'}}>
        <Card padded={false} title="Últimas liquidaciones" subtitle="Por punto de venta"
          actions={<Button variant="secondary" size="sm">Ver todas</Button>}>
          <Table dense columns={[
            { header:'Nº', key:'id', mono:true },
            { header:'Punto de venta', key:'pdv', wrap:true },
            { header:'Período', key:'periodo', muted:true },
            { header:'Neto', align:'right', mono:true, cell:r=>money(r.neto) },
            { header:'Estado', cell:r => r.estado==='liquidado' ? <Badge tone="success" dot>Liquidado</Badge> : r.estado==='pendiente' ? <Badge tone="warning">Pendiente</Badge> : <Badge tone="accent">En revisión</Badge> },
          ]} rows={liquidaciones.slice(0,4)} />
        </Card>
        <Card title="Más vendidos" subtitle="Agosto 2026" padded={false}>
          <div style={{display:'grid'}}>
            {libros.slice(0,4).map((l,i)=>(
              <button key={l.id} onClick={()=>onOpenBook(l)} style={{display:'flex',alignItems:'center',gap:'var(--space-3)',padding:'11px var(--space-5)',border:'none',borderBottom:'1px solid var(--border-subtle)',background:'transparent',cursor:'pointer',textAlign:'left'}}>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-xs)',color:'var(--text-subtle)',width:14}}>{i+1}</span>
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:'block',fontSize:'var(--text-sm)',fontWeight:'var(--weight-medium)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{l.titulo}</span>
                  <span style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{l.autor}</span>
                </span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-xs)',color:'var(--text-body)'}}>{l.stock} ej.</span>
                <Icon name="chevron-right" size={15} color="var(--papel-400)" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
Object.assign(window, { DashboardScreen });
