import { useState } from "react";
import { createLibro, uploadLibroPortada } from "../../api/libro";
import type { CreateLibroInput } from "../../api/libro";

export function useNuevoLibro() {
    const [saving, setSaving] = useState(false);

    // La portada se sube en un segundo paso porque el endpoint de subida
    // (multipart) necesita el ISBN del libro ya creado (ver
    // specs/003-libro-campos-extendidos/design.md).
    //
    // La colección sí viaja en el payload (`coleccion_id`, `null` = sin
    // colección), ver specs/007-colecciones.
    const create = async (input: CreateLibroInput, portadaFile: File | null, idColeccion: number | null) => {
        setSaving(true);
        try {
            const response = await createLibro({ ...input, coleccion_id: idColeccion });
            if (portadaFile) await uploadLibroPortada(response.data.isbn, portadaFile);
            return response.data;
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
