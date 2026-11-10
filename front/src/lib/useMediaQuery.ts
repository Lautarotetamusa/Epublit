import { useEffect, useState } from "react";

// Punto único para decidir composición por ancho de viewport cuando el layout
// necesita cambiar la estructura (no sólo envolver). Las páginas usan
// flex-wrap/grid auto-fit para lo demás; esto queda para el shell y para
// listados que no se leen bien como tabla en un teléfono.
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = () => setMatches(mql.matches);
        onChange();
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
    }, [query]);

    return matches;
}
