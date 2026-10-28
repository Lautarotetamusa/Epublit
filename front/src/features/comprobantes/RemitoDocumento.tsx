import type { ComprobanteDTO } from "../../api/comprobantes";
import {
    formatearCantidad,
    formatearFechaComprobante,
    formatearImporte,
    numeroConCeros
} from "./formato";

// Remito de consignación/devolución: usa el mismo snapshot que la factura,
// pero no tiene datos fiscales propios ni CAE/QR. El motivo no se imprime: la
// ficha de la operación es la que da el contexto.
export function RemitoDocumento({ comprobante }: { comprobante: ComprobanteDTO }) {
    const { emisor, receptor, items } = comprobante;
    const totalEjemplares = items.reduce((total, item) => total + item.cantidad, 0);
    const numero = comprobante.numeroCompleto ?? "sin número";

    return (
        <article
            className="comprobante-documento comprobante-documento--remito"
            aria-label={`Remito ${numero}`}
        >
            <header className="comprobante-encabezado">
                <div className="comprobante-emisor">
                    {emisor.logoUrl ? (
                        <img
                            className="comprobante-logo"
                            src={emisor.logoUrl}
                            alt={`Logo de ${emisor.razonSocial}`}
                            loading="eager"
                            decoding="async"
                        />
                    ) : null}
                    <div className="comprobante-emisor-datos">
                        <h1 className="comprobante-razon-social">{emisor.razonSocial}</h1>
                        <p>{emisor.domicilio}</p>
                        <p>{emisor.condicionFiscal}</p>
                        <p>CUIT {emisor.cuit}</p>
                        {emisor.email ? <p>{emisor.email}</p> : null}
                    </div>
                </div>

                <div className="comprobante-identidad comprobante-identidad--remito">
                    <div className="comprobante-identidad-datos">
                        <p className="comprobante-tipo-nombre">REMITO</p>
                        <dl className="comprobante-datos-fiscales">
                            <div>
                                <dt>Punto de venta</dt>
                                <dd className="comprobante-mono">
                                    {numeroConCeros(comprobante.puntoVenta, 4)}
                                </dd>
                            </div>
                            <div>
                                <dt>Número</dt>
                                <dd className="comprobante-mono">
                                    {numeroConCeros(comprobante.numero, 5)}
                                </dd>
                            </div>
                            <div>
                                <dt>Fecha</dt>
                                <dd>{formatearFechaComprobante(comprobante.fecha)}</dd>
                            </div>
                            <div>
                                <dt>Número completo</dt>
                                <dd className="comprobante-mono">{numero}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </header>

            <section className="comprobante-bloque comprobante-receptor" aria-label="Datos del cliente">
                <h2 className="comprobante-bloque-titulo">Cliente</h2>
                <dl className="comprobante-datos-grid">
                    <div>
                        <dt>Apellido y nombre / Razón social</dt>
                        <dd>{receptor.razonSocial}</dd>
                    </div>
                    <div>
                        <dt>CUIT / Documento</dt>
                        <dd className="comprobante-mono">
                            {receptor.cuit ?? receptor.documento ?? "—"}
                        </dd>
                    </div>
                    <div>
                        <dt>Condición frente al IVA</dt>
                        <dd>{receptor.condicionFiscal}</dd>
                    </div>
                    <div>
                        <dt>Domicilio comercial</dt>
                        <dd>{receptor.domicilio || "—"}</dd>
                    </div>
                </dl>
            </section>

            <div
                className="comprobante-items-wrap"
                role="region"
                aria-label="Detalle de ejemplares del remito"
                tabIndex={0}
            >
                <table className="comprobante-items">
                    <caption className="comprobante-sr-only">Ejemplares del remito</caption>
                <thead>
                    <tr>
                        <th scope="col">ISBN</th>
                        <th scope="col">Título / Autor</th>
                        <th scope="col" className="comprobante-col-numero">
                            Cantidad
                        </th>
                        <th scope="col" className="comprobante-col-numero">
                            PVP
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={`${item.isbn ?? item.titulo}-${index}`}>
                            <td className="comprobante-mono">{item.isbn ?? "—"}</td>
                            <td>
                                <span className="comprobante-item-titulo">{item.titulo}</span>
                                {item.autor ? (
                                    <span className="comprobante-item-autor">{item.autor}</span>
                                ) : null}
                            </td>
                            <td className="comprobante-col-numero comprobante-mono">
                                {formatearCantidad(item.cantidad)}
                            </td>
                            <td className="comprobante-col-numero comprobante-mono">
                                {formatearImporte(item.precioUnitario)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <div className="comprobante-cierre comprobante-cierre--remito">
                <p className="comprobante-total-ejemplares">
                    Total de ejemplares: <strong>{formatearCantidad(totalEjemplares)}</strong>
                </p>
            </div>

            <footer className="comprobante-pie comprobante-pie--remito">
                <div className="comprobante-pie-datos">
                    <p className="comprobante-leyenda">Documento no válido como factura.</p>
                    <p className="comprobante-leyenda">
                        Remito emitido por {emisor.razonSocial}.
                    </p>
                </div>
                <p className="comprobante-pagina">Pág. 1/1</p>
            </footer>
        </article>
    );
}
