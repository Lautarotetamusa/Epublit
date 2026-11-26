import { useState } from "react";
import { createTipoEdicion } from "../../api/tipoEdicion";
import type { CreateTipoEdicionInput } from "../../api/tipoEdicion";

export function useNuevoTipoEdicion() {
    const [saving, setSaving] = useState(false);

    const create = async (input: CreateTipoEdicionInput) => {
        setSaving(true);
        try {
            return await createTipoEdicion(input);
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
