import type { AdjuntoEmail, TransporteEmail } from "./email.types";

export const TEMPLATES = {
    bienvenida: "bienvenida",
    confirmarEmail: "confirmar-email",
    restablecerContrasena: "restablecer-contrasena"
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

export type ConfirmacionEmail = {
    para: string;
    nombre: string;
    token: string;
};

export type RestablecimientoContrasena = {
    para: string;
    // Llega armada (razón social, más el usuario en cuentas viejas) para no
    // depender de condicionales de Mustachio en el template.
    cuenta: string;
    token: string;
};

const urlEn = (base: string, ruta: string) => new URL(ruta, base).toString();

const urlConToken = (base: string, ruta: string, token: string) => {
    const url = new URL(ruta, base);
    url.searchParams.set("token", token);
    return url.toString();
};

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

    const enviarConfirmacionEmail = async ({ para, nombre, token }: ConfirmacionEmail): Promise<void> => {
        await transporte({
            alias: TEMPLATES.confirmarEmail,
            para,
            modelo: { nombre, url_confirmar: urlConToken(panelUrl, "/verificar-email", token) },
            adjuntos: []
        });
    };

    const enviarRestablecimientoContrasena = async ({ para, cuenta, token }: RestablecimientoContrasena): Promise<void> => {
        await transporte({
            alias: TEMPLATES.restablecerContrasena,
            para,
            modelo: { cuenta, url_restablecer: urlConToken(panelUrl, "/restablecer-contrasena", token) },
            adjuntos: []
        });
    };

    return { enviarBienvenida, enviarConfirmacionEmail, enviarRestablecimientoContrasena };
}

export type EmailService = ReturnType<typeof createEmailService>;
