import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { Toast } from "../design-system";

type ToastTone = "success" | "warning" | "error";
type ToastItem = { id: number; tone: ToastTone; message: string };

type ToastContextValue = {
    showToast: (tone: ToastTone, message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// `Toast` (design-system) es sólo la pieza visual de un toast individual;
// acá vive la cola + el posicionamiento fijo + el auto-dismiss, que es
// estado de aplicación, no parte del sistema de diseño.
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback(
        (tone: ToastTone, message: string) => {
            const id = Date.now() + Math.random();
            setToasts((current) => [...current, { id, tone, message }]);
            setTimeout(() => dismiss(id), 4000);
        },
        [dismiss]
    );

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                style={{
                    position: "fixed",
                    left: "var(--space-5)",
                    bottom: "var(--space-5)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                    zIndex: 1000
                }}
            >
                {toasts.map((t) => (
                    <Toast key={t.id} tone={t.tone} message={t.message} onClose={() => dismiss(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast debe usarse dentro de un ToastProvider");
    return context;
}
