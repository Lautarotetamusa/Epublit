import { useState } from "react";
import { createPersona } from "../../api/persona";
import type { CreatePersonaInput } from "../../api/persona";
import { setFotoMock } from "./personaFotoMock";

export function useNuevaPersona() {
    const [saving, setSaving] = useState(false);

    // La foto se guarda en un segundo paso, con la persona ya creada (mismo
    // criterio que la portada de libro, ver useNuevoLibro). El guardado en sí
    // sigue mockeado (ver personaFotoMock.ts) hasta que exista el endpoint.
    const create = async (input: CreatePersonaInput, fotoFile: File | null) => {
        setSaving(true);
        try {
            const response = await createPersona(input);
            if (fotoFile) setFotoMock(response.data.id, URL.createObjectURL(fotoFile));
            return response.data;
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
