import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, EmptyState, Icon } from "../../design-system";
import type { Articulo, Captura, Cierre, Paso, Seccion } from "./tipos";
import { buscarArticulo, contarPasos } from "./articulos";
import { usePasosHechos } from "./usePasosHechos";
import { useTituloDocumento } from "./useTituloDocumento";

export function ArticuloPage() {
    const { slug = "" } = useParams();
    const articulo = buscarArticulo(slug);

    if (!articulo) return <ArticuloInexistente />;
    return <ArticuloAyuda key={articulo.slug} articulo={articulo} />;
}

function ArticuloInexistente() {
    const navigate = useNavigate();
    useTituloDocumento("Centro de ayuda · Epublit");

    return (
        <div className="ayuda-indice">
            <EmptyState
                icon="file-text"
                title="No encontramos esta guía"
                description="Puede que el link esté incompleto o que la guía haya cambiado de lugar. Buscala en el centro de ayuda."
                action={
                    <Button onClick={() => navigate("/ayuda")}>
                        Ir al centro de ayuda
                    </Button>
                }
            />
        </div>
    );
}

type SeccionNumerada = { seccion: Seccion; primerPaso: number };

// La numeración de los pasos es corrida en todo el artículo (no reinicia por
// sección) para que "voy por el paso 9" signifique una sola cosa.
const numerarSecciones = (secciones: Seccion[]): SeccionNumerada[] =>
    secciones.reduce<SeccionNumerada[]>((numeradas, seccion) => {
        const anterior = numeradas.at(-1);
        const primerPaso = anterior ? anterior.primerPaso + anterior.seccion.pasos.length : 1;
        return [...numeradas, { seccion, primerPaso }];
    }, []);

function ArticuloAyuda({ articulo }: { articulo: Articulo }) {
    useTituloDocumento(`${articulo.titulo} · Centro de ayuda de Epublit`);
    const { pasosHechos, alternarPaso } = usePasosHechos(articulo.slug);
    const secciones = numerarSecciones(articulo.secciones);
    const totalPasos = contarPasos(articulo);

    return (
        <div className="ayuda-articulo">
            <aside className="ayuda-articulo__lateral">
                <IndiceArticulo secciones={secciones} pasosHechos={pasosHechos} totalPasos={totalPasos} />
            </aside>

            <article className="ayuda-articulo__cuerpo">
                <header className="ayuda-articulo__encabezado">
                    <Link to="/ayuda" className="ayuda-volver">
                        <Icon name="chevron-left" size={16} />
                        Centro de ayuda
                    </Link>
                    <h1>{articulo.titulo}</h1>
                    <p className="ayuda-bajada">{articulo.resumen}</p>
                    <p className="ayuda-meta">
                        {articulo.tema} · {totalPasos} pasos · Actualizado el {articulo.actualizado}
                    </p>
                    <p className="ayuda-meta ayuda-meta--consejo">
                        <Icon name="check" size={14} />
                        Tocá el número de cada paso para marcarlo como hecho: el avance queda guardado en este navegador.
                    </p>
                </header>

                {articulo.requisitos ? <Requisitos requisitos={articulo.requisitos} /> : null}

                {secciones.map(({ seccion, primerPaso }) => (
                    <SeccionArticulo
                        key={seccion.id}
                        seccion={seccion}
                        primerPaso={primerPaso}
                        pasosHechos={pasosHechos}
                        onAlternarPaso={alternarPaso}
                    />
                ))}

                {articulo.cierre ? <CierreArticulo cierre={articulo.cierre} /> : null}
            </article>
        </div>
    );
}

