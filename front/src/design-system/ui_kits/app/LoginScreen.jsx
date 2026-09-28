const { Button, Field, Input, Checkbox, Alert } = window.EpublitDesignSystem_2918d4;

function LoginScreen({ onLogin }) {
  const [err, setErr] = React.useState(false);
  return (
    <div style={{display:'flex',height:'100%',background:'var(--surface-page)'}}>
      <div style={{flex:'0 0 46%',background:'var(--pino-900)',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'var(--space-12) var(--space-10)'}}>
        <img src="../../assets/logo-epublit-lockup-light.png" alt="Epublit" style={{height:30,width:'auto'}} />
        <div>
          <h1 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-3xl)',fontWeight:'var(--weight-medium)',letterSpacing:'var(--tracking-tight)',color:'var(--papel-50)',margin:0,maxWidth:'22ch',textWrap:'pretty'}}>
            El catálogo, el stock y las liquidaciones en un solo lugar.
          </h1>
          <p style={{margin:'var(--space-4) 0 0',fontSize:'var(--text-md)',color:'var(--pino-200)',maxWidth:'34ch',textWrap:'pretty'}}>
            Sistema de gestión para editoriales chicas y medianas.
          </p>
        </div>
        <span style={{fontSize:'var(--text-2xs)',letterSpacing:'var(--tracking-caps)',textTransform:'uppercase',color:'rgba(217,234,232,.45)'}}>Epublit · 2026</span>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'var(--space-10)'}}>
        <div style={{width:340,display:'grid',gap:'var(--space-4)'}}>
          <div>
            <h2 style={{fontFamily:'var(--font-display)',fontSize:'var(--text-xl)',fontWeight:'var(--weight-semibold)',letterSpacing:'var(--tracking-tight)',margin:0}}>Entrar a tu editorial</h2>
            <p style={{margin:'4px 0 0',fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>Usá el correo con el que te dimos de alta.</p>
          </div>
          {err ? <Alert tone="error" title="No pudimos entrar" onClose={()=>setErr(false)}>Revisá el correo y la contraseña.</Alert> : null}
          <Field label="Correo" htmlFor="mail"><Input id="mail" iconStart="user-round" defaultValue="lucia@sureditora.com.ar" /></Field>
          <Field label="Contraseña" htmlFor="pass"><Input id="pass" type="password" defaultValue="epublit2026" /></Field>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <Checkbox label="Mantener sesión" checked onChange={()=>{}} />
            <a href="#" style={{fontSize:'var(--text-xs)'}}>Olvidé mi contraseña</a>
          </div>
          <Button fullWidth size="lg" onClick={onLogin}>Entrar</Button>
          <p style={{margin:0,fontSize:'var(--text-xs)',color:'var(--text-subtle)',textAlign:'center'}}>¿Tu editorial todavía no usa Epublit? <a href="#">Pedí una demo</a></p>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { LoginScreen });
