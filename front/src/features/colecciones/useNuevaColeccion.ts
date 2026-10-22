import { useState } from "react";
import { createColeccion, uploadColeccionPortada } from "../../api/coleccion";
import type { Coleccion, CreateColeccionInput } from "../../api/coleccion";

export function useNuevaColeccion() {
    const [saving, setSaving] = useState(false);

    // La portada se sube en un segundo paso (necesita la colección ya
    // creada), igual que la portada de libro y la foto de persona.
    const create = async (input: CreateColeccionInput, portadaFile: File | null): Promise<Coleccion> => {
        setSaving(true);
        try {
            const response = await createColeccion(input);
            if (!portadaFile) return response.data;

            const conPortada = await uploadColeccionPortada(response.data.id, portadaFile);
            return conPortada.data;
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