function IndiceArticulo({
    secciones,
    pasosHechos,
    totalPasos
}: {
    secciones: SeccionNumerada[];
    pasosHechos: Set<number>;
    totalPasos: number;
}) {
    return (
        <nav className="ayuda-indice-articulo" aria-label="En esta guía">
            <p className="ayuda-indice-articulo__rotulo">En esta guía</p>
            <ol>
                {secciones.map(({ seccion, primerPaso }) => {
                    const ultimoPaso = primerPaso + seccion.pasos.length - 1;
                    const hechos = [...pasosHechos].filter((numero) => numero >= primerPaso && numero <= ultimoPaso).length;
                    const completa = hechos === seccion.pasos.length;
                    return (
                        <li key={seccion.id} className={completa ? "es-completa" : undefined}>
                            <a href={`#${seccion.id}`}>
                                <span className="ayuda-indice-articulo__titulo">{seccion.titulo}</span>
                                <span className="ayuda-indice-articulo__pasos">
                                    {completa ? <Icon name="check" size={14} /> : null}
                                    Pasos {primerPaso} a {ultimoPaso}
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ol>
            <p className="ayuda-indice-articulo__avance">
                {pasosHechos.size} de {totalPasos} pasos hechos
            </p>
        </nav>
    );
}

function Requisitos({ requisitos }: { requisitos: NonNullable<Articulo["requisitos"]> }) {
    return (
        <Card title="Antes de empezar" subtitle="Tené esto a mano." className="ayuda-requisitos">
            <ul>
                {requisitos.map((requisito, indice) => (
                    <li key={indice}>
                        <Icon name="check" size={16} />
                        <span>{requisito}</span>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

function SeccionArticulo({
    seccion,
    primerPaso,
    pasosHechos,
    onAlternarPaso
}: {
    seccion: Seccion;
    primerPaso: number;
    pasosHechos: Set<number>;
    onAlternarPaso: (numero: number) => void;
}) {
    return (
        <section id={seccion.id} className="ayuda-seccion" aria-labelledby={`${seccion.id}-titulo`}>
            <h2 id={`${seccion.id}-titulo`}>{seccion.titulo}</h2>
            {seccion.intro ? <p className="ayuda-seccion__intro">{seccion.intro}</p> : null}
            <ol className="ayuda-pasos" start={primerPaso}>
                {seccion.pasos.map((paso, indice) => {
                    const numero = primerPaso + indice;
                    return (
                        <PasoArticulo
                            key={numero}
                            paso={paso}
                            numero={numero}
                            hecho={pasosHechos.has(numero)}
                            onAlternar={() => onAlternarPaso(numero)}
                        />
                    );
                })}
            </ol>
        </section>
    );
}

function PasoArticulo({ paso, numero, hecho, onAlternar }: { paso: Paso; numero: number; hecho: boolean; onAlternar: () => void }) {
    return (
        <li className={hecho ? "ayuda-paso es-hecho" : "ayuda-paso"}>
            <button
                type="button"
                className="ayuda-paso__numero"
                aria-pressed={hecho}
                aria-label={hecho ? `Paso ${numero} hecho. Desmarcar` : `Marcar el paso ${numero} como hecho`}
                title={hecho ? "Desmarcar paso" : "Marcar como hecho"}
                onClick={onAlternar}
            >
                {hecho ? <Icon name="check" size={16} /> : numero}
            </button>
            <div className="ayuda-paso__cuerpo">
                <div className="ayuda-paso__texto">{paso.contenido}</div>
                {paso.capturas ? (
                    <div className="ayuda-capturas">
                        {paso.capturas.map((captura) => (
                            <CapturaPaso key={captura.src} captura={captura} />
                        ))}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

function CapturaPaso({ captura }: { captura: Captura }) {
    return (
        <figure className="ayuda-captura">
            <a href={captura.src} target="_blank" rel="noreferrer" title="Abrir la captura en tamaño completo">
                <img src={captura.src} alt={captura.alt} width={captura.ancho} height={captura.alto} loading="lazy" decoding="async" />
            </a>
            {captura.pie ? <figcaption>{captura.pie}</figcaption> : null}
        </figure>
    );
}

function CierreArticulo({ cierre }: { cierre: Cierre }) {
    const navigate = useNavigate();
    const { accion } = cierre;

    return (
        <section className="ayuda-cierre">
            <Icon name="circle-check" size={22} className="ayuda-cierre__icono" />
            <div>
                <h2>{cierre.titulo}</h2>
                <p>{cierre.texto}</p>
                {accion ? (
                    <Button iconEnd="arrow-right" onClick={() => navigate(accion.ruta)} className="ayuda-cierre__accion">
                        {accion.etiqueta}
                    </Button>
                ) : null}
            </div>
        </section>
    );
}
