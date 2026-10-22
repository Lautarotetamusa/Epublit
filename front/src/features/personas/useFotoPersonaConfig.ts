import { useEffect, useState } from "react";
import { getMe } from "../../api/user";

// Las restricciones de la foto de persona se configuran por editorial (ver
// PerfilPage, sección "Restricciones de fotos") en vez de venir fijas en
// PhotoUpload. Este hook sólo lee esa configuración; editarla es
// responsabilidad de usePerfil, que ya administra el resto de la cuenta.
export function useFotoPersonaConfig() {
    const [config, setConfig] = useState<{ maxSizeMb: number | null; minAnchoPx: number | null; minAltoPx: number | null } | null>(null);

    useEffect(() => {
        getMe().then((response) =>
            setConfig({
                maxSizeMb: response.data.fotoPersonaMaxSizeMb,
                minAnchoPx: response.data.fotoPersonaMinAnchoPx,
                minAltoPx: response.data.fotoPersonaMinAltoPx
            })
        );
    }, []);

    return config;
}
