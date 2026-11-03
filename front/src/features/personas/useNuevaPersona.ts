import { useState } from "react";
import { createPersona, uploadPersonaFoto } from "../../api/persona";
import type { CreatePersonaInput } from "../../api/persona";

export function useNuevaPersona() {
    const [saving, setSaving] = useState(false);

    // La foto se guarda en un segundo paso, con la persona ya creada (mismo
    // criterio que la portada de libro, ver useNuevoLibro).
    const create = async (input: CreatePersonaInput, fotoFile: File | null) => {
        setSaving(true);
        try {
            const response = await createPersona(input);
            if (fotoFile) await uploadPersonaFoto(response.data.id, fotoFile);
            return response.data;
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
