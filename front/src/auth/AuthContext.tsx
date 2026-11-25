import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest } from "../api/auth";
import type { LoginInput } from "../api/auth";
import { ApiError, SESSION_INVALID_EVENT, setAuthToken } from "../api/client";
import { getMe, getNombreDeCuenta } from "../api/user";

type Session = {
    username: string;
    token: string;
};

type AuthContextValue = {
    user: Session | null;
    loading: boolean;
    login: (input: LoginInput) => Promise<void>;
    startSessionWithToken: (token: string) => Promise<void>;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Misma key/estructura que la app vieja (`loggedUser` en localStorage): no
// hay necesidad de romper eso, sólo el código que la maneja cambia.
const STORAGE_KEY = "loggedUser";

function isTokenExpired(token: string): boolean {
    try {
        const [, payload] = token.split(".");
        if (!payload) return true;

        const { exp } = JSON.parse(atob(payload)) as { exp: number };
        return exp * 1000 < Date.now();
    } catch {
        return true;
    }
}

function readSession(): Session | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
        const session = JSON.parse(stored) as Session;
        if (!session?.token || isTokenExpired(session.token)) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return session;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const clearSession = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
        setUser(null);
    }, []);

    // Al arrancar se valida el token contra `/user`: si la cuenta fue borrada
    // (por ejemplo, porque se reseteó la base), se limpia la sesión en vez de
    // dejar que cualquier pantalla reviente con "users with id N not found".
    useEffect(() => {
        const session = readSession();
        if (!session) {
            setLoading(false);
            return;
        }

        setAuthToken(session.token);
        getMe({ token: session.token })
            .then(({ data }) => {
                setUser({ username: getNombreDeCuenta(data), token: session.token });
            })
            .catch((error) => {
                if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
                    clearSession();
                } else {
                    // Error de red o del servidor: no cerramos una sesión que
                    // todavía puede ser válida; las pantallas muestran su error.
                    setUser(session);
                }
            })
            .finally(() => setLoading(false));
    }, [clearSession]);

    // Cualquier request con la sesión actual puede avisar que el token ya no
    // sirve (401/403 o usuario eliminado). El cliente HTTP no conoce React.
    useEffect(() => {
        const handleSessionInvalid = () => clearSession();
        window.addEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
        return () => window.removeEventListener(SESSION_INVALID_EVENT, handleSessionInvalid);
    }, [clearSession]);

    // Si una pantalla no atrapó el rechazo, igual cerramos sesión y evitamos
    // el error rojo en consola.
    useEffect(() => {
        const handleUnhandled = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            if (reason instanceof ApiError && reason.sessionInvalid) {
                event.preventDefault();
                clearSession();
            }
        };

        window.addEventListener("unhandledrejection", handleUnhandled);
        return () => window.removeEventListener("unhandledrejection", handleUnhandled);
    }, [clearSession]);

    const startSession = useCallback((session: Session) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setAuthToken(session.token);
        setUser(session);
    }, []);

    // `username` guarda lo que se tipeó para entrar (email o usuario): es sólo
    // el nombre que muestra la barra superior.
    const login = useCallback(
        async (input: LoginInput) => {
            const response = await loginRequest(input);
            startSession({ username: input.identificador, token: response.token });
        },
        [startSession]
    );

    // Confirmar el email o restablecer la contraseña devuelven sólo el token,
    // sin decir de qué cuenta es: el nombre a mostrar se pide con ese token.
    const startSessionWithToken = useCallback(
        async (token: string) => {
            const { data } = await getMe({ token });
            startSession({ username: getNombreDeCuenta(data), token });
        },
        [startSession]
    );

    return (
        <AuthContext.Provider
            value={{ user, loading, login, startSessionWithToken, logout: clearSession }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth debe usarse dentro de un AuthProvider");
    return context;
}
