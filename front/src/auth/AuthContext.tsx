import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest } from "../api/auth";
import type { LoginInput } from "../api/auth";
import { setAuthToken } from "../api/client";
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
    const [, payload] = token.split(".");
    if (!payload) return true;

    const { exp } = JSON.parse(atob(payload)) as { exp: number };
    return exp * 1000 < Date.now();
}

function readSession(): Session | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as Session;
    if (isTokenExpired(session.token)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
    return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const session = readSession();
        if (session) {
            setAuthToken(session.token);
            setUser(session);
        }
        setLoading(false);
    }, []);

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

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
        setUser(null);
    }, []);

    return <AuthContext.Provider value={{ user, loading, login, startSessionWithToken, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth debe usarse dentro de un AuthProvider");
    return context;
}
