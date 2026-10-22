import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { Dialog, Button } from "../design-system";

type ConfirmOptions = {
    title: string;
    description?: string;
    confirmLabel?: string;
    tone?: "primary" | "danger";
};

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

// Reemplaza `window.confirm`/el `Swal.fire({showCancelButton:true})` de la
// app vieja: mismo propósito (confirmación bloqueante antes de una acción
// destructiva), pero con el `Dialog` del sistema de diseño en vez de UI
// nativa del browser.
export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [pending, setPending] = useState<PendingConfirm | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setPending({ ...options, resolve });
        });
    }, []);

    const handleClose = (result: boolean) => {
        pending?.resolve(result);
        setPending(null);
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {pending ? (
                <Dialog
                    open
                    title={pending.title}
                    description={pending.description}
                    onClose={() => handleClose(false)}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => handleClose(false)}>
                                Cancelar
                            </Button>
                            <Button variant={pending.tone === "danger" ? "danger" : "primary"} onClick={() => handleClose(true)}>
                                {pending.confirmLabel ?? "Confirmar"}
                            </Button>
                        </>
                    }
                />
            ) : null}
        </ConfirmContext.Provider>
    );
}

export function useConfirm(): ConfirmContextValue {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error("useConfirm debe usarse dentro de un ConfirmProvider");
    return context;
}
