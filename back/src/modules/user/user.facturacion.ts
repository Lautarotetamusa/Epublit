import type { X509Certificate } from "crypto";
import { aFechaISO } from "../../lib/fecha";
import type { User } from "./user.validator";

const DIAS_AVISO_VENCIMIENTO = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export type EstadoCertificado = "faltante" | "no_corresponde" | "vencido" | "por_vencer" | "vigente";

export type PendienteFacturacion = {
    codigo: "certificado" | "punto_venta" | "datos_fiscales" | "entorno";
    mensaje: string;
};

export type EstadoFacturacion = {
    habilitado: boolean;
    entorno: "produccion" | "homologacion";
    punto_venta: number | null;
    certificado: { estado: EstadoCertificado; vence: string | null };
    pendientes: PendienteFacturacion[];
};

export type CertificadoDeLaCuenta = {
    certificado: X509Certificate;
    correspondeALaCuenta: boolean;
};

const estadoDelCertificado = (cert: CertificadoDeLaCuenta | null, hoy: Date): EstadoCertificado => {
    if (!cert) return "faltante";
    if (!cert.correspondeALaCuenta) return "no_corresponde";

    const vence = new Date(cert.certificado.validTo);
    if (vence <= hoy) return "vencido";

    return vence.getTime() - hoy.getTime() <= DIAS_AVISO_VENCIMIENTO * MS_POR_DIA ? "por_vencer" : "vigente";
};

const MENSAJE_CERTIFICADO: Partial<Record<EstadoCertificado, string>> = {
    faltante: "Subí el certificado de ARCA generado con el CSR de tu cuenta.",
    no_corresponde: "El certificado cargado no corresponde a tu cuenta. Generalo en ARCA con el CSR de tu perfil y volvé a subirlo.",
    vencido: "El certificado de ARCA está vencido. Generá uno nuevo y subilo."
};

const datosFiscalesCompletos = (user: User): boolean =>
    [user.cond_fiscal, user.razon_social, user.domicilio].every((dato) => dato.trim() !== "");

// Sólo lo que se puede verificar sin llamar a ARCA: que el punto de venta
// exista allá y sea de tipo Web Service no se valida acá.
export function evaluarFacturacion(user: User, cert: CertificadoDeLaCuenta | null, hoy: Date): EstadoFacturacion {
    const estadoCertificado = estadoDelCertificado(cert, hoy);
    const pendientes: PendienteFacturacion[] = [];

    const mensajeCertificado = MENSAJE_CERTIFICADO[estadoCertificado];
    if (mensajeCertificado) pendientes.push({ codigo: "certificado", mensaje: mensajeCertificado });

    if (user.punto_venta === null) {
        pendientes.push({ codigo: "punto_venta", mensaje: "Cargá el número de punto de venta que diste de alta en ARCA." });
    }
    if (!datosFiscalesCompletos(user)) {
        pendientes.push({ codigo: "datos_fiscales", mensaje: "Completá la condición frente al IVA, la razón social y el domicilio." });
    }
    // Con certificado válido y sin producción, es una cuenta vieja con el par de
    // homologación: subir el certificado de nuevo la pasa a producción.
    if (!user.production && estadoCertificado !== "faltante") {
        pendientes.push({ codigo: "entorno", mensaje: "Tu cuenta factura en modo de prueba. Subí el certificado de ARCA para pasar a producción." });
    }

    return {
        habilitado: pendientes.length === 0,
        entorno: user.production ? "produccion" : "homologacion",
        punto_venta: user.punto_venta,
        certificado: {
            estado: estadoCertificado,
            vence: cert ? aFechaISO(new Date(cert.certificado.validTo)) : null
        },
        pendientes
    };
}
