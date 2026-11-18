import type { ComponentType } from "react";
import { Icon } from "@ds";
import { FUNCIONALIDADES, type FuncionalidadId } from "../contenido";
import { Captura, type CapturaProps } from "../muestras/Captura";
import { Factura } from "../muestras/Factura";
import { Pedido } from "../muestras/Pedido";
import { Remito } from "../muestras/Remito";

// Captura real cuando la pantalla no muestra datos personales; si no hay
// captura publicable (remito, factura, pedido), una muestra con datos de
// ejemplo armada con el sistema de diseño.
const CAPTURAS: Partial<Record<FuncionalidadId, CapturaProps>> = {
    catalogo: { archivo: "ficha-libro.webp", ruta: "libros/9789874659347", ancho: 1118, alto: 560, alt: "Ficha de un libro en Epublit: tapa, título, ISBN, precio, fecha de edición y descripción." },
    stock: { archivo: "nuevo-movimiento.webp", ruta: "movimientos/nuevo", ancho: 1118, alto: 500, alt: "Formulario de nuevo movimiento: transferencia de libros entre dos depósitos." },
    derechos: { archivo: "liquidacion-pagos.webp", ruta: "liquidaciones", ancho: 1118, alto: 330, alt: "Ficha de una liquidación de derechos con el total, lo pagado y el saldo." },
    numeros: { archivo: "panel-metricas.webp", ruta: "", ancho: 1118, alto: 628, alt: "Panel de inicio con ingreso del mes, ejemplares vendidos, ingreso por mes e ingreso por medio de pago." }
};

const MUESTRAS: Partial<Record<FuncionalidadId, ComponentType>> = {
    librerias: Remito,
    facturacion: Factura,
    tienda: Pedido
};

function MuestraDe({ id }: { id: FuncionalidadId }) {
    const captura = CAPTURAS[id];
    if (captura) return <Captura {...captura} />;
    const Muestra = MUESTRAS[id];
    return Muestra ? <Muestra /> : null;
}

export function Funcionalidades() {
    return (
        <div className="l-funcionalidades">
            {FUNCIONALIDADES.map((funcionalidad) => {
                return (
                    <section key={funcionalidad.id} id={funcionalidad.id} className="l-funcionalidad" aria-labelledby={`${funcionalidad.id}-titulo`}>
                        <div className="l-contenedor l-funcionalidad-grilla">
                            <div className="l-funcionalidad-texto">
                                <h2 id={`${funcionalidad.id}-titulo`}>{funcionalidad.titulo}</h2>
                                <p className="l-funcionalidad-bajada">{funcionalidad.bajada}</p>
                                <ul className="l-lista-check">
                                    {funcionalidad.puntos.map((punto) => (
                                        <li key={punto}>
                                            <Icon name="check" size={18} color="var(--pino-600)" />
                                            <span>{punto}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="l-funcionalidad-muestra">
                                <MuestraDe id={funcionalidad.id} />
                            </div>
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
