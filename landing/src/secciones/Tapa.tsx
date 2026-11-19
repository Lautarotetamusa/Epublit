import { Button } from "@ds";
import { ENLACES } from "../enlaces";
import { Captura } from "../muestras/Captura";

export function Tapa() {
    return (
        <section id="inicio" className="l-tapa" aria-labelledby="tapa-titulo">
            <div className="l-contenedor l-tapa-texto">
                <h1 id="tapa-titulo">Gestioná tu editorial en un solo lugar</h1>
                <p className="l-tapa-bajada">
                    Epublit es el sistema web para editoriales chicas y medianas. Cargás cada título una vez y con esa
                    misma ficha movés stock, consignás en librerías, facturás ante ARCA, liquidás derechos de autor y
                    vendés en tu tienda online.
                </p>
                <div className="l-acciones">
                    <Button href={ENLACES.registrarse} size="lg" iconEnd="arrow-right">
                        Probar gratis un mes
                    </Button>
                    <Button href="#planes" variant="secondary" size="lg">
                        Ver planes
                    </Button>
                </div>
                <p className="l-tapa-nota">
                    Un mes de prueba gratis, con todo incluido. ¿Ya tenés cuenta? <a href={ENLACES.iniciarSesion}>Iniciá sesión</a>.
                </p>
            </div>
            <div className="l-contenedor l-tapa-captura">
                <Captura
                    archivo="catalogo-libros.webp"
                    ruta="libros"
                    ancho={1366}
                    alto={628}
                    prioritaria
                    alt="Catálogo de libros en Epublit: listado con tapa, título, ISBN, precio, stock total y fecha de edición."
                />
            </div>
        </section>
    );
}
