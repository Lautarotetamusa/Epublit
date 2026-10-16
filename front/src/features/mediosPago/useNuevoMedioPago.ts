import { useState } from "react";
import { createMedioPago } from "../../api/medioPago";
import type { CreateMedioPagoInput } from "../../api/medioPago";

export function useNuevoMedioPago() {
    const [saving, setSaving] = useState(false);

    const create = async (input: CreateMedioPagoInput) => {
        setSaving(true);
        try {
            const response = await createMedioPago(input);
            return response.data;
        } finally {
            setSaving(false);
        }
    };

    return { saving, create };
}
