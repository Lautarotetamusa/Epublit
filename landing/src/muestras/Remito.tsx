import { REMITO } from "./datos";
import { Marco } from "./Marco";

const totalEjemplares = REMITO.lineas.reduce((total, linea) => total + linea.cantidad, 0);

export function Remito() {
    return (
        <Marco ruta="consignaciones/148" rotulo="Datos de ejemplo">
            <article className="l-papel" aria-label={`Remito ${REMITO.numero}`}>
                <header className="l-papel-encabezado">
                    <div>
                        <p className="l-papel-tipo">Remito de consignación</p>
                        <p className="l-mono">N° {REMITO.numero}</p>
                    </div>
                    <p className="l-mono l-tenue">{REMITO.fecha}</p>
                </header>
                <p className="l-papel-cliente">
                    <strong>{REMITO.cliente}</strong> <span className="l-mono l-tenue">CUIT {REMITO.cuit}</span>
                </p>
                <table className="l-papel-tabla">
                    <thead>
                        <tr>
                            <th className="l-ocultar-movil">ISBN</th>
                            <th>Título</th>
                            <th className="l-derecha">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REMITO.lineas.map((linea) => (
                            <tr key={linea.isbn}>
                                <td className="l-mono l-tenue l-ocultar-movil">{linea.isbn}</td>
                                <td>{linea.titulo}</td>
                                <td className="l-mono l-derecha">{linea.cantidad}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="l-ocultar-movil" />
                            <td>Total de ejemplares</td>
                            <td className="l-mono l-derecha">{totalEjemplares}</td>
                        </tr>
                    </tfoot>
                </table>
            </article>
        </Marco>
    );
}
