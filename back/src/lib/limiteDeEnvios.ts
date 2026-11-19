export type LimiteDeEnviosConfig = {
    ahora: () => Date;
    esperaMinimaMs: number;
    ventanaMs: number;
    maximoEnVentana: number;
};

// En memoria y no en la base: alcanza con un solo proceso de back, y así se
// puede limitar por claves que no son de ninguna cuenta (un email inexistente)
// sin guardarlas.
export function createLimiteDeEnvios({ ahora, esperaMinimaMs, ventanaMs, maximoEnVentana }: LimiteDeEnviosConfig) {
    const enviosPorClave = new Map<string, number[]>();

    const descartarVencidos = (ahoraMs: number) => {
        for (const [clave, envios] of enviosPorClave) {
            const vigentes = envios.filter((envio) => ahoraMs - envio < ventanaMs);
            if (vigentes.length === 0) enviosPorClave.delete(clave);
            else enviosPorClave.set(clave, vigentes);
        }
    };

    const estaBloqueada = (envios: number[], ahoraMs: number): boolean => {
        const ultimo = envios.at(-1);
        return envios.length >= maximoEnVentana || (ultimo !== undefined && ahoraMs - ultimo < esperaMinimaMs);
    };

    // Registra el envío sólo si se permite: un pedido rechazado no extiende
    // el bloqueo.
    const registrarSiSePermite = (clave: string): boolean => {
        const ahoraMs = ahora().getTime();
        descartarVencidos(ahoraMs);

        const envios = enviosPorClave.get(clave) ?? [];
        if (estaBloqueada(envios, ahoraMs)) return false;

        enviosPorClave.set(clave, [...envios, ahoraMs]);
        return true;
    };

    return { registrarSiSePermite };
}

export type LimiteDeEnvios = ReturnType<typeof createLimiteDeEnvios>;
