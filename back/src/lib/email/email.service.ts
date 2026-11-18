import type { AdjuntoEmail, TransporteEmail } from "./email.types";

export const TEMPLATES = {
    bienvenida: "bienvenida"
} as const;

export type EmailServiceDeps = {
    transporte: TransporteEmail;
    // Base pública del panel: los links de los mails apuntan ahí.
    panelUrl: string;
};

export type Bienvenida = {
    para: string;
    nombre: string;
    cuit: string;
    csr: Buffer;
};

const urlEn = (base: string, ruta: string) => new URL(ruta, base).toString();

// Un método tipado por mail (no un `enviar(alias, any)`): si un template pide
// un dato nuevo, el compilador marca a quién le falta.
export function createEmailService({ transporte, panelUrl }: EmailServiceDeps) {
    const enviarBienvenida = async ({ para, nombre, cuit, csr }: Bienvenida): Promise<void> => {
        const adjuntoCsr: AdjuntoEmail = { nombre: `${cuit}.csr`, contenido: csr, tipo: "application/pkcs10" };

        await transporte({
            alias: TEMPLATES.bienvenida,
            para,
            modelo: {
                nombre,
                cuit,
                url_panel: urlEn(panelUrl, "/"),
                url_perfil: urlEn(panelUrl, "/perfil"),
                url_guia_certificado: urlEn(panelUrl, "/ayuda/certificado-arca")
            },
            adjuntos: [adjuntoCsr]
        });
    };

    return { enviarBienvenida };
}

export type EmailService = ReturnType<typeof createEmailService>;
