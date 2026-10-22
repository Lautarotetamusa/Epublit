const { Button, Card, Badge, Icon, Field, Input, Select, Textarea, Alert, Table } = window.EpublitDesignSystem_2918d4;

const PLANS = [
  { n:'Sello', p:'$ 38.000', d:'por mes', s:'Hasta 150 títulos y 2 usuarios.', f:['Catálogo y fichas','Stock por depósito','Liquidaciones por punto de venta','Soporte por correo'] },
  { n:'Editorial', p:'$ 72.000', d:'por mes', s:'Hasta 800 títulos y 8 usuarios.', f:['Todo lo del plan Sello','Remitos y despachos','Regalías de autor','Informes de venta','Migración asistida'], best:true },
  { n:'Grupo', p:'A medida', d:'', s:'Varios sellos, catálogos separados.', f:['Todo lo del plan Editorial','Multi-sello','Tienda propia (próximamente)','Soporte dedicado'] },
];

function Pricing({ onPage }) {
  return (
    <section style={{padding:'var(--space-20) 0',background:'var(--surface-page)'}}>
      <div style={{maxWidth:'var(--width-content)',margin:'0 auto',padding:'0 var(--gutter-page)'}}>
        <span className="eyebrow">Precios</span>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:'var(--space-3) 0 var(--space-2)'}}>Un precio por tamaño de catálogo.</h2>
        <p style={{margin:'0 0 var(--space-10)',fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>Precios de referencia en pesos, sin IVA. Se factura por mes, se cancela cuando quieras.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-4)',alignItems:'start'}}>
          {PLANS.map(pl=>(
            <div key={pl.n} style={{
              background:'var(--surface-card)',
              border:'1px solid '+(pl.best?'var(--pino-300)':'var(--border-subtle)'),
              borderRadius:'var(--radius-md)',
              boxShadow: pl.best ? 'var(--shadow-md)' : 'var(--shadow-xs)',
              padding:'var(--space-6)',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:'var(--space-2)'}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-lg)',fontWeight:'var(--weight-semibold)',margin:0}}>{pl.n}</h3>
                {pl.best ? <Badge tone="brand">Más elegido</Badge> : null}
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:6,marginTop:'var(--space-4)'}}>
                <span style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-medium)',letterSpacing:'var(--tracking-tight)'}}>{pl.p}</span>
                {pl.d ? <span style={{fontSize:'var(--text-xs)',color:'var(--text-muted)'}}>{pl.d}</span> : null}
              </div>
              <p style={{margin:'var(--space-2) 0 var(--space-5)',fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>{pl.s}</p>
              <Button fullWidth variant={pl.best?'primary':'secondary'} onClick={()=>onPage('demo')}>{pl.p==='A medida'?'Hablar con ventas':'Empezar'}</Button>
              <ul style={{listStyle:'none',margin:'var(--space-5) 0 0',padding:0,display:'grid',gap:'var(--space-2)'}}>
                {pl.f.map(x=>(
                  <li key={x} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:'var(--text-sm)',color:'var(--text-body)'}}>
                    <Icon name="check" size={15} color="var(--pino-600)" style={{marginTop:2}} />{x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoForm({ onSent, sent }) {
  return (
    <section style={{padding:'var(--space-20) 0',background:'var(--surface-page)'}}>
      <div style={{maxWidth:760,margin:'0 auto',padding:'0 var(--gutter-page)'}}>
        <span className="eyebrow">Demo</span>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:'var(--space-3) 0 var(--space-2)'}}>Veamos tu catálogo en Epublit.</h2>
        <p style={{margin:'0 0 var(--space-6)',fontSize:'var(--text-sm)',color:'var(--text-muted)',maxWidth:'56ch',textWrap:'pretty'}}>
          Contanos cómo trabajás hoy. Coordinamos una llamada de 30 minutos y, si querés,
          cargamos una parte de tu catálogo real para que lo veas funcionando.
        </p>
        <Card>
          {sent ? <Alert tone="success" title="Recibimos tu pedido">Te escribimos dentro de las próximas 48 horas hábiles.</Alert> : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--space-4)'}}>
              <Field label="Editorial" required><Input placeholder="Sur Editora" /></Field>
              <Field label="Nombre y apellido" required><Input placeholder="Lucía Ferreyra" /></Field>
              <Field label="Correo" required><Input placeholder="lucia@sureditora.com.ar" /></Field>
              <Field label="Títulos en catálogo"><Select placeholder="Elegí un rango" options={['Menos de 50','50 a 150','150 a 800','Más de 800']} /></Field>
              <Field label="¿Cómo gestionás hoy?" style={{gridColumn:'1 / -1'}}><Textarea rows={3} placeholder="Planillas, sistema propio, cuadernos…" /></Field>
              <div style={{gridColumn:'1 / -1',display:'flex',justifyContent:'flex-end'}}>
                <Button iconEnd="arrow-right" onClick={onSent}>Pedir la demo</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

function Help() {
  return (
    <section style={{padding:'var(--space-20) 0',background:'var(--surface-page)'}}>
      <div style={{maxWidth:'var(--width-content)',margin:'0 auto',padding:'0 var(--gutter-page)'}}>
        <span className="eyebrow">Ayuda</span>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-2xl)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:'var(--space-3) 0 var(--space-8)'}}>Preguntas que nos hacen seguido.</h2>
        <div style={{background:'var(--surface-card)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-md)',boxShadow:'var(--shadow-xs)',overflow:'hidden'}}>
          {[
            ['¿Puedo migrar mi planilla de catálogo?','Sí. Nos pasás el Excel o el CSV y lo importamos en la primera semana, con revisión de ISBN y precios.'],
            ['¿Sirve para consignación y venta en firme?','Las dos. Cada título define su condición comercial y las liquidaciones se calculan según corresponda.'],
            ['¿Cuántos usuarios puedo tener?','Depende del plan: 2, 8 o a medida. Cada usuario tiene su propio acceso y permisos por área.'],
            ['¿La tienda ya está disponible?','Todavía no. El ecommerce por editorial está en desarrollo; si te interesa, te avisamos cuando abra.'],
          ].map(([q,a],i)=>(
            <div key={q} style={{padding:'var(--space-5)',borderTop: i ? '1px solid var(--border-subtle)' : 'none'}}>
              <h3 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-md)',fontWeight:'var(--weight-semibold)',margin:'0 0 4px'}}>{q}</h3>
              <p style={{margin:0,fontSize:'var(--text-sm)',color:'var(--text-muted)',maxWidth:'80ch',textWrap:'pretty'}}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const cols = [
    ['Producto',['Catálogo','Stock','Liquidaciones','Informes']],
    ['Ecommerce',['Tienda por editorial','Sincronización','Envíos']],
    ['Editorial',['Sobre Epublit','Ayuda','Contacto']],
  ];
  return (
    <footer style={{background:'var(--pino-900)',color:'var(--pino-200)',padding:'var(--space-12) 0 var(--space-8)'}}>
      <div style={{maxWidth:'var(--width-content)',margin:'0 auto',padding:'0 var(--gutter-page)',display:'grid',gridTemplateColumns:'1.4fr repeat(3,1fr)',gap:'var(--space-10)'}}>
        <div>
          <img src="../../assets/logo-epublit-lockup-light.png" alt="Epublit" style={{height:22,width:'auto'}} />
          <p style={{margin:'var(--space-4) 0 0',fontSize:'var(--text-xs)',lineHeight:'var(--leading-relaxed)',maxWidth:'34ch',color:'rgba(217,234,232,.7)'}}>
            Sistema de gestión para editoriales chicas y medianas. Hecho en Argentina.
          </p>
        </div>
        {cols.map(([t,items])=>(
          <div key={t}>
            <span className="eyebrow" style={{color:'rgba(217,234,232,.45)'}}>{t}</span>
            <ul style={{listStyle:'none',margin:'var(--space-3) 0 0',padding:0,display:'grid',gap:'var(--space-2)'}}>
              {items.map(i=><li key={i} style={{fontSize:'var(--text-xs)'}}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div style={{maxWidth:'var(--width-content)',margin:'var(--space-10) auto 0',padding:'var(--space-5) var(--gutter-page) 0',borderTop:'1px solid rgba(255,255,255,.08)',fontSize:'var(--text-2xs)',color:'rgba(217,234,232,.5)'}}>
        © 2026 Epublit · Términos · Privacidad
      </div>
    </footer>
  );
}
Object.assign(window, { Pricing, DemoForm, Help, SiteFooter });
