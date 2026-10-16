import { useEffect, useState } from "react";
import { listPersonas } from "../../api/persona";
import type { Rol } from "../../api/rol";

// Cuántas personas usan el rol: es el dato que decide si se puede dar de baja
// (plan 011: no se puede mientras lo use un libro activo con una persona
// activa; quien trae el rol es la persona, así que alcanza con contarlas).
// `GET /persona?rol=<id>` es el mismo filtro que usa el listado de personas, así
// que una sola lectura de `pageSize: 1` responde con el total.
//
// Devuelve `null` mientras no se sabe todavía: la ficha no puede ofrecer la
// baja antes de conocer el motivo del bloqueo.
export function useUsosDeRol(rol: Rol | null): number | null {
    const [usos, setUsos] = useState<number | null>(null);

    useEffect(() => {
        if (!rol) return;

        setUsos(null);
        listPersonas({ rol, pageSize: 1 }).then((response) => setUsos(response.pagination.total));
    }, [rol]);

    return usos;
}
