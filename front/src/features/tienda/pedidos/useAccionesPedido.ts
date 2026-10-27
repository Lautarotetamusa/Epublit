import { useState } from "react";
import {
    aceptarPedido,
    entregarPedido,
    enviarPedido,
    facturarPedido,
    rechazarPedido,
    refrescarEnvioPedido
} from "../../../api/tienda";
import type { RechazarPedidoInput } from "../../../api/tienda";

// Las acciones del ciclo de vida comparten el mismo estado de "guardando" y,
// salvo refrescar el seguimiento, releen la ficha al terminar. Los errores se
// dejan subir para que cada pantalla decida cómo mostrarlos.
export function useAccionesPedido(codigo: string, onUpdated: () => Promise<void> | void) {
    const [procesando, setProcesando] = useState(false);

    const ejecutar = async <T,>(accion: () => Promise<T>, actualizarFicha = true): Promise<T> => {
        setProcesando(true);
        try {
            const resultado = await accion();
            if (actualizarFicha) await onUpdated();
            return resultado;
        } finally {
            setProcesando(false);
        }
    };

    return {
        procesando,
        aceptar: () => ejecutar(() => aceptarPedido(codigo)),
        rechazar: (input: RechazarPedidoInput) => ejecutar(() => rechazarPedido(codigo, input)),
        despachar: () => ejecutar(() => enviarPedido(codigo)),
        entregar: () => ejecutar(() => entregarPedido(codigo)),
        facturar: () => ejecutar(() => facturarPedido(codigo)),
        refrescarEnvio: () => ejecutar(() => refrescarEnvioPedido(codigo), false)
    };
}
