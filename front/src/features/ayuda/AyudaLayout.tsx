import { Link, Outlet } from "react-router-dom";
import { Icon } from "../../design-system";
import logoEpublit from "../../design-system/assets/logo-epublit-lockup-light.png";
import { useAuth } from "../../auth/AuthContext";
import "./ayuda.css";

// La ayuda vive fuera del AppLayout porque se abre desde un mail, muchas
// veces sin sesión: la misma cabecera sirve con o sin sesión y sólo cambia
// la salida hacia la app.
export function AyudaLayout() {
    const { user } = useAuth();

    return (
        <div className="ayuda">
            <header className="ayuda-cabecera">
                <div className="ayuda-cabecera__contenido">
                    <Link to="/ayuda" className="ayuda-cabecera__marca">
                        <img src={logoEpublit} alt="Epublit" height={24} />
                        <span className="ayuda-cabecera__seccion">Centro de ayuda</span>
                    </Link>
                    <Link to="/" className="ayuda-cabecera__salida">
                        {user ? "Volver a Epublit" : "Ingresar"}
                        <Icon name="arrow-right" size={16} />
                    </Link>
                </div>
            </header>
            <main className="ayuda-principal">
                <Outlet />
            </main>
        </div>
    );
}
