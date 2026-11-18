import { Icon } from "@ds";
import { FUNCIONALIDADES } from "../contenido";

export function Resumen() {
    return (
        <section id="funcionalidades" className="l-resumen" aria-labelledby="resumen-titulo">
            <div className="l-contenedor">
                <div className="l-encabezado-seccion">
                    <h2 id="resumen-titulo">Todo lo que necesita tu editorial</h2>
                    <p className="l-seccion-bajada">
                        Desde que el libro llega de la imprenta hasta que le pagás los derechos a quien lo escribió.
                    </p>
                </div>
                <ul className="l-resumen-grilla">
                    {FUNCIONALIDADES.map((funcionalidad) => (
                        <li key={funcionalidad.id}>
                            <a href={`#${funcionalidad.id}`} className="l-resumen-item">
                                <span className="l-resumen-icono">
                                    <Icon name={funcionalidad.icono} size={22} />
                                </span>
                                <span className="l-resumen-nombre">{funcionalidad.nombre}</span>
                                <span className="l-resumen-texto">{funcionalidad.resumen}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
