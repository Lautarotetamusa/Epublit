export type AdjuntoEmail = {
    nombre: string;
    contenido: Buffer;
    tipo: string;
};

// Lo que viaja a Postmark: el HTML lo arma Postmark con el template del
// alias, el back sólo manda el modelo.
export type EnvioTemplate = {
    alias: string;
    para: string;
    modelo: Record<string, string>;
    adjuntos: AdjuntoEmail[];
};

export type TransporteEmail = (envio: EnvioTemplate) => Promise<void>;
