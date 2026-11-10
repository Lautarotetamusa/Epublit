import { ApiError } from "../../api/client";
import type { ApiErrorDetalle } from "../../api/client";

// Traducción de los errores HTTP del CMS a algo que la editora pueda leer.
// El backend ya manda mensajes en castellano (`error.mensaje`) y el detalle
// por campo (`error.detalles`); acá sólo se agrega contexto para los códigos
// de estado que la UI no muestra en ningún campo (sesión vencida, etc.).
export function mensajeDeError(err: unknown): string {
    if (!(err instanceof ApiError)) {
        return "No se pudo conectar con el servidor. Revisá la conexión y probá de nuevo.";
    }

    if (err.status === 401) {
        return "Tu sesión venció. Volvé a iniciar sesión para seguir editando.";
    }

    if (err.status === 404 && err.codigo === "no_encontrado") {
        return "No encontramos lo que buscabas. Puede que se haya eliminado.";
    }

    // En un 422 de publicación los detalles son el checklist: se muestran
    // completos en esa lista y no tiene sentido repetirlos en el toast.
    if (err.codigo === "publicacion_incompleta") return err.message;

    const primerDetalle = err.detalles[0]?.mensaje;
    if (primerDetalle && primerDetalle !== err.message) {
        return `${err.message}: ${primerDetalle}`;
    }

    return err.message;
}

export function detallesDeError(err: unknown): ApiErrorDetalle[] {
    return err instanceof ApiError ? err.detalles : [];
}

export function codigoDeError(err: unknown): string | null {
    return err instanceof ApiError ? err.codigo : null;
}

// Los detalles que apuntan a un campo de primer nivel (`titulo`, `slug`,
// `descripcion`) se muestran debajo de ese control. Los de bloques
// (`bloques[2]…`) quedan en el toast: no hay un campo único que marcar.
export function erroresPorCampo(err: unknown): Record<string, string> {
    const errores: Record<string, string> = {};

    for (const detalle of detallesDeError(err)) {
        if (!detalle.campo || detalle.campo.includes("[") || detalle.campo.includes(".")) continue;
        errores[detalle.campo] = detalle.mensaje;
    }

    return errores;
}
