const { Card, Table, Badge, Button, Tabs, Breadcrumb, Field, Input, Select, Switch, Alert, Icon, StatCard, Tooltip } = window.EpublitDesignSystem_2918d4;

function BookScreen({ libro, onBack, onToast }) {
  const { movimientos, money } = window.EpublitData;
  const [tab, setTab] = React.useState('ficha');
  const [ecom, setEcom] = React.useState(libro.ecom);
  return (
    <div style={{display:'grid',gap:'var(--space-4)'}}>
      <Breadcrumb items={['Catálogo','Libros',libro.titulo]} onNavigate={(it,i)=>{ if(i<2) onBack(); }} />
      <div style={{display:'flex',alignItems:'flex-start',gap:'var(--space-4)'}}>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:0}}>{libro.titulo}</h1>
          <p style={{margin:'4px 0 0',fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>
            {libro.autor} · {libro.sello} · <span style={{fontFamily:'var(--font-mono)'}}>{libro.isbn}</span>
          </p>
        </div>
        <Switch label="En ecommerce" checked={ecom} onChange={()=>{setEcom(!ecom);onToast(ecom?'Título retirado del ecommerce':'Título publicado en el ecommerce');}} />
        <Button variant="secondary" size="sm" iconStart="printer">Ficha PDF</Button>
        <Button size="sm" iconStart="pencil" onClick={()=>onToast('Cambios guardados')}>Editar</Button>
      </div>
      <Tabs value={tab} onChange={setTab} items={[
        { value:'ficha', label:'Ficha' },
        { value:'stock', label:'Stock', count:libro.stock },
        { value:'mov', label:'Movimientos', count:movimientos.length },
        { value:'ecom', label:'Ecommerce' },
      ]} />

      {tab === 'ficha' ? (
        <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:'var(--space-4)',alignItems:'start'}}>
          <Card title="Datos del título">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
              <Field label="Título" style={{gridColumn:'1 / -1'}}><Input defaultValue={libro.titulo} /></Field>
              <Field label="Autor"><Input defaultValue={libro.autor} /></Field>
              <Field label="Sello"><Select options={['Sur Editora','Cuenco Azul','Prensa Menor']} defaultValue={libro.sello} /></Field>
              <Field label="ISBN" hint="13 dígitos, sin guiones"><Input iconStart="barcode" defaultValue={libro.isbn} /></Field>
              <Field label="PVP"><Input suffix="ARS" defaultValue={String(libro.pvp)} /></Field>
              <Field label="Formato"><Select options={['Rústica','Tapa dura','Bolsillo']} /></Field>
              <Field label="Páginas"><Input defaultValue="224" /></Field>
            </div>
          </Card>
          <div style={{display:'grid',gap:'var(--space-4)'}}>
            <StatCard label="Stock en depósito" value={libro.stock} unit="ejemplares" delta={libro.estado==='ok'?'Por encima del mínimo':'Por debajo del mínimo (40)'} deltaTone={libro.estado==='ok'?'success':'error'} icon="boxes" />
            <Card title="Distribución" padded={false}>
              <Table dense columns={[
                { header:'Punto de venta', key:'pdv', wrap:true },
                { header:'En consignación', align:'right', mono:true, key:'cant' },
              ]} rows={[
                { pdv:'El Ateneo Central', cant:48 },
                { pdv:'Librería Norte', cant:26 },
                { pdv:'Distribuidora Sur', cant:112 },
              ]} />
            </Card>
          </div>
        </div>
      ) : tab === 'stock' ? (
        <Card title="Existencias por depósito" padded={false}>
          <Table columns={[
            { header:'Depósito', key:'dep', wrap:true },
            { header:'Físico', align:'right', mono:true, key:'fis' },
            { header:'Reservado', align:'right', mono:true, key:'res' },
            { header:'Disponible', align:'right', mono:true, key:'disp' },
          ]} rows={[
            { dep:'Depósito central', fis:340, res:26, disp:314 },
            { dep:'Oficina · exhibición', fis:12, res:0, disp:12 },
            { dep:'Feria del Libro', fis:60, res:60, disp:0 },
          ]} />
        </Card>
      ) : tab === 'mov' ? (
        <Card title="Movimientos de stock" subtitle="Últimos 30 días" padded={false}
          actions={<Button variant="secondary" size="sm" iconStart="download">Exportar</Button>}>
          <Table columns={[
            { header:'Fecha', key:'fecha', mono:true, muted:true },
            { header:'Tipo', cell:r => r.tipo==='Entrada' ? <Badge tone="success">Entrada</Badge> : r.tipo==='Salida' ? <Badge tone="neutral">Salida</Badge> : <Badge tone="warning">Ajuste</Badge> },
            { header:'Detalle', key:'detalle', wrap:true },
            { header:'Cantidad', align:'right', mono:true, cell:r => <span style={{color:r.cant<0?'var(--text-error)':'var(--text-success)'}}>{r.cant>0?'+'+r.cant:r.cant}</span> },
            { header:'Saldo', align:'right', mono:true, key:'saldo' },
          ]} rows={movimientos} />
        </Card>
      ) : (
        <div style={{display:'grid',gap:'var(--space-4)'}}>
          <Alert tone="info" title="La tienda de tu editorial">Los títulos publicados se sincronizan con el ecommerce cada 15 minutos.</Alert>
          <Card title="Publicación en el ecommerce">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
              <Field label="Precio en tienda"><Input suffix="ARS" defaultValue={String(libro.pvp)} /></Field>
              <Field label="Envío"><Select options={['Estándar','Retiro en editorial','Sin envío']} /></Field>
              <Field label="Estado"><Select options={['Publicado','Borrador','Agotado']} /></Field>
              <Field label="URL" hint="Se genera desde el título">
                <Input defaultValue={'tienda.sureditora.com.ar/' + libro.titulo.toLowerCase().replace(/\s+/g,'-')} />
              </Field>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
Object.assign(window, { BookScreen });
