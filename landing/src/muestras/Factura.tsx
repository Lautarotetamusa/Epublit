import { formatMoney } from "@front-lib/money";
import { FACTURA, LIBRO } from "./datos";
import { Marco } from "./Marco";

const total = FACTURA.cantidad * FACTURA.precioUnitario;

export function Factura() {
    return (
        <Marco ruta="comprobantes/391" rotulo="Datos de ejemplo">
            <article className="l-papel" aria-label={`Factura ${FACTURA.letra} ${FACTURA.numero}`}>
                <header className="l-papel-encabezado">
                    <div className="l-factura-letra">
                        <span>{FACTURA.letra}</span>
                        <small className="l-mono">Cód. {FACTURA.codigo}</small>
                    </div>
                    <div className="l-derecha">
                        <p className="l-papel-tipo">Factura</p>
                        <p className="l-mono">N° {FACTURA.numero}</p>
                        <p className="l-mono l-tenue">{FACTURA.fecha}</p>
                    </div>
                </header>
                <p className="l-papel-cliente">
                    <strong>{FACTURA.cliente}</strong> <span className="l-tenue">· IVA Responsable Inscripto</span>
                </p>
                <table className="l-papel-tabla">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th className="l-derecha">Cant.</th>
                            <th className="l-derecha">Importe</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{LIBRO.titulo}</td>
                            <td className="l-mono l-derecha">{FACTURA.cantidad}</td>
                            <td className="l-mono l-derecha">{formatMoney(total)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={2}>Total</td>
                            <td className="l-mono l-derecha">{formatMoney(total)}</td>
                        </tr>
                    </tfoot>
                </table>
                <p className="l-papel-cae l-mono">
                    CAE N° {FACTURA.cae} · Vto. {FACTURA.vencimientoCae}
                </p>
            </article>
        </Marco>
    );
}
