const { Card, Table, Badge, Button, IconButton, Pagination, Select, Input, StatCard, Dialog, Field, EmptyState, Tooltip } = window.EpublitDesignSystem_2918d4;

function SettlementsScreen({ onToast }) {
  const { liquidaciones, money } = window.EpublitData;
  const [open, setOpen] = React.useState(false);
  const [pdv, setPdv] = React.useState('');
  const rows = liquidaciones.filter(l => !pdv || l.pdv === pdv);
  return (
    <div style={{display:'grid',gap:'var(--space-4)'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-4)'}}>
        <StatCard label="Neto del período" value={money(6431055)} delta="5 liquidaciones" deltaTone="muted" icon="banknote" />
        <StatCard label="Pendiente de cobro" value={money(1044300)} delta="1 vencida" deltaTone="error" icon="receipt-text" />
        <StatCard label="Comisión promedio" value="37%" delta="sin cambios" deltaTone="muted" icon="percent" />
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
        <Input size="sm" iconStart="search" placeholder="Buscar por número o punto de venta" style={{width:290}} />
        <Select size="sm" placeholder="Todos los puntos de venta" value={pdv} onChange={e=>setPdv(e.target.value)}
          options={['Librería Norte','El Ateneo Central','Distribuidora Sur','Feria del Libro']} style={{width:210}} />
        <Select size="sm" placeholder="Todos los períodos" options={['Julio 2026','Junio 2026','Mayo 2026']} style={{width:170}} />
        <div style={{flex:1}} />
        <Button variant="secondary" size="sm" iconStart="printer">Imprimir</Button>
        <Button size="sm" iconStart="plus" onClick={()=>setOpen(true)}>Nueva liquidación</Button>
      </div>
      <Card padded={false} footer={<Pagination page={1} pageCount={4} total={19} onChange={()=>{}} />}>
        {rows.length ? (
          <Table columns={[
            { header:'Nº', key:'id', mono:true },
            { header:'Punto de venta', key:'pdv', wrap:true },
            { header:'Período', key:'periodo', muted:true },
            { header:'Ejempl.', align:'right', mono:true, key:'ejemplares' },
            { header:'Bruto', align:'right', mono:true, cell:r=>money(r.bruto) },
            { header:'Comisión', align:'right', mono:true, cell:r=>r.comision+'%' },
            { header:'Neto', align:'right', mono:true, cell:r=><b>{money(r.neto)}</b> },
            { header:'Estado', cell:r => r.estado==='liquidado' ? <Badge tone="success" dot>Liquidado</Badge> : r.estado==='pendiente' ? <Badge tone="warning">Pendiente</Badge> : <Badge tone="accent">En revisión</Badge> },
            { header:'', width:70, cell:() => (
              <span style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
                <IconButton icon="file-text" label="Ver detalle" size="sm" />
                <IconButton icon="download" label="Descargar" size="sm" />
              </span>) },
          ]} rows={rows} onRowClick={()=>onToast('Detalle de liquidación')} />
        ) : (
          <EmptyState icon="receipt-text" title="No hay liquidaciones para ese filtro"
            description="Probá con otro punto de venta o período."
            action={<Button variant="secondary" onClick={()=>setPdv('')}>Limpiar filtros</Button>} />
        )}
      </Card>

      <Dialog open={open} title="Nueva liquidación" description="Elegí el punto de venta y el período a liquidar." width={460}
        onClose={()=>setOpen(false)}
        footer={<>
          <Button variant="secondary" size="sm" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={()=>{setOpen(false);onToast('Liquidación L-0185 creada');}}>Crear liquidación</Button>
        </>}>
        <div style={{display:'grid',gap:'var(--space-4)'}}>
          <Field label="Punto de venta" required><Select placeholder="Elegí un punto de venta" options={['Librería Norte','El Ateneo Central','Distribuidora Sur','Feria del Libro']} /></Field>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
            <Field label="Desde"><Input iconStart="calendar" defaultValue="01/08/2026" /></Field>
            <Field label="Hasta"><Input iconStart="calendar" defaultValue="31/08/2026" /></Field>
          </div>
          <Field label="Comisión" hint="Se toma del acuerdo vigente"><Input suffix="%" defaultValue="35" /></Field>
        </div>
      </Dialog>
    </div>
  );
}
Object.assign(window, { SettlementsScreen });
