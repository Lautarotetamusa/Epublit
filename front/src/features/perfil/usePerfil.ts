import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { getMe, updateMe, refreshAfipData } from "../../api/user";
import type { User, UpdateUserInput } from "../../api/user";
import { useAuth } from "../../auth/AuthContext";
import { getErrorMessage } from "../../lib/errors";

export function usePerfil() {
    const { logout } = useAuth();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUser = useCallback(async () => {
        try {
            const response = await getMe();
            setUser(response.data);
            setError(null);
        } catch (err) {
            // La sesión apunta a una cuenta que ya no existe: el cliente HTTP
            // ya avisó al AuthProvider; cerramos acá también por si el evento
            // llegó antes de montar el listener.
            if (err instanceof ApiError && err.sessionInvalid) {
                logout();
                return;
            }
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [logout]);

    useEffect(() => {
        void fetchUser();
    }, [fetchUser]);

    const update = async (input: UpdateUserInput) => {
        const response = await updateMe(input);
        setUser(response.data);
    };

    // Vuelve a resolver los datos fiscales del padrón de AFIP (mismo caso de
    // uso que usa el alta de la cuenta, ver back user.service.ts#refreshAfipData).
    const refreshFromAfip = async () => {
        const response = await refreshAfipData();
        setUser(response.data);
    };

    return { user, loading, error, update, refreshFromAfip };
}
