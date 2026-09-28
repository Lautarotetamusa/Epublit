import { useState } from "react";
import { createLibro, uploadLibroPortada } from "../../api/libro";
import type { CreateLibroInput } from "../../api/libro";

export function useNuevoLibro() {
    const [saving, setSaving] = useState(false);

    // La portada se sube en un segundo paso porque el endpoint de subida
    // (multipart) necesita el ISBN del libro ya creado (ver
    // specs/003-libro-campos-extendidos/design.md).
    const create = async (input: CreateLibroInput, portadaFile: File | null) => {
        setSaving(true);
        try {
            const response = await createLibro(input);
            if (portadaFile) await uploadLibroPortada(response.data.isbn, portadaFile);
            return response.data;
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
