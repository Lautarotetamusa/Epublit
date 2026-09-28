import { useState } from "react";
import { createCliente } from "../../api/cliente";
import type { CreateClienteInput } from "../../api/cliente";

export function useNuevoCliente() {
    const [saving, setSaving] = useState(false);

    const create = async (input: CreateClienteInput) => {
        setSaving(true);
        try {
            const response = await createCliente(input);
            return response.data;
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
