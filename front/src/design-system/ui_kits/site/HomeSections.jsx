const { Button, Badge, Card, Table, StatCard, Icon } = window.EpublitDesignSystem_2918d4;

function AppPreview() {
  const { libros, money } = window.EpublitData;
  return (
    <div style={{background:'var(--papel-0)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow-lg)',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:7,height:32,padding:'0 12px',background:'var(--papel-100)',borderBottom:'1px solid var(--border-subtle)'}}>
        <span style={{width:8,height:8,borderRadius:'var(--radius-pill)',background:'var(--papel-300)'}} />
        <span style={{width:8,height:8,borderRadius:'var(--radius-pill)',background:'var(--papel-300)'}} />
        <span style={{width:8,height:8,borderRadius:'var(--radius-pill)',background:'var(--papel-300)'}} />
        <span style={{marginLeft:8,fontFamily:'var(--font-mono)',fontSize:'var(--text-2xs)',color:'var(--text-subtle)'}}>app.epublit.com / catálogo</span>
      </div>
      <div style={{display:'flex'}}>
        <div style={{width:56,background:'var(--pino-900)',padding:'12px 0',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
          <img src="../../assets/mark-epublit.png" alt="" style={{width:20,opacity:.9}} />
          {['layout-dashboard','book-open','boxes','receipt-text','chart-line'].map((n,i)=>(
            <Icon key={n} name={n} size={16} color={i===1?'var(--pino-200)':'rgba(181,213,210,.5)'} />
          ))}
        </div>
        <div style={{flex:1,minWidth:0,padding:'var(--space-4)',display:'grid',gap:'var(--space-3)',background:'var(--surface-page)'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-3)'}}>
            <StatCard label="Ventas del mes" value={money(1842500)} icon="banknote" />
            <StatCard label="Ejemplares" value="1.204" icon="package" />
            <StatCard label="Por liquidar" value={money(1044300)} icon="receipt-text" />
          </div>
          <Card padded={false}>
            <Table dense columns={[
              { header:'Título', key:'titulo', wrap:true },
              { header:'ISBN', key:'isbn', mono:true, muted:true },
              { header:'Stock', key:'stock', align:'right', mono:true },
              { header:'Estado', cell:r => r.estado==='ok' ? <Badge tone="success" dot>En stock</Badge> : r.estado==='bajo' ? <Badge tone="warning">Stock bajo</Badge> : <Badge tone="error">Sin stock</Badge> },
            ]} rows={libros.slice(0,4)} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Hero({ onPage }) {
  return (
    <section style={{background:'var(--pino-900)',color:'var(--papel-50)',padding:'var(--space-20) 0 var(--space-24)'}}>
      <div style={{maxWidth:'var(--width-content)',margin:'0 auto',padding:'0 var(--gutter-page)',display:'grid',gridTemplateColumns:'1fr 1.05fr',gap:'var(--space-16)',alignItems:'center'}}>
        <div>
          <span className="eyebrow" style={{color:'var(--pino-300)'}}>Gestión editorial</span>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-4xl)',fontWeight:'var(--weight-medium)',lineHeight:1.08,letterSpacing:'var(--tracking-tight)',margin:'var(--space-4) 0 0',textWrap:'pretty'}}>
            Tu catálogo, tu stock y tus liquidaciones, ordenados.
          </h1>
          <p style={{margin:'var(--space-5) 0 0',fontSize:'var(--text-md)',lineHeight:'var(--leading-relaxed)',color:'var(--pino-200)',maxWidth:'46ch',textWrap:'pretty'}}>
            Epublit es el sistema web para editoriales chicas y medianas. Cargá una vez cada
            título y usalo en todo el circuito: depósito, librerías, consignaciones y cierre de mes.
          </p>
          <div style={{display:'flex',gap:'var(--space-3)',marginTop:'var(--space-8)'}}>
            <Button size="lg" variant="accent" iconEnd="arrow-right" onClick={()=>onPage('demo')}>Pedir una demo</Button>
            <Button size="lg" variant="secondary" onClick={()=>onPage('precios')}>Ver precios</Button>
          </div>
          <p style={{margin:'var(--space-6) 0 0',fontSize:'var(--text-xs)',color:'rgba(217,234,232,.6)'}}>
            Sin instalación. Migramos tu planilla de catálogo en la primera semana.
          </p>
        </div>
        <AppPreview />
      </div>
    </section>
  );
}

const FEATURES = [
  ['book-open','Catálogo único','Ficha completa por título: autor, sello, ISBN, formato, precio y sinopsis. Se carga una vez y alimenta todo lo demás.'],
  ['boxes','Stock por depósito','Físico, reservado y disponible, con el detalle de lo que está en consignación en cada librería.'],
  ['receipt-text','Liquidaciones sin planillas','Cargás las ventas informadas y Epublit calcula bruto, comisión y neto por punto de venta.'],
  ['truck','Remitos y despachos','Cada salida deja movimiento de stock y remito imprimible, con el saldo al día.'],
  ['chart-line','Informes de venta','Qué se vende, dónde y a qué ritmo, por título, sello o período.'],
  ['users','Autores y regalías','Contratos, porcentajes y liquidación de regalías sobre ventas reales.'],
];

function Features() {
  return (
    <section style={{padding:'var(--space-20) 0',background:'var(--surface-page)'}}>
      <div style={{maxWidth:'var(--width-content)',margin:'0 auto',padding:'0 var(--gutter-page)'}}>
        <span className="eyebrow">Qué incluye</span>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:'var(--space-3) 0 var(--space-10)',maxWidth:'28ch',textWrap:'pretty'}}>
          Todo el circuito de una editorial, en un solo sistema.
        </h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-4)'}}>
          {FEATURES.map(([icon,t,d])=>(
            <div key={t} style={{background:'var(--surface-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',boxShadow:'var(--shadow-xs)',padding:'var(--space-5)'}}>
              <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:36,height:36,borderRadius:'var(--radius-sm)',background:'var(--pino-50)',border:'1px solid var(--pino-100)'}}>
                <Icon name={icon} size={18} color="var(--pino-600)" />
              </span>
              <h3 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-md)',fontWeight:'var(--weight-semibold)',margin:'var(--space-4) 0 var(--space-2)'}}>{t}</h3>
              <p style={{margin:0,fontSize:'var(--text-sm)',lineHeight:'var(--leading-relaxed)',color:'var(--text-muted)',textWrap:'pretty'}}>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Ecommerce({ onPage }) {
  return (
    <section style={{padding:'var(--space-20) 0',background:'var(--violeta-50)',borderTop:'1px solid var(--violeta-100)',borderBottom:'1px solid var(--violeta-100)'}}>
      <div style={{maxWidth:'var(--width-content)',margin:'0 auto',padding:'0 var(--gutter-page)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-16)',alignItems:'center'}}>
        <div>
          <Badge tone="accent" icon="store">Próximamente</Badge>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:'var(--space-4) 0 var(--space-4)',maxWidth:'26ch',textWrap:'pretty'}}>
            Una tienda a medida de tu editorial.
          </h2>
          <p style={{margin:0,fontSize:'var(--text-md)',lineHeight:'var(--leading-relaxed)',color:'var(--violeta-900)',maxWidth:'44ch',textWrap:'pretty'}}>
            El mismo catálogo que usás para gestionar es el que publicás. Precios, stock y
            fichas se sincronizan solos; la tienda lleva tu marca, no la nuestra.
          </p>
          <div style={{display:'flex',gap:'var(--space-3)',marginTop:'var(--space-6)'}}>
            <Button variant="accent" iconEnd="arrow-right" onClick={()=>onPage('demo')}>Quiero saber más</Button>
          </div>
        </div>
        <div style={{background:'var(--papel-0)',border:'1px solid var(--violeta-100)',borderRadius:'var(--radius-lg)',boxShadow:'var(--shadow-md)',padding:'var(--space-5)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'var(--space-4)'}}>
            <span style={{fontFamily:'var(--font-display)',fontSize:'var(--text-md)',fontWeight:'var(--weight-semibold)'}}>tienda.sureditora.com.ar</span>
            <Badge tone="accent">Sincronizado</Badge>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-3)'}}>
            {window.EpublitData.libros.slice(0,3).map(l=>(
              <div key={l.id} style={{border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',overflow:'hidden'}}>
                <div style={{height:88,background:'var(--pino-800)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <img src="../../assets/mark-epublit.png" alt="" style={{width:26,opacity:.75}} />
                </div>
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:'var(--text-xs)',fontWeight:'var(--weight-semibold)',lineHeight:1.25}}>{l.titulo}</div>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-2xs)',color:'var(--text-muted)',marginTop:3}}>{window.EpublitData.money(l.pvp)}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{margin:'var(--space-4) 0 0',fontSize:'var(--text-2xs)',color:'var(--text-subtle)'}}>
            Marcadores de posición: falta material fotográfico de tapas.
          </p>
        </div>
      </div>
    </section>
  );
}
Object.assign(window, { Hero, Features, Ecommerce, AppPreview });
