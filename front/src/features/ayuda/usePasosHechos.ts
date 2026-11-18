import { useCallback, useState } from "react";

// El trámite se hace con ARCA abierta en otra pestaña y a veces en más de una
// sentada: el avance queda en el navegador para retomarlo donde quedó, sin
// depender de tener sesión iniciada.
const claveAlmacenamiento = (slug: string) => `epublit:ayuda:${slug}:pasos-hechos`;

const leerPasosHechos = (storage: Storage, slug: string): Set<number> =>
    new Set(
        (storage.getItem(claveAlmacenamiento(slug)) ?? "")
            .split(",")
            .map(Number)
            .filter((numero) => Number.isInteger(numero) && numero > 0)
    );

export function usePasosHechos(slug: string, storage: Storage = window.localStorage) {
    const [pasosHechos, setPasosHechos] = useState(() => leerPasosHechos(storage, slug));

    const alternarPaso = useCallback(
        (numero: number) => {
            setPasosHechos((actuales) => {
                const siguientes = new Set(actuales);
                if (siguientes.has(numero)) siguientes.delete(numero);
                else siguientes.add(numero);
                storage.setItem(claveAlmacenamiento(slug), [...siguientes].join(","));
                return siguientes;
            });
        },
        [slug, storage]
    );

    return { pasosHechos, alternarPaso };
}
