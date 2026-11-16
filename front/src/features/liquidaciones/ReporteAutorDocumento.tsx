import type { Liquidacion, PersonaAPagar } from "../../api/liquidaciones";
import { formatFecha, formatRango } from "../../lib/fecha";
import { formatMoney } from "../../lib/money";
import { nombreVisible } from "../roles/presentacionRol";

export type ReporteAutor = {
    emisor: string;
    liquidacion: Liquidacion;
    persona: PersonaAPagar;
};

// Documento A4 que se le envía a una persona: sólo sus líneas y sus totales,
// los mismos que muestra la ficha de la liquidación.
export function ReporteAutorDocumento({ reporte }: { reporte: ReporteAutor }) {
    const { emisor, liquidacion, persona } = reporte;
    const ejemplares = persona.detalle.reduce((suma, linea) => suma + linea.cantidad, 0);

    return (
        <article className="reporte-autor-documento">
            <header className="reporte-autor-encabezado">
                <div>
                    <p className="reporte-autor-emisor">{emisor}</p>
                    <h1 className="reporte-autor-titulo">Liquidación de regalías</h1>
                </div>
                <dl className="reporte-autor-datos">
                    <dt>Liquidación</dt>
                    <dd>{liquidacion.codigo}</dd>
                    <dt>Período</dt>
                    <dd>{formatRango(liquidacion.desde, liquidacion.hasta)}</dd>
                    <dt>Generada</dt>
                    <dd>{formatFecha(liquidacion.fecha_generacion)}</dd>
                </dl>
            </header>

            <section className="reporte-autor-bloque">
                <p className="reporte-autor-etiqueta">Liquidado a</p>
                <p className="reporte-autor-persona">{persona.nombre}</p>
                <p className="reporte-autor-roles">{persona.roles.map((rol) => nombreVisible(rol.nombre)).join(" · ")}</p>
            </section>

            <table className="reporte-autor-tabla">
                <thead>
                    <tr>
                        <th>Libro</th>
                        <th>Rol</th>
                        <th className="numero">Ejemplares</th>
                        <th className="numero">Porcentaje</th>
                        <th className="numero">Importe</th>
                        <th className="numero">Anticipo</th>
                    </tr>
                </thead>
                <tbody>
                    {persona.detalle.map((linea) => (
                        <tr key={`${linea.id_libro}-${linea.rol.id}`}>
                            <td>{linea.titulo}</td>
                            <td>{nombreVisible(linea.rol.nombre)}</td>
                            <td className="numero">{linea.cantidad}</td>
                            <td className="numero">{linea.porcentaje}%</td>
                            <td className="numero">{formatMoney(linea.importe)}</td>
                            <td className="numero">{linea.anticipo > 0 ? `− ${formatMoney(linea.anticipo)}` : "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <dl className="reporte-autor-totales">
                <dt>Ejemplares vendidos</dt>
                <dd>{ejemplares}</dd>
                <dt>Regalías</dt>
                <dd>{formatMoney(persona.total_bruto)}</dd>
                {persona.anticipo > 0 ? (
                    <>
                        <dt>Anticipo recuperado</dt>
                        <dd>− {formatMoney(persona.anticipo)}</dd>
                    </>
                ) : null}
                <dt className="reporte-autor-total">Total a pagar</dt>
                <dd className="reporte-autor-total">{formatMoney(persona.total)}</dd>
                <dt>Pagado</dt>
                <dd>{formatMoney(persona.pagado)}</dd>
                <dt>Saldo</dt>
                <dd>{formatMoney(persona.saldo)}</dd>
            </dl>

            {persona.pagos.length > 0 ? (
                <section className="reporte-autor-bloque">
                    <p className="reporte-autor-etiqueta">Pagos registrados</p>
                    <table className="reporte-autor-tabla">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Nota</th>
                                <th className="numero">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {persona.pagos.map((pago) => (
                                <tr key={pago.id}>
                                    <td>{formatFecha(pago.fecha)}</td>
                                    <td>{pago.nota ?? "—"}</td>
                                    <td className="numero">{formatMoney(pago.monto)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            ) : null}
        </article>
    );
}
