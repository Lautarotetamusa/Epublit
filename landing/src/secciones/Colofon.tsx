import { ENLACES } from "../enlaces";

export function Colofon() {
    return (
        <footer className="l-colofon">
            <div className="l-contenedor l-colofon-grilla">
                <div>
                    <img src="/epublit-logo-oscuro.png" alt="Epublit" width={110} height={32} />
                    <p className="l-colofon-texto">
                        Sistema de gestión para editoriales. Desarrollado por{" "}
                        <a href={ENLACES.thorque}>Thorque Software</a>.
                    </p>
                </div>
                <nav aria-label="Producto">
                    <h2>Producto</h2>
                    <ul>
                        <li><a href="#funcionalidades">Funcionalidades</a></li>
                        <li><a href="#planes">Planes</a></li>
                        <li><a href="#preguntas">Preguntas frecuentes</a></li>
                    </ul>
                </nav>
                <nav aria-label="Cuenta">
                    <h2>Cuenta</h2>
                    <ul>
                        <li><a href={ENLACES.registrarse}>Crear cuenta</a></li>
                        <li><a href={ENLACES.iniciarSesion}>Iniciar sesión</a></li>
                        <li><a href={ENLACES.ayuda}>Centro de ayuda</a></li>
                    </ul>
                </nav>
            </div>
            <div className="l-contenedor l-colofon-pie">
                <p>
                    © {new Date().getFullYear()} Epublit. Todos los derechos reservados.
                </p>
            </div>
        </footer>
    );
}
