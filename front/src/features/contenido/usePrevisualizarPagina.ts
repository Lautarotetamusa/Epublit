import { useCallback, useState } from "react";
import { obtenerPaginaContenido } from "../../api/contenido";
import { useToast } from "../../notifications/ToastProvider";
import { mensajeDeError } from "./erroresContenido";
import { mapearPagina } from "./mapeoContenido";
import type { PaginaContenido } from "./tipos";

// El listado no trae bloques: para previsualizar hay que pedir el detalle.
// Este hook encapsula esa lectura y el id que está cargando, así el listado
// puede deshabilitar el botón de la fila sin mostrar un spinner global.
export function usePrevisualizarPagina() {
    const { showToast } = useToast();
    const [pagina, setPagina] = useState<PaginaContenido | null>(null);
    const [cargandoId, setCargandoId] = useState<string | null>(null);

    const abrir = useCallback(
        async (item: PaginaContenido) => {
            const numero = Number(item.id);
            if (!Number.isInteger(numero) || numero <= 0) return;

            setCargandoId(item.id);
            try {
                const respuesta = await obtenerPaginaContenido(numero);
                setPagina(mapearPagina(respuesta.pagina));
            } catch (err) {
                showToast("error", mensajeDeError(err));
            } finally {
                setCargandoId(null);
            }
        },
        [showToast]
    );

    const cerrar = useCallback(() => setPagina(null), []);

    return { pagina, cargandoId, abrir, cerrar };
}
