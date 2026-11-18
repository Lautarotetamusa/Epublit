import { Icon } from "@ds";
import { PREGUNTAS } from "../contenido";
import { ENLACES } from "../enlaces";

export function Preguntas() {
    return (
        <section id="preguntas" className="l-preguntas" aria-labelledby="preguntas-titulo">
            <div className="l-contenedor l-preguntas-ancho">
                <div className="l-encabezado-seccion">
                    <h2 id="preguntas-titulo">Preguntas frecuentes</h2>
                    <p className="l-seccion-bajada">
                        Para el paso a paso de cada trámite está el <a href={ENLACES.ayuda}>centro de ayuda</a>.
                    </p>
                </div>
                <div className="l-preguntas-lista">
                    {PREGUNTAS.map((item) => (
                        <details key={item.pregunta}>
                            <summary>
                                <span>{item.pregunta}</span>
                                <Icon name="chevron-down" size={18} className="l-preguntas-chevron" />
                            </summary>
                            <p>{item.respuesta}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
