import { Button } from "@ds";
import { ENLACES } from "../enlaces";

const SECCIONES = [
    { href: "#funcionalidades", texto: "Funcionalidades" },
    { href: "#planes", texto: "Planes" },
    { href: "#preguntas", texto: "Preguntas" }
];

export function Encabezado() {
    return (
        <header className="l-encabezado">
            <div className="l-contenedor l-encabezado-fila">
                <a href="#inicio" className="l-logo" aria-label="Epublit, inicio">
                    <img src="/epublit-logo-oscuro.png" alt="Epublit" width={102} height={30} />
                </a>
                <nav className="l-nav" aria-label="Secciones">
                    {SECCIONES.map((seccion) => (
                        <a key={seccion.href} href={seccion.href}>
                            {seccion.texto}
                        </a>
                    ))}
                    <a href={ENLACES.ayuda}>Ayuda</a>
                </nav>
                <div className="l-encabezado-acciones">
                    <a href={ENLACES.demo} className="l-demo">
                        Demo
                    </a>
                    <a href={ENLACES.iniciarSesion} className="l-ingresar">
                        Iniciar sesión
                    </a>
                    <Button href={ENLACES.registrarse} size="sm">
                        Registrarse
                    </Button>
                </div>
            </div>
        </header>
    );
}
