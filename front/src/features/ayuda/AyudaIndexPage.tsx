import { Link } from "react-router-dom";
import { Icon } from "../../design-system";
import { ARTICULOS, agruparPorTema, contarPasos } from "./articulos";
import { useTituloDocumento } from "./useTituloDocumento";

export function AyudaIndexPage() {
    useTituloDocumento("Centro de ayuda · Epublit");

    return (
        <div className="ayuda-indice">
            <header className="ayuda-indice__encabezado">
                <h1>Centro de ayuda</h1>
                <p className="ayuda-bajada">
                    Guías paso a paso para los trámites de tu editorial, en Epublit y en ARCA. Seguilas a tu ritmo, con las capturas
                    de las pantallas que vas a ver.
                </p>
            </header>

            {agruparPorTema(ARTICULOS).map(({ tema, articulos }, indiceTema) => (
                <section key={tema} className="ayuda-indice__tema" aria-labelledby={`tema-${indiceTema}`}>
                    <h2 id={`tema-${indiceTema}`}>{tema}</h2>
                    <ul className="ayuda-indice__lista">
                        {articulos.map((articulo) => (
                            <li key={articulo.slug}>
                                <Link to={`/ayuda/${articulo.slug}`} className="ayuda-indice__entrada">
                                    <span className="ayuda-indice__texto">
                                        <span className="ayuda-indice__titulo">{articulo.titulo}</span>
                                        <span className="ayuda-indice__resumen">{articulo.resumen}</span>
                                        <span className="ayuda-meta">
                                            {contarPasos(articulo)} pasos · Actualizado el {articulo.actualizado}
                                        </span>
                                    </span>
                                    <Icon name="arrow-right" size={18} className="ayuda-indice__flecha" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}
