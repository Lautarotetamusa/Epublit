import type { ComprobanteDTO } from "../../api/comprobantes";
import {
    formatearCantidad,
    formatearFechaComprobante,
    formatearImporte,
    numeroConCeros,
    textoObservacion
} from "./formato";

const RESULTADO_LABEL: Record<"A" | "R", string> = {
    A: "Aprobado",
    R: "Rechazado"
};

function importe(value: number): string {
    return formatearImporte(value);
}

// Factura AFIP: se arma con el snapshot del DTO, así que todos los datos
// fiscales quedan congelados al momento de emitir. No usa HTML inyectado.
export function FacturaDocumento({ comprobante }: { comprobante: ComprobanteDTO }) {
    const { emisor, receptor, tipo, importes, items, observaciones } = comprobante;
    const titulo = tipo?.nombre ?? "Factura";
    const numero = comprobante.numeroCompleto ?? "sin número";
    const observacionesTexto = observaciones.map(textoObservacion).filter((texto) => texto.trim() !== "");

    return (
        <article
            className="comprobante-documento comprobante-documento--factura"
            aria-label={`${titulo} ${numero}`}
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
                        {emisor.email ? <p>{emisor.email}</p> : null}
                    </div>
                </div>

                <div className="comprobante-identidad">
                    <div className="comprobante-letra" aria-hidden="true">
                        {tipo?.letra ?? "—"}
                    </div>
                    <div className="comprobante-identidad-datos">
                        <p className="comprobante-tipo-nombre">{titulo.toUpperCase()}</p>
                        <p className="comprobante-codigo">
                            Código AFIP {tipo ? String(tipo.codigo).padStart(2, "0") : "—"}
                        </p>
                        <dl className="comprobante-datos-fiscales">
                            <div>
                                <dt>Punto de venta</dt>
                                <dd className="comprobante-mono">
                                    {numeroConCeros(comprobante.puntoVenta, 5)}
                                </dd>
                            </div>
                            <div>
                                <dt>Comprobante N°</dt>
                                <dd className="comprobante-mono">
                                    {numeroConCeros(comprobante.numero, 8)}
                                </dd>
                            </div>
                            <div>
                                <dt>Fecha de emisión</dt>
                                <dd>{formatearFechaComprobante(comprobante.fecha)}</dd>
                            </div>
                            <div>
                                <dt>CUIT</dt>
                                <dd className="comprobante-mono">{emisor.cuit}</dd>
                            </div>
                            {emisor.ingresosBrutos ? (
                                <div>
                                    <dt>Ingresos Brutos</dt>
                                    <dd className="comprobante-mono">{emisor.ingresosBrutos}</dd>
                                </div>
                            ) : null}
                            <div>
                                <dt>Inicio de actividades</dt>
                                <dd>{formatearFechaComprobante(emisor.inicioActividades)}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </header>

            <section className="comprobante-bloque comprobante-receptor" aria-label="Datos del receptor">
                <h2 className="comprobante-bloque-titulo">Receptor</h2>
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
                    <div>
                        <dt>Condición de venta</dt>
                        <dd>{receptor.condicionVenta ?? "—"}</dd>
                    </div>
                </dl>
            </section>

            <div
                className="comprobante-items-wrap"
                role="region"
                aria-label={`Detalle de ítems de la ${titulo}`}
                tabIndex={0}
            >
                <table className="comprobante-items">
                    <caption className="comprobante-sr-only">Ítems de la {titulo}</caption>
                <thead>
                    <tr>
                        <th scope="col">ISBN</th>
                        <th scope="col">Título / Autor</th>
                        <th scope="col" className="comprobante-col-numero">
                            Cantidad
                        </th>
                        <th scope="col" className="comprobante-col-numero">
                            Precio unit.
                        </th>
                        <th scope="col" className="comprobante-col-numero">
                            Bonif. %
                        </th>
                        <th scope="col" className="comprobante-col-numero">
                            Bonif. $
                        </th>
                        <th scope="col" className="comprobante-col-numero">
                            Subtotal
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
                                {importe(item.precioUnitario)}
                            </td>
                            <td className="comprobante-col-numero comprobante-mono">
                                {item.descuentoPorcentaje.toLocaleString("es-AR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}{" "}
                                %
                            </td>
                            <td className="comprobante-col-numero comprobante-mono">
                                {importe(item.importeDescuento)}
                            </td>
                            <td className="comprobante-col-numero comprobante-mono">
                                {importe(item.subtotal)}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {observacionesTexto.length > 0 ? (
                <section className="comprobante-observaciones" aria-label="Observaciones de AFIP">
                    <h2 className="comprobante-bloque-titulo">Observaciones</h2>
                    <ul>
                        {observacionesTexto.map((texto, index) => (
                            <li key={`${texto}-${index}`}>{texto}</li>
                        ))}
                    </ul>
                </section>
            ) : null}

            <div className="comprobante-cierre">
                <p className="comprobante-moneda">Moneda: {comprobante.moneda}</p>
                <dl className="comprobante-totales" aria-label="Importes de la factura">
                    <div>
                        <dt>Subtotal</dt>
                        <dd>{importe(importes.subtotal)}</dd>
                    </div>
                    <div>
                        <dt>Envío</dt>
                        <dd>{importe(importes.envio)}</dd>
                    </div>
                    <div>
                        <dt>Descuento</dt>
                        <dd>{importe(importes.descuento)}</dd>
                    </div>
                    <div>
                        <dt>Neto gravado</dt>
                        <dd>{importe(importes.neto)}</dd>
                    </div>
                    <div>
                        <dt>IVA</dt>
                        <dd>{importe(importes.iva)}</dd>
                    </div>
                    <div>
                        <dt>Exento</dt>
                        <dd>{importe(importes.exento)}</dd>
                    </div>
                    <div>
                        <dt>No gravado</dt>
                        <dd>{importe(importes.noGravado)}</dd>
                    </div>
                    <div>
                        <dt>Otros tributos</dt>
                        <dd>{importe(importes.tributos)}</dd>
                    </div>
                    <div className="comprobante-total">
                        <dt>Importe total</dt>
                        <dd>{importe(importes.total)}</dd>
                    </div>
                </dl>
            </div>

            <footer className="comprobante-pie">
                <div className="comprobante-qr">
                    {comprobante.qr?.dataUrl ? (
                        <img
                            src={comprobante.qr.dataUrl}
                            alt={`Código QR de ${titulo} ${numero}`}
                            decoding="async"
                        />
                    ) : (
                        <p className="comprobante-qr-faltante" role="alert">
                            No se pudo generar el QR. No imprimas este comprobante.
                        </p>
                    )}
                </div>

                <div className="comprobante-pie-datos">
                    <p>
                        <strong>CAE N°:</strong> {comprobante.cae ?? "—"}
                    </p>
                    <p>
                        <strong>Fecha de vto. de CAE:</strong>{" "}
                        {formatearFechaComprobante(comprobante.caeVencimiento)}
                    </p>
                    <p>
                        <strong>Resultado:</strong>{" "}
                        {comprobante.resultado ? RESULTADO_LABEL[comprobante.resultado] : "—"}
                    </p>
                    <p className="comprobante-leyenda">Comprobante autorizado</p>
                    <p className="comprobante-leyenda">
                        Esta Administración Federal no se responsabiliza por los datos ingresados en el
                        detalle de la operación.
                    </p>
                    <p className="comprobante-leyenda">
                        Régimen de Transparencia Fiscal al Consumidor (Ley N° 27.743).
                    </p>
                    {tipo?.letra === "C" ? (
                        <p className="comprobante-leyenda">
                            Factura C: el IVA no se discrimina en este comprobante.
                        </p>
                    ) : null}
                </div>

                <p className="comprobante-pagina">Pág. 1/1</p>
            </footer>
        </article>
    );
}
