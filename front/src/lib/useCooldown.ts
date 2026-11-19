import { useCallback, useEffect, useState } from "react";

// Cuenta regresiva en segundos para acciones que no conviene repetir enseguida
// (reenviar un mail): la UI muestra cuánto falta en vez de sólo deshabilitar.
export function useCooldown(segundos: number, activoAlInicio = false) {
    const [restante, setRestante] = useState(activoAlInicio ? segundos : 0);

    useEffect(() => {
        if (restante <= 0) return;
        const timer = setTimeout(() => setRestante((valor) => valor - 1), 1000);
        return () => clearTimeout(timer);
    }, [restante]);

    const iniciar = useCallback(() => setRestante(segundos), [segundos]);

    return { restante, activo: restante > 0, iniciar };
}

export function formatCuentaRegresiva(segundos: number): string {
    const minutos = Math.floor(segundos / 60);
    return `${minutos}:${String(segundos % 60).padStart(2, "0")}`;
}
