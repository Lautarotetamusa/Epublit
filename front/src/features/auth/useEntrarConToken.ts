import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { getErrorMessage } from "../../lib/errors";

export function useEntrarConToken(token: string) {
    const { startSessionWithToken } = useAuth();
    const navigate = useNavigate();
    const [entrando, setEntrando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const entrar = () => {
        setEntrando(true);
        setError(null);
        startSessionWithToken(token).then(
            () => navigate("/", { replace: true }),
            (err: unknown) => {
                setError(getErrorMessage(err));
                setEntrando(false);
            }
        );
    };

    return { entrar, entrando, error };
}
