import { useState } from "react";
import { createRol } from "../../api/rol";
import type { CreateRolInput } from "../../api/rol";

export function useNuevoRol() {
    const [saving, setSaving] = useState(false);

    const create = async (input: CreateRolInput) => {
        setSaving(true);
        try {
            return await createRol(input);
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
