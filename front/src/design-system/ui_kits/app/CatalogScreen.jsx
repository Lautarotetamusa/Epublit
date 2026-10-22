const { Card, Table, Badge, Button, IconButton, Pagination, Select, Input, Tabs, Checkbox, Dialog, Field, Textarea, Switch, Radio } = window.EpublitDesignSystem_2918d4;

function CatalogScreen({ onOpenBook, onToast }) {
  const { libros, money } = window.EpublitData;
  const [tab, setTab] = React.useState('todos');
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [modo, setModo] = React.useState('cons');
  const [ecom, setEcom] = React.useState(true);
  const [sel, setSel] = React.useState([]);

  const filtered = libros.filter(l =>
    (tab === 'todos' || (tab === 'ecom' ? l.ecom : tab === 'bajo' ? l.estado !== 'ok' : true)) &&
    (l.titulo + l.autor + l.isbn).toLowerCase().includes(q.toLowerCase())
  );
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);

  return (
    <div style={{display:'grid',gap:'var(--space-4)'}}>
      <Tabs value={tab} onChange={setTab} items={[
        { value:'todos', label:'Todos', count:libros.length },
        { value:'ecom', label:'En ecommerce', count:libros.filter(l=>l.ecom).length },
        { value:'bajo', label:'Stock crítico', count:libros.filter(l=>l.estado!=='ok').length },
      ]} />
      <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
        <Input size="sm" iconStart="search" placeholder="Buscar por título, autor o ISBN" value={q} onChange={e=>setQ(e.target.value)} style={{width:300}} />
        <Select size="sm" placeholder="Todos los sellos" options={['Sur Editora','Cuenco Azul','Prensa Menor']} style={{width:170}} />
        <Select size="sm" placeholder="Todos los estados" options={['En stock','Stock bajo','Sin stock']} style={{width:170}} />
        <div style={{flex:1}} />
        {sel.length ? <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{sel.length} seleccionados</span> : null}
        <Button variant="secondary" size="sm" iconStart="download">Exportar</Button>
        <Button size="sm" iconStart="plus" onClick={()=>setOpen(true)}>Nuevo libro</Button>
      </div>
      <Card padded={false} footer={<Pagination page={1} pageCount={28} total={168} onChange={()=>{}} />}>
        <Table columns={[
          { header:<Checkbox indeterminate={sel.length>0} onChange={()=>setSel([])} />, width:38,
            cell:r => <Checkbox checked={sel.includes(r.id)} onChange={()=>toggle(r.id)} /> },
          { header:'Título', wrap:true, cell:r => (
            <span>
              <span style={{display:'block',fontWeight:'var(--weight-medium)'}}>{r.titulo}</span>
              <span style={{display:'block',fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{r.autor} · {r.sello}</span>
            </span>) },
          { header:'ISBN', key:'isbn', mono:true, muted:true },
          { header:'PVP', align:'right', mono:true, cell:r=>money(r.pvp) },
          { header:'Stock', align:'right', mono:true, key:'stock' },
          { header:'Estado', cell:r => r.estado==='ok' ? <Badge tone="success" dot>En stock</Badge> : r.estado==='bajo' ? <Badge tone="warning">Stock bajo</Badge> : <Badge tone="error">Sin stock</Badge> },
          { header:'Canal', cell:r => r.ecom ? <Badge tone="accent" icon="store">Ecommerce</Badge> : <Badge>Solo interno</Badge> },
          { header:'', width:70, cell:r => (
            <span style={{display:'flex',gap:2,justifyContent:'flex-end'}}>
              <IconButton icon="pencil" label="Editar" size="sm" onClick={e=>{e.stopPropagation();onToast('Ficha abierta para editar');}} />
              <IconButton icon="ellipsis" label="Más acciones" size="sm" onClick={e=>e.stopPropagation()} />
            </span>) },
        ]} rows={filtered} onRowClick={onOpenBook} empty="Ningún título coincide con la búsqueda." />
      </Card>

      <Dialog open={open} title="Nuevo libro" description="Los datos mínimos para que el título entre al catálogo." width={560}
        onClose={()=>setOpen(false)}
        footer={<>
          <Button variant="secondary" size="sm" onClick={()=>setOpen(false)}>Cancelar</Button>
          <Button size="sm" onClick={()=>{setOpen(false);onToast('Libro guardado');}}>Guardar libro</Button>
        </>}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
          <Field label="Título" required style={{gridColumn:'1 / -1'}}><Input placeholder="Título del libro" /></Field>
          <Field label="Autor" required><Input placeholder="Nombre y apellido" /></Field>
          <Field label="Sello"><Select placeholder="Elegí un sello" options={['Sur Editora','Cuenco Azul','Prensa Menor']} /></Field>
          <Field label="ISBN" hint="13 dígitos, sin guiones"><Input iconStart="barcode" placeholder="9789871234567" /></Field>
          <Field label="PVP"><Input suffix="ARS" placeholder="0" /></Field>
          <Field label="Sinopsis" style={{gridColumn:'1 / -1'}}><Textarea rows={2} placeholder="Texto de contratapa" /></Field>
          <div style={{gridColumn:'1 / -1',display:'grid',gap:'var(--space-2)',padding:'var(--space-3) var(--space-4)',background:'var(--papel-50)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)'}}>
            <span style={{fontSize:'var(--text-xs)',fontWeight:'var(--weight-semibold)',color:'var(--papel-700)'}}>Condición comercial</span>
            <Radio name="modo" label="Consignación" description="Se liquida sobre lo vendido" checked={modo==='cons'} onChange={()=>setModo('cons')} />
            <Radio name="modo" label="Venta en firme" description="Se factura al despachar" checked={modo==='firme'} onChange={()=>setModo('firme')} />
            <div style={{height:1,background:'var(--border-subtle)',margin:'2px 0'}} />
            <Switch label="Publicar en el ecommerce" checked={ecom} onChange={()=>setEcom(!ecom)} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
Object.assign(window, { CatalogScreen });
