import { Badge, Button, Card } from "@ds";
import { formatMoney } from "@front-lib/money";
import { PEDIDO } from "./datos";
import { Marco } from "./Marco";

const total = PEDIDO.libros.reduce((suma, libro) => suma + libro.precio * libro.cantidad, 0);

export function Pedido() {
    return (
        <Marco ruta={`pedidos/${PEDIDO.codigo}`} rotulo="Datos de ejemplo">
            <Card
                title={`Pedido ${PEDIDO.codigo}`}
                subtitle={`${PEDIDO.comprador} · ${PEDIDO.fecha}`}
                actions={
                    <Badge tone="success" dot>
                        Pagado
                    </Badge>
                }
            >
                <ul className="l-pedido-libros">
                    {PEDIDO.libros.map((libro) => (
                        <li key={libro.titulo}>
                            <span>
                                {libro.cantidad} × {libro.titulo}
                            </span>
                            <span className="l-mono">{formatMoney(libro.precio)}</span>
                        </li>
                    ))}
                    <li className="l-pedido-total">
                        <span>Total cobrado con Mercado Pago</span>
                        <span className="l-mono">{formatMoney(total)}</span>
                    </li>
                </ul>
                <div className="l-pedido-acciones">
                    <Button tabIndex={-1} aria-hidden="true" iconStart="check">
                        Aceptar y generar factura
                    </Button>
                </div>
            </Card>
        </Marco>
    );
}
